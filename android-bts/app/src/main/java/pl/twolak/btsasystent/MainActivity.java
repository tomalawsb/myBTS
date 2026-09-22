package pl.twolak.btsasystent;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.util.Base64;
import android.view.Surface;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity implements SensorEventListener {
    private static final int REQ_LOCATION = 1001;
    private WebView webView;
    private LocationManager locationManager;
    private LocationListener locationListener;
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private boolean nativeTracking = false;
    private Location bestLocation;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PDFBoxResourceLoader.init(getApplicationContext());
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidNative");
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html?v=13");
    }

    private class Bridge {
        @JavascriptInterface public void startNativeTracking() { runOnUiThread(() -> ensureLocationAndStart()); }
        @JavascriptInterface public void stopNativeTracking() { runOnUiThread(() -> stopNativeLocation()); }
        @JavascriptInterface public void startNativeCompass() { runOnUiThread(() -> startCompass()); }

        @JavascriptInterface public String geocodeAddress(String query) {
            JSONArray out = new JSONArray();
            if (query == null || query.trim().length() < 2 || !Geocoder.isPresent()) return out.toString();
            try {
                String q = query.trim();
                if (!q.toLowerCase(Locale.ROOT).contains("polska")) q += ", Polska";
                Geocoder geocoder = new Geocoder(MainActivity.this, new Locale("pl", "PL"));
                List<Address> results = geocoder.getFromLocationName(q, 5);
                if (results == null) return out.toString();
                for (Address a : results) {
                    if (!a.hasLatitude() || !a.hasLongitude()) continue;
                    JSONObject item = new JSONObject();
                    item.put("lat", a.getLatitude());
                    item.put("lon", a.getLongitude());
                    String label = a.getMaxAddressLineIndex() >= 0 ? a.getAddressLine(0) : query.trim();
                    item.put("label", label == null ? query.trim() : label);
                    out.put(item);
                }
            } catch (Exception ignored) {}
            return out.toString();
        }

        @JavascriptInterface public String fetchText(String url) {
            try { return new String(downloadBytes(url), StandardCharsets.UTF_8); }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface public String fetchBase64(String url) {
            try { return Base64.encodeToString(downloadBytes(url), Base64.NO_WRAP); }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface public void fetchUrlAsync(String url, String requestId, boolean binary) {
            final String safeId = requestId == null ? "" : requestId;
            new Thread(() -> {
                try {
                    byte[] bytes = downloadBytes(url);
                    String payload = binary
                            ? Base64.encodeToString(bytes, Base64.NO_WRAP)
                            : new String(bytes, StandardCharsets.UTF_8);
                    String js = "window.onNativeFetch13&&window.onNativeFetch13(" +
                            JSONObject.quote(safeId) + ",true," + JSONObject.quote(payload) + ",\"\")";
                    sendJs(js);
                } catch (Exception e) {
                    String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    String js = "window.onNativeFetch13&&window.onNativeFetch13(" +
                            JSONObject.quote(safeId) + ",false,\"\"," + JSONObject.quote(message) + ")";
                    sendJs(js);
                }
            }, "bts-http").start();
        }

        @JavascriptInterface public void fetchPdfTextAsync(String url, String requestId) {
            final String safeId = requestId == null ? "" : requestId;
            new Thread(() -> {
                try {
                    byte[] bytes = downloadBytes(url);
                    if (bytes.length > 24 * 1024 * 1024) throw new IllegalStateException("Raport PDF jest zbyt duży");
                    String text;
                    try (PDDocument document = PDDocument.load(bytes)) {
                        PDFTextStripper stripper = new PDFTextStripper();
                        stripper.setSortByPosition(true);
                        stripper.setLineSeparator("\n");
                        text = stripper.getText(document);
                    }
                    if (text == null) text = "";
                    if (text.length() > 420000) text = text.substring(0, 420000);
                    String js = "window.onNativePdfText13&&window.onNativePdfText13(" +
                            JSONObject.quote(safeId) + ",true," + JSONObject.quote(text) + ",\"\")";
                    sendJs(js);
                } catch (Exception e) {
                    String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                    String js = "window.onNativePdfText13&&window.onNativePdfText13(" +
                            JSONObject.quote(safeId) + ",false,\"\"," + JSONObject.quote(message) + ")";
                    sendJs(js);
                }
            }, "bts-pdf").start();
        }
    }

    private byte[] downloadBytes(String rawUrl) throws Exception {
        if (rawUrl == null) throw new IllegalArgumentException("Brak adresu URL");
        String normalized = rawUrl.trim();
        if (normalized.startsWith("http://si2pem.gov.pl/")) {
            normalized = "https://si2pem.gov.pl/" + normalized.substring("http://si2pem.gov.pl/".length());
        }
        if (!(normalized.startsWith("https://") || normalized.startsWith("http://"))) {
            throw new IllegalArgumentException("Nieprawidłowy adres URL");
        }
        HttpURLConnection connection = (HttpURLConnection) new URL(normalized).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(45000);
        connection.setRequestProperty("User-Agent", "BTS-Asystent-PL/1.3 Android");
        connection.setRequestProperty("Accept", "*/*");
        connection.connect();
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            connection.disconnect();
            throw new IllegalStateException("HTTP " + code);
        }
        try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32768];
            int n;
            while ((n = in.read(buffer)) >= 0) out.write(buffer, 0, n);
            return out.toByteArray();
        } finally {
            connection.disconnect();
        }
    }

    private void ensureLocationAndStart() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        startNativeLocation();
    }

    private boolean isFresh(Location l, long maxAgeMs) {
        return l != null && System.currentTimeMillis() - l.getTime() <= maxAgeMs;
    }

    private boolean shouldAccept(Location candidate) {
        if (candidate == null) return false;
        if (candidate.hasAccuracy() && candidate.getAccuracy() > 1200f) return false;
        if (bestLocation == null) return true;
        long dt = candidate.getTime() - bestLocation.getTime();
        float ca = candidate.hasAccuracy() ? candidate.getAccuracy() : 9999f;
        float ba = bestLocation.hasAccuracy() ? bestLocation.getAccuracy() : 9999f;
        if (dt > 10000) return true;
        if (dt < -15000) return false;
        return ca <= ba + 25f || (dt > 2500 && ca < 250f);
    }

    private void acceptLocation(Location l) {
        if (!shouldAccept(l)) return;
        bestLocation = new Location(l);
        pushLocation(bestLocation);
    }

    private void startNativeLocation() {
        stopNativeLocation();
        nativeTracking = true;
        bestLocation = null;
        locationListener = new LocationListener() {
            @Override public void onLocationChanged(Location l) { acceptLocation(l); }
        };

        try {
            Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (isFresh(gps, 120000)) acceptLocation(gps);
            if (isFresh(net, 60000)) acceptLocation(net);
        } catch (Exception ignored) {}

        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 800, 0.5f, locationListener, Looper.getMainLooper());
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1500, 2f, locationListener, Looper.getMainLooper());
        } catch (Exception e) {
            sendJs("window.onNativeLocationError&&window.onNativeLocationError('Włącz lokalizację w telefonie')");
        }
        startCompass();
    }

    private void stopNativeLocation() {
        nativeTracking = false;
        if (locationListener != null) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception ignored) {}
        }
        locationListener = null;
    }

    private void pushLocation(Location l) {
        String js = String.format(Locale.US,
            "window.onNativeLocation&&window.onNativeLocation(%.8f,%.8f,%.1f,%.2f,%.2f,%d)",
            l.getLatitude(), l.getLongitude(), l.hasAccuracy()?l.getAccuracy():-1f,
            l.hasBearing()?l.getBearing():-1f, l.hasSpeed()?l.getSpeed():-1f, l.getTime());
        sendJs(js);
    }

    private void startCompass() {
        if (rotationSensor != null) {
            sensorManager.unregisterListener(this);
            sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
        } else {
            sendJs("window.onNativeCompassUnavailable&&window.onNativeCompassUnavailable()");
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (nativeTracking) startNativeLocation(); else startCompass();
    }

    @Override protected void onPause() {
        sensorManager.unregisterListener(this);
        super.onPause();
    }

    @Override protected void onDestroy() {
        stopNativeLocation();
        sensorManager.unregisterListener(this);
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION) {
            boolean ok = false;
            for (int r: grantResults) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
            if (ok) startNativeLocation();
            else sendJs("window.onNativeLocationError&&window.onNativeLocationError('Brak zgody na lokalizację')");
        }
    }

    @Override public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR) return;
        float[] rm = new float[9], adj = new float[9], orientation = new float[3];
        SensorManager.getRotationMatrixFromVector(rm, event.values);
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        switch (rotation) {
            case Surface.ROTATION_90:
                SensorManager.remapCoordinateSystem(rm, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, adj);
                break;
            case Surface.ROTATION_180:
                SensorManager.remapCoordinateSystem(rm, SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y, adj);
                break;
            case Surface.ROTATION_270:
                SensorManager.remapCoordinateSystem(rm, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, adj);
                break;
            default:
                System.arraycopy(rm,0,adj,0,9);
        }
        SensorManager.getOrientation(adj, orientation);
        float h = ((float)Math.toDegrees(orientation[0]) + 360f) % 360f;
        sendJs(String.format(Locale.US, "window.onNativeHeading&&window.onNativeHeading(%.1f)", h));
    }

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    private void sendJs(String js) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}

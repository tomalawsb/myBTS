package pl.twolak.btsasystent;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
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

import java.util.Locale;

public class MainActivity extends Activity implements SensorEventListener {
    private static final int REQ_LOCATION = 1001;
    private WebView webView;
    private LocationManager locationManager;
    private LocationListener locationListener;
    private SensorManager sensorManager;
    private Sensor rotationSensor;
    private boolean nativeTracking = false;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private class Bridge {
        @JavascriptInterface public void startNativeTracking() { runOnUiThread(() -> ensureLocationAndStart()); }
        @JavascriptInterface public void stopNativeTracking() { runOnUiThread(() -> stopNativeLocation()); }
        @JavascriptInterface public void startNativeCompass() { runOnUiThread(() -> startCompass()); }
    }

    private void ensureLocationAndStart() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        startNativeLocation();
    }

    private void startNativeLocation() {
        stopNativeLocation();
        nativeTracking = true;
        locationListener = new LocationListener() {
            @Override public void onLocationChanged(Location l) { pushLocation(l); }
        };
        try {
            Location last = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (last == null) last = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            if (last != null) pushLocation(last);
        } catch (Exception ignored) {}
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1200, 1.5f, locationListener, Looper.getMainLooper());
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2500, 5f, locationListener, Looper.getMainLooper());
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
            "window.onNativeLocation&&window.onNativeLocation(%.8f,%.8f,%.1f,%.2f,%.2f)",
            l.getLatitude(), l.getLongitude(), l.hasAccuracy()?l.getAccuracy():-1f,
            l.hasBearing()?l.getBearing():-1f, l.hasSpeed()?l.getSpeed():-1f);
        sendJs(js);
    }

    private void startCompass() {
        if (rotationSensor != null) {
            sensorManager.unregisterListener(this);
            sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_UI);
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

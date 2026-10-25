package pl.tomalawsb.dvbtpoint;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.*;
import android.widget.Toast;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

public class MainActivity extends Activity {
    private static final String START = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView web;
    private WebViewAssetLoader loader;
    private GeolocationPermissions.Callback geoCb;
    private String geoOrigin;
    private NativeCompass compass;
    private boolean compassWanted = false;
    private long lastBack = 0;

    /** Most JS ↔ Android (window.DVBTNative). Wywołania przychodzą z wątku WebView — sensory przełączamy na UI. */
    public class Bridge {
        @JavascriptInterface public boolean hasCompass() { return compass.available(); }
        @JavascriptInterface public void startCompass() { runOnUiThread(() -> { compassWanted = true; compass.start(); }); }
        @JavascriptInterface public void stopCompass() { runOnUiThread(() -> { compassWanted = false; compass.stop(); }); }
        @JavascriptInterface public void setLocation(double lat, double lon, double alt) { compass.setLocation(lat, lon, alt); }
        @JavascriptInterface public double declination() { return compass.declination(); }
        @JavascriptInterface public void exitApp() { runOnUiThread(MainActivity.this::finish); }
    }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest r) {
                    return loader.shouldInterceptRequest(r.getUrl());
                }
            });
        }
        web = new WebView(this);
        setContentView(web);
        compass = new NativeCompass(this, web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "DVBTNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (hasLoc()) { cb.invoke(origin, true, false); return; }
                geoOrigin = origin; geoCb = cb;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 1);
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(START);
    }

    private boolean hasLoc() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override public void onRequestPermissionsResult(int code, String[] p, int[] res) {
        if (code == 1 && geoCb != null) { geoCb.invoke(geoOrigin, hasLoc(), false); geoCb = null; }
    }
    @Override protected void onResume() { super.onResume(); if (compassWanted) compass.start(); }
    @Override protected void onPause() { compass.stop(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    /**
     * Wstecz: najpierw aplikacja (window.handleBack() zamyka okno/ekran/panel i zwraca true).
     * Na ekranie głównym mapy: pierwsze naciśnięcie — komunikat, drugie w ciągu 2 s — wyjście.
     */
    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return !!(window.handleBack&&window.handleBack());}catch(e){return false;}})()", v -> {
            if ("true".equals(v)) return;
            long now = SystemClock.uptimeMillis();
            if (now - lastBack < 2000) { finish(); return; }
            lastBack = now;
            Toast.makeText(this, "Naciśnij ponownie, aby wyjść", Toast.LENGTH_SHORT).show();
        });
    }
}

package pl.tomalawsb.dvbtpoint;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Surface;
import android.view.WindowManager;
import android.webkit.WebView;
import java.util.Locale;

/**
 * Natywny kompas: TYPE_ROTATION_VECTOR (zapas: akcelerometr + magnetometr), macierz obrotu
 * przemapowana wg obrotu ekranu, azymut magnetyczny + deklinacja (GeomagneticField) = azymut geograficzny.
 * Wygładzanie kołowe (sin/cos, bez skoku 359→0). Wynik do JS ok. 20 Hz: window.__nativeCompass(h, acc, cal, src).
 */
final class NativeCompass implements SensorEventListener {
    private final SensorManager sm;
    private final WindowManager wm;
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final float[] R = new float[9], Rr = new float[9], ori = new float[3];
    private float[] grav, geo;
    private boolean running, useRv;
    private double sx, sy; private boolean has;
    private int accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private float rvAccDeg = -1f;
    private float declination = 0f; private boolean hasDecl = false;
    private long lastPush = 0;

    NativeCompass(Context c, WebView w) {
        sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        wm = (WindowManager) c.getSystemService(Context.WINDOW_SERVICE);
        web = w;
    }
    boolean available() {
        return sm != null && (sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null
            || (sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null && sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null));
    }
    void setLocation(double lat, double lon, double altM) {
        GeomagneticField f = new GeomagneticField((float) lat, (float) lon, (float) altM, System.currentTimeMillis());
        declination = f.getDeclination(); hasDecl = true;
    }
    float declination() { return hasDecl ? declination : Float.NaN; }
    void start() {
        if (running || sm == null) return;
        Sensor rv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        useRv = rv != null;
        if (useRv) {
            sm.registerListener(this, rv, SensorManager.SENSOR_DELAY_GAME);
            Sensor mag = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD); // tylko do raportu dokładności/kalibracji
            if (mag != null) sm.registerListener(this, mag, SensorManager.SENSOR_DELAY_UI);
        } else {
            Sensor a = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER), m = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
            if (a == null || m == null) return;
            sm.registerListener(this, a, SensorManager.SENSOR_DELAY_GAME);
            sm.registerListener(this, m, SensorManager.SENSOR_DELAY_GAME);
        }
        has = false; running = true;
    }
    void stop() { if (sm != null) sm.unregisterListener(this); running = false; has = false; }

    @Override public void onAccuracyChanged(Sensor s, int acc) {
        if (s.getType() == Sensor.TYPE_MAGNETIC_FIELD) accuracy = acc;
    }
    @Override public void onSensorChanged(SensorEvent e) {
        int t = e.sensor.getType();
        if (t == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(R, e.values);
            if (e.values.length > 4 && e.values[4] > 0) rvAccDeg = (float) Math.toDegrees(e.values[4]);
            compute();
        } else if (t == Sensor.TYPE_ACCELEROMETER) {
            grav = lowPass(e.values, grav);
        } else if (t == Sensor.TYPE_MAGNETIC_FIELD) {
            accuracy = e.accuracy; // stan kalibracji magnetometru
            if (useRv) return;
            geo = lowPass(e.values, geo);
            if (grav != null && SensorManager.getRotationMatrix(R, null, grav, geo)) compute();
        }
    }
    private static float[] lowPass(float[] in, float[] out) {
        if (out == null) return in.clone();
        for (int i = 0; i < in.length && i < out.length; i++) out[i] += 0.2f * (in[i] - out[i]);
        return out;
    }
    private void compute() {
        int rot = wm.getDefaultDisplay().getRotation();
        int ax = SensorManager.AXIS_X, ay = SensorManager.AXIS_Y;
        switch (rot) {
            case Surface.ROTATION_90: ax = SensorManager.AXIS_Y; ay = SensorManager.AXIS_MINUS_X; break;
            case Surface.ROTATION_180: ax = SensorManager.AXIS_MINUS_X; ay = SensorManager.AXIS_MINUS_Y; break;
            case Surface.ROTATION_270: ax = SensorManager.AXIS_MINUS_Y; ay = SensorManager.AXIS_X; break;
            default: break;
        }
        SensorManager.remapCoordinateSystem(R, ax, ay, Rr);
        SensorManager.getOrientation(Rr, ori);
        double mag = Math.toDegrees(ori[0]);
        double trueH = mag + (hasDecl ? declination : 0);
        double r = Math.toRadians(trueH);
        if (!has) { sx = Math.cos(r); sy = Math.sin(r); has = true; }
        else { sx += 0.18 * (Math.cos(r) - sx); sy += 0.18 * (Math.sin(r) - sy); } // wygładzanie kołowe
        long now = SystemClock.uptimeMillis();
        if (now - lastPush < 50) return; // ok. 20 Hz
        lastPush = now;
        double hd = (Math.toDegrees(Math.atan2(sy, sx)) + 360) % 360;
        float accDeg = rvAccDeg > 0 ? rvAccDeg : (accuracy >= SensorManager.SENSOR_STATUS_ACCURACY_HIGH ? 5f : accuracy == SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM ? 15f : accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW ? 30f : -1f);
        boolean needCal = accuracy <= SensorManager.SENSOR_STATUS_ACCURACY_LOW;
        final String js = String.format(Locale.US, "window.__nativeCompass&&window.__nativeCompass(%.1f,%s,%b,'%s',%s)",
            hd, accDeg > 0 ? String.format(Locale.US, "%.1f", accDeg) : "null", needCal, useRv ? "rotation_vector" : "accel_mag",
            hasDecl ? String.format(Locale.US, "%.2f", declination) : "null");
        ui.post(() -> web.evaluateJavascript(js, null));
    }
}

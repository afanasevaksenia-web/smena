package ru.mopedroute.navigator;

import android.Manifest;
import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.provider.MediaStore;
import android.os.Environment;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.content.Context;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;
import android.util.Log;

import org.json.JSONObject;
import org.json.JSONArray;

import java.net.URL;
import java.net.URLEncoder;
import java.net.HttpURLConnection;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView web;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private LocationManager locations;
    private LocationListener listener;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:///android_asset/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
                return true;
            }
        });
        web.addJavascriptInterface(new Native(), "MopedNative");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        locations=(LocationManager)getSystemService(Context.LOCATION_SERVICE);
        listener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if(location == null) return;
                js("window.onGps && window.onGps("+location.getLatitude()+","+location.getLongitude()+","+location.getSpeed()+");");
            }
            @Override public void onProviderDisabled(String p) {}
            @Override public void onProviderEnabled(String p) {}
            @Override public void onStatusChanged(String p,int status,Bundle b) {}
        };
    }

    private void js(String code) { runOnUiThread(() -> { if(web!=null) web.evaluateJavascript(code,null); }); }
    private void send(String type,String id,String data) {
        js("window.nativeResponse("+JSONObject.quote(type)+","+JSONObject.quote(id)+","+JSONObject.quote(data)+");");
    }
    private void show(String msg){runOnUiThread(()->Toast.makeText(this,msg,Toast.LENGTH_LONG).show());}

    private String get(String address) throws Exception {
        HttpURLConnection c=(HttpURLConnection)(new URL(address)).openConnection();
        c.setRequestProperty("User-Agent","MopedNavigator/0.1 (experimental personal Android map app)");
        c.setRequestProperty("Accept","application/json");
        c.setConnectTimeout(20000);
        c.setReadTimeout(55000);
        int status=c.getResponseCode();
        InputStream stream=status>=200&&status<300?c.getInputStream():c.getErrorStream();
        if(stream==null) throw new Exception("HTTP "+status);
        StringBuilder sb=new StringBuilder();
        try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))) {
            String line; while((line=r.readLine())!=null){sb.append(line); if(sb.length()>2500000)throw new Exception("Слишком большой ответ сервера");}
        } finally {c.disconnect();}
        if(status<200||status>=300) throw new Exception("Сервис маршрутов: HTTP "+status+" "+sb.substring(0,Math.min(180,sb.length())));
        return sb.toString();
    }

    private void startGps(){
        if(Build.VERSION.SDK_INT>=23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},41);
            return;
        }
        try {
            if(locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){
                locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,5000,5,listener);
                Location last=locations.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if(last!=null) listener.onLocationChanged(last);
            }
            if(locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)){
                locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,5000,5,listener);
                Location last=locations.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if(last!=null) listener.onLocationChanged(last);
            }
        }catch(SecurityException e){show("Разрешите доступ к местоположению");}
        catch(Exception e){show("GPS недоступен: "+e.getMessage());}
    }

    @Override public void onRequestPermissionsResult(int req,String[] perms,int[] results){
        super.onRequestPermissionsResult(req,perms,results);
        if(req==41 && results.length>0){
            boolean ok=false;for(int r:results)if(r==PackageManager.PERMISSION_GRANTED)ok=true;
            if(ok)startGps(); else show("Для GPS разрешите геолокацию в настройках приложения.");
        }
    }
    @Override public void onDestroy(){
        try{if(locations!=null && listener!=null)locations.removeUpdates(listener);}catch(Exception ignored){}
        executor.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("MopedNative");web.destroy();}
        super.onDestroy();
    }

    public class Native {
        @JavascriptInterface public void find(String text,String id){
            executor.submit(()->{
                try{
                    String q=URLEncoder.encode(text,"UTF-8");
                    String url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=ru&q="+q;
                    send("find",id,get(url));
                    try{Thread.sleep(1000);}catch(InterruptedException ignored){}
                }catch(Exception e){send("error",id,new JSONObject().put("message", e.getMessage()).toString());}
            });
        }
        @JavascriptInterface public void route(String jsonLocations,String profile,String id){
            executor.submit(()->{
                try{
                    JSONArray pts=new JSONArray(jsonLocations);
                    if(pts.length()<2||pts.length()>12)throw new Exception("Укажите от 2 до 12 точек");
                    String costing="moped".equals(profile)?"motor_scooter":"motorcycle";
                    JSONObject opts=new JSONObject().put("use_highways",0.0).put("use_tolls",0.0);
                    if(costing.equals("motor_scooter"))opts.put("top_speed",45);
                    JSONObject obj=new JSONObject()
                      .put("locations",pts)
                      .put("costing",costing)
                      .put("costing_options",new JSONObject().put(costing,opts))
                      .put("language","ru-RU")
                      .put("directions_options",new JSONObject().put("units","kilometers"));
                    String url="https://valhalla1.openstreetmap.de/route?json="+URLEncoder.encode(obj.toString(),"UTF-8");
                    send("route",id,get(url));
                }catch(Exception e){send("error",id,e.getMessage()==null?"Ошибка сети":e.getMessage());}
            });
        }
        @JavascriptInterface public void gps(){runOnUiThread(()->startGps());}
        @JavascriptInterface public void saveGpx(String xml){
            executor.submit(()->{
                try{
                    String name="moped-route-"+System.currentTimeMillis()+".gpx";
                    if(Build.VERSION.SDK_INT>=29){
                        ContentValues cv=new ContentValues();
                        cv.put(MediaStore.Downloads.DISPLAY_NAME,name);
                        cv.put(MediaStore.Downloads.MIME_TYPE,"application/gpx+xml");
                        Uri uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);
                        if(uri==null)throw new Exception("Нельзя открыть папку Загрузки");
                        try(OutputStream out=getContentResolver().openOutputStream(uri)){
                            if(out==null)throw new Exception("Нет доступа к файлу");
                            out.write(xml.getBytes(StandardCharsets.UTF_8));
                        }
                    } else {
                        File f=new File(getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),name);
                        try(OutputStream o=new FileOutputStream(f)){o.write(xml.getBytes(StandardCharsets.UTF_8));}
                    }
                    show("GPX сохранён: "+name);
                }catch(Exception e){show("Не удалось сохранить GPX: "+e.getMessage());}
            });
        }
    }
}

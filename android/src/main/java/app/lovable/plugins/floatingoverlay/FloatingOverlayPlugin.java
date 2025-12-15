package app.lovable.plugins.floatingoverlay;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "FloatingOverlay",
    permissions = {
        @Permission(
            strings = { "android.permission.SYSTEM_ALERT_WINDOW" },
            alias = "overlay"
        )
    }
)
public class FloatingOverlayPlugin extends Plugin {
    
    private static final int OVERLAY_PERMISSION_REQUEST_CODE = 1234;
    private FloatingOverlayService overlayService;
    
    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            result.put("granted", Settings.canDrawOverlays(getContext()));
        } else {
            result.put("granted", true);
        }
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())
                );
                startActivityForResult(call, intent, "handleOverlayPermissionResult");
            } else {
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
            }
        } else {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        }
    }
    
    @ActivityCallback
    private void handleOverlayPermissionResult(PluginCall call, ActivityResult result) {
        JSObject response = new JSObject();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            response.put("granted", Settings.canDrawOverlays(getContext()));
        } else {
            response.put("granted", true);
        }
        
        call.resolve(response);
    }
    
    @PluginMethod
    public void showOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("Overlay permission not granted");
            return;
        }
        
        Intent intent = new Intent(getContext(), FloatingOverlayService.class);
        intent.setAction(FloatingOverlayService.ACTION_SHOW);
        getContext().startService(intent);
        
        call.resolve();
    }
    
    @PluginMethod
    public void hideOverlay(PluginCall call) {
        Intent intent = new Intent(getContext(), FloatingOverlayService.class);
        intent.setAction(FloatingOverlayService.ACTION_HIDE);
        getContext().startService(intent);
        
        call.resolve();
    }
    
    @PluginMethod
    public void isOverlayVisible(PluginCall call) {
        JSObject result = new JSObject();
        result.put("visible", FloatingOverlayService.isVisible());
        call.resolve(result);
    }
    
    @PluginMethod
    public void updatePosition(PluginCall call) {
        int x = call.getInt("x", 0);
        int y = call.getInt("y", 0);
        
        Intent intent = new Intent(getContext(), FloatingOverlayService.class);
        intent.setAction(FloatingOverlayService.ACTION_UPDATE_POSITION);
        intent.putExtra("x", x);
        intent.putExtra("y", y);
        getContext().startService(intent);
        
        call.resolve();
    }
}

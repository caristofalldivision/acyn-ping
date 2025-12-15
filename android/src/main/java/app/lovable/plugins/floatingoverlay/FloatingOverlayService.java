package app.lovable.plugins.floatingoverlay;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

public class FloatingOverlayService extends Service {
    
    public static final String ACTION_SHOW = "app.lovable.SHOW_OVERLAY";
    public static final String ACTION_HIDE = "app.lovable.HIDE_OVERLAY";
    public static final String ACTION_UPDATE_POSITION = "app.lovable.UPDATE_POSITION";
    
    private static boolean isVisible = false;
    
    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams params;
    
    private int initialX;
    private int initialY;
    private float initialTouchX;
    private float initialTouchY;
    
    public static boolean isVisible() {
        return isVisible;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        
        String action = intent.getAction();
        
        if (ACTION_SHOW.equals(action)) {
            showOverlay();
        } else if (ACTION_HIDE.equals(action)) {
            hideOverlay();
        } else if (ACTION_UPDATE_POSITION.equals(action)) {
            int x = intent.getIntExtra("x", 0);
            int y = intent.getIntExtra("y", 0);
            updatePosition(x, y);
        }
        
        return START_NOT_STICKY;
    }
    
    private void showOverlay() {
        if (floatingView != null) return;
        
        // Create floating view programmatically
        floatingView = createFloatingView();
        
        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }
        
        params = new WindowManager.LayoutParams(
            dpToPx(60),
            dpToPx(60),
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 0;
        params.y = 100;
        
        setupTouchListener();
        
        windowManager.addView(floatingView, params);
        isVisible = true;
    }
    
    private View createFloatingView() {
        // Create a circular floating button programmatically
        ImageView imageView = new ImageView(this);
        imageView.setImageResource(android.R.drawable.ic_btn_speak_now);
        imageView.setBackgroundResource(android.R.drawable.oval);
        imageView.setPadding(dpToPx(12), dpToPx(12), dpToPx(12), dpToPx(12));
        imageView.setAlpha(0.7f);
        
        return imageView;
    }
    
    private void setupTouchListener() {
        floatingView.setOnTouchListener(new View.OnTouchListener() {
            private long touchStartTime;
            private boolean isDragging = false;
            
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        touchStartTime = System.currentTimeMillis();
                        isDragging = false;
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                        
                    case MotionEvent.ACTION_MOVE:
                        float deltaX = event.getRawX() - initialTouchX;
                        float deltaY = event.getRawY() - initialTouchY;
                        
                        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                            isDragging = true;
                        }
                        
                        if (isDragging) {
                            params.x = initialX + (int) deltaX;
                            params.y = initialY + (int) deltaY;
                            windowManager.updateViewLayout(floatingView, params);
                        }
                        return true;
                        
                    case MotionEvent.ACTION_UP:
                        long touchDuration = System.currentTimeMillis() - touchStartTime;
                        
                        if (!isDragging && touchDuration < 200) {
                            // It's a click - open the app
                            openApp();
                        } else {
                            // Snap to edge after drag
                            snapToEdge();
                        }
                        return true;
                }
                return false;
            }
        });
    }
    
    private void snapToEdge() {
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int centerX = params.x + dpToPx(30);
        
        if (centerX < screenWidth / 2) {
            params.x = 0;
        } else {
            params.x = screenWidth - dpToPx(60);
        }
        
        windowManager.updateViewLayout(floatingView, params);
    }
    
    private void openApp() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra("fromOverlay", true);
            startActivity(intent);
        }
    }
    
    private void hideOverlay() {
        if (floatingView != null) {
            windowManager.removeView(floatingView);
            floatingView = null;
            isVisible = false;
        }
    }
    
    private void updatePosition(int x, int y) {
        if (params != null && floatingView != null) {
            params.x = x;
            params.y = y;
            windowManager.updateViewLayout(floatingView, params);
        }
    }
    
    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        hideOverlay();
    }
}

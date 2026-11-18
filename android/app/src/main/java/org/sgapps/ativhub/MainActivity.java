package org.sgapps.ativhub;

import android.graphics.Color;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.json.JSONObject;
import org.json.JSONTokener;

public class MainActivity extends BridgeActivity {
    private View bootCover;
    private long lastBackPress;

    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ReportBrowserPlugin.class);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                String url = webView.getUrl();
                if (url != null && url.contains("ativhub.sgapps.org")) {
                    runOnUiThread(() -> {
                        if (bootCover != null) bootCover.setVisibility(View.GONE);
                    });
                }
            }
        });
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    confirmExit();
                    return;
                }
                // Read the live SPA location/history, including Next.js pushState navigation.
                webView.evaluateJavascript(
                    "JSON.stringify({path:location.pathname,depth:history.length})",
                    value -> {
                        try {
                            JSONObject state = new JSONObject((String) new JSONTokener(value).nextValue());
                            String path = state.getString("path");
                            if ("/".equals(path) || "/dashboard".equals(path) || "/login".equals(path)) {
                                confirmExit();
                            } else {
                                lastBackPress = 0;
                                if (webView.canGoBack() || state.getInt("depth") > 1) {
                                    webView.evaluateJavascript("window.history.back()", null);
                                } else {
                                    webView.evaluateJavascript("window.location.replace('/')", null);
                                }
                            }
                        } catch (Exception ignored) {
                            if (webView.canGoBack()) {
                                lastBackPress = 0;
                                webView.goBack();
                            } else {
                                confirmExit();
                            }
                        }
                    }
                );
            }
        });
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.WHITE);
        }
        bootCover = createBootCover();
        ViewGroup content = findViewById(android.R.id.content);
        content.addView(bootCover, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    private void confirmExit() {
        long now = SystemClock.elapsedRealtime();
        if (lastBackPress != 0 && now - lastBackPress <= 2000) {
            finish();
            return;
        }
        lastBackPress = now;
        Toast.makeText(this, "Pressione voltar novamente para sair", Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onPause() {
        lastBackPress = 0;
        super.onPause();
    }

    private View createBootCover() {
        FrameLayout cover = new FrameLayout(this);
        cover.setBackgroundColor(Color.WHITE);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.boot_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        int size = (int) (144 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(size, size, Gravity.CENTER);
        cover.addView(logo, params);
        return cover;
    }
}

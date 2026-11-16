package org.sgapps.ativhub;

import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private View bootCover;

    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
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

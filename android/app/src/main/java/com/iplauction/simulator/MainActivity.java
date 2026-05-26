package com.iplauction.simulator;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int statusBarPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                    "document.documentElement.style.setProperty('--status-bar-height', '" + statusBarPx + "px')",
                    null
                ));
            }
            return insets;
        });
    }
}

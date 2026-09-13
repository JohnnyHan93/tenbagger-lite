package kr.johnny.idt;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    static final String APP_URL = "https://tenbagger-lite.vercel.app/";

    private WebView web;
    private View offline;
    private boolean everLoaded;
    private boolean online = true;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.webview);
        offline = findViewById(R.id.offline);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " IDT-Fold6/2.4.6");

        web.setBackgroundColor(0xFF0C0D0B);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if (host == null) return true;
                boolean ours = host.endsWith("tenbagger-lite.vercel.app")
                    || host.endsWith("vercel.app")
                    || host.endsWith("google.com")
                    || host.endsWith("gstatic.com")
                    || host.endsWith("googleapis.com");
                return !ours;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                everLoaded = true;
                if (online) offline.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !online) {
                    offline.setVisibility(View.VISIBLE);
                }
            }
        });

        connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        online = isOnline();
        applyNetworkState(online, true);
        watchNetwork();
    }

    private void watchNetwork() {
        if (connectivity == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> applyNetworkState(true, false));
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> applyNetworkState(isOnline(), false));
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                boolean now = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                runOnUiThread(() -> applyNetworkState(now, false));
            }
        };
        NetworkRequest req = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
        connectivity.registerNetworkCallback(req, networkCallback);
    }

    private boolean isOnline() {
        if (connectivity == null) return false;
        Network net = connectivity.getActiveNetwork();
        if (net == null) return false;
        NetworkCapabilities caps = connectivity.getNetworkCapabilities(net);
        if (caps == null) return false;
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN));
    }

    private void applyNetworkState(boolean nowOnline, boolean first) {
        boolean was = online;
        online = nowOnline;
        if (web == null) return;
        if (nowOnline) {
            web.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            offline.setVisibility(View.GONE);
            if (!everLoaded || (!was && !first)) {
                web.loadUrl(APP_URL);
            }
        } else {
            web.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
            if (!everLoaded) {
                offline.setVisibility(View.VISIBLE);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (connectivity != null && networkCallback != null) {
            try {
                connectivity.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                /* already unregistered */
            }
        }
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
        }
        super.onDestroy();
    }
}

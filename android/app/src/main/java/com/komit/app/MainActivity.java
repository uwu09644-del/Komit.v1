package com.komit.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Locale;

/**
 * Komit's Android body: a full-screen WebView that runs the same web app as the
 * website (bundled from docs/), served from a secure local address so the camera,
 * workers and storage all work. Adds native ears (SpeechRecognizer), a native
 * voice (TextToSpeech) and saving files, exposed to the page as window.KomitAndroid.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/world/index.html";
    private static final int REQ_PERMS = 1;

    private WebView web;
    private PermissionRequest pendingWebRequest;
    private final Handler main = new Handler(Looper.getMainLooper());

    private SpeechRecognizer recognizer;
    private boolean listening = false;
    private boolean continuous = false;
    private String listenLang = "en-US";

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeech, pendingSpeechLang;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse r = loader.shouldInterceptRequest(request.getUrl());
                if (r != null) {
                    // Cross-origin isolation: lets the AI use several CPU cores (much less lag).
                    Map<String, String> h = new HashMap<>();
                    if (r.getResponseHeaders() != null) h.putAll(r.getResponseHeaders());
                    h.put("Cross-Origin-Opener-Policy", "same-origin");
                    h.put("Cross-Origin-Embedder-Policy", "credentialless");
                    r.setResponseHeaders(h);
                }
                return r;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (hasPermissionsFor(request.getResources())) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebRequest = request;
                        askPermissions();
                    }
                });
            }
        });

        web.addJavascriptInterface(new Bridge(), "KomitAndroid");
        askPermissions();
        web.loadUrl(START_URL);
    }

    // ------------------------------------------------------------------ permissions
    private boolean has(String perm) {
        return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasPermissionsFor(String[] resources) {
        for (String r : resources) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && !has(Manifest.permission.CAMERA)) return false;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && !has(Manifest.permission.RECORD_AUDIO)) return false;
        }
        return true;
    }

    private void askPermissions() {
        List<String> need = new ArrayList<>();
        if (!has(Manifest.permission.CAMERA)) need.add(Manifest.permission.CAMERA);
        if (!has(Manifest.permission.RECORD_AUDIO)) need.add(Manifest.permission.RECORD_AUDIO);
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (pendingWebRequest != null) {
            List<String> ok = new ArrayList<>();
            for (String r : pendingWebRequest.getResources()) {
                if (hasPermissionsFor(new String[]{r})) ok.add(r);
            }
            if (ok.isEmpty()) pendingWebRequest.deny();
            else pendingWebRequest.grant(ok.toArray(new String[0]));
            pendingWebRequest = null;
        }
    }

    // ------------------------------------------------------------------ talking to the page
    private void toPage(String event, String text) {
        final String js = "window.__komitSpeech && window.__komitSpeech(" +
                JSONObject.quote(event) + "," + JSONObject.quote(text == null ? "" : text) + ")";
        main.post(() -> web.evaluateJavascript(js, null));
    }

    // ------------------------------------------------------------------ ears
    private Intent recognizeIntent() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, listenLang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        return i;
    }

    private void listenAgain(long delay) {
        main.postDelayed(() -> {
            if (!listening || recognizer == null) return;
            try { recognizer.startListening(recognizeIntent()); } catch (Exception e) { listening = false; toPage("end", "error"); }
        }, delay);
    }

    private static String first(Bundle b) {
        if (b == null) return "";
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return (r == null || r.isEmpty()) ? "" : r.get(0);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override public void onPartialResults(Bundle partial) {
            if (!continuous) toPage("partial", first(partial));
        }

        @Override public void onResults(Bundle results) {
            String text = first(results);
            if (continuous) {
                if (!text.isEmpty()) toPage("heard", text);
                listenAgain(250);
            } else {
                listening = false;
                toPage("final", text);
                toPage("end", "");
            }
        }

        @Override public void onError(int error) {
            boolean fatal = error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS;
            if (continuous && listening && !fatal) {
                if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                    try { recognizer.cancel(); } catch (Exception ignored) {}
                    listenAgain(1200);
                } else {
                    listenAgain(400);
                }
            } else {
                listening = false;
                toPage("end", fatal ? "not-allowed" : String.valueOf(error));
            }
        }
    };

    private void startListening(String lang, boolean keepListening) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            toPage("end", "no-recognizer");
            return;
        }
        if (!has(Manifest.permission.RECORD_AUDIO)) {
            askPermissions();
            toPage("end", "not-allowed");
            return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(listener);
        } else {
            try { recognizer.cancel(); } catch (Exception ignored) {}
        }
        listenLang = (lang == null || lang.isEmpty()) ? Locale.getDefault().toLanguageTag() : lang;
        continuous = keepListening;
        listening = true;
        recognizer.startListening(recognizeIntent());
    }

    private void stopListening() {
        listening = false;
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) {}
        }
    }

    // ------------------------------------------------------------------ voice
    private void speakNow(String text, String lang) {
        if (tts == null) {
            pendingSpeech = text;
            pendingSpeechLang = lang;
            tts = new TextToSpeech(this, status -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady && pendingSpeech != null) speakNow(pendingSpeech, pendingSpeechLang);
                pendingSpeech = null;
            });
            return;
        }
        if (!ttsReady) { pendingSpeech = text; pendingSpeechLang = lang; return; }
        if (lang != null && !lang.isEmpty()) tts.setLanguage(Locale.forLanguageTag(lang));
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "komit");
    }

    // ------------------------------------------------------------------ files
    private void saveToDownloads(String name, String content) {
        try {
            byte[] data = content.getBytes(StandardCharsets.UTF_8);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("could not create the file");
                try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(data); }
                Toast.makeText(this, "Saved to Downloads: " + name, Toast.LENGTH_LONG).show();
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File f = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(data); }
                Toast.makeText(this, "Saved: " + f.getAbsolutePath(), Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Could not save: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    // ------------------------------------------------------------------ the bridge the page sees
    private class Bridge {
        @JavascriptInterface public void startListening(String lang, boolean keepListening) {
            main.post(() -> MainActivity.this.startListening(lang, keepListening));
        }
        @JavascriptInterface public void stopListening() {
            main.post(MainActivity.this::stopListening);
        }
        @JavascriptInterface public boolean canListen() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }
        @JavascriptInterface public void speak(String text, String lang) {
            main.post(() -> speakNow(text, lang));
        }
        @JavascriptInterface public void stopSpeaking() {
            main.post(() -> { if (tts != null) tts.stop(); });
        }
        @JavascriptInterface public void saveFile(String name, String content) {
            main.post(() -> saveToDownloads(name, content));
        }
    }

    // ------------------------------------------------------------------ lifecycle
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        stopListening();
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }
}

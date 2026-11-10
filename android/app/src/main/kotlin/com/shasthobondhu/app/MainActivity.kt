package com.shasthobondhu.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import androidx.activity.result.contract.ActivityResultContracts
import android.content.ActivityNotFoundException
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.shasthobondhu.app.reminder.PermissionHelper

class MainActivity : AppCompatActivity() {

    companion object {
        const val APP_URL = "https://shasthobondhu-1.ai.studio"
        const val APP_HOST = "shasthobondhu-1.ai.studio"
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorView: LinearLayout
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // ছবি/ফাইল বাছাইয়ের ফলাফল ওয়েব পেজে ফেরত দেয়
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = android.webkit.WebChromeClient.FileChooserParams
                .parseResult(result.resultCode, result.data)
            filePathCallback?.onReceiveValue(uris)
            filePathCallback = null
        }

    // ওয়েবের window.print() কে Android প্রিন্ট/PDF সেভে যুক্ত করে
    inner class PrintBridge {
        @JavascriptInterface
        fun print() {
            runOnUiThread {
                val pm = getSystemService(PRINT_SERVICE) as PrintManager
                val name = "Shasthobondhu_Report"
                pm.print(name, webView.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)

        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        errorView = buildErrorView()

        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        root.addView(progress, FrameLayout.LayoutParams(-1, 8))
        root.addView(errorView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
        }

        webView.addJavascriptInterface(PrintBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme ?: return true
                // কল, SMS, ইমেইল, WhatsApp: ফোনের নিজস্ব অ্যাপে খুলবে
                if (scheme in listOf("tel", "sms", "smsto", "mailto", "whatsapp", "geo")) {
                    openExternal(uri)
                    return true
                }
                val host = uri.host ?: return true
                val internal = host == APP_HOST ||
                    host.endsWith(".firebaseapp.com") ||
                    host.endsWith(".run.app")
                if (internal) return false
                openExternal(uri)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                errorView.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                view.evaluateJavascript("window.print = function(){ AndroidBridge.print(); };", null)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) errorView.visibility = View.VISIBLE
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
            }

            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    fileChooserLauncher.launch(params.createIntent())
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (!PermissionHelper.hasNotificationPermission(this)) {
            PermissionHelper.requestNotificationPermission(this)
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(APP_URL)
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: Exception) {
            android.widget.Toast.makeText(this, "এই লিংক খোলার অ্যাপ পাওয়া যায়নি", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun buildErrorView(): LinearLayout {
        val msg = TextView(this).apply {
            text = "ইন্টারনেট সংযোগ নেই।\nসংযোগ চালু করে আবার চেষ্টা করুন।"
            textSize = 16f
            gravity = android.view.Gravity.CENTER
            setPadding(48, 0, 48, 32)
        }
        val retry = Button(this).apply {
            text = "আবার চেষ্টা করুন"
            setOnClickListener {
                errorView.visibility = View.GONE
                webView.reload()
            }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(android.graphics.Color.parseColor("#F8FAFC"))
            visibility = View.GONE
            addView(msg)
            addView(retry)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

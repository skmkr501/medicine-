package com.shasthobondhu.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
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

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                // নিজের অ্যাপ ও Firebase লগইন পেজ ভিতরেই খুলবে, বাকি লিংক ব্রাউজারে
                val host = uri.host ?: return true
                val internal = host == APP_HOST ||
                    host.endsWith(".firebaseapp.com") ||
                    host.endsWith(".run.app")
                if (internal) return false
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                errorView.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) errorView.visibility = View.VISIBLE
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
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

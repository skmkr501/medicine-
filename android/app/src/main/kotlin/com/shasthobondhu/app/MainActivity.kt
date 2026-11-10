package com.shasthobondhu.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.media.RingtoneManager
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.core.content.IntentCompat
import com.shasthobondhu.app.reminder.AlarmToneStore
import android.widget.Toast
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

class MainActivity : AppCompatActivity(), ToneHost {

    companion object {
        const val APP_URL = "https://shasthobondhu-1.ai.studio"
        const val APP_HOST = "shasthobondhu-1.ai.studio"
        const val AUTH_HOST = "sodium-compass-tbvhw.firebaseapp.com"
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorView: LinearLayout
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var reminderBridge: NativeReminderBridge

    // ফোনের অ্যালার্ম/রিংটোন তালিকা থেকে বাছাইয়ের ফলাফল
    private val ringtonePicker =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == RESULT_OK) {
                val uri: Uri? = result.data?.let {
                    IntentCompat.getParcelableExtra(it, RingtoneManager.EXTRA_RINGTONE_PICKED_URI, Uri::class.java)
                }
                if (uri == null) {
                    AlarmToneStore.reset(this)
                } else if (AlarmToneStore.canPlay(this, uri)) {
                    val title = try {
                        RingtoneManager.getRingtone(this, uri)?.getTitle(this)
                    } catch (e: Exception) {
                        null
                    } ?: "নির্বাচিত টোন"
                    AlarmToneStore.save(this, uri, title)
                } else {
                    Toast.makeText(this, "এই টোনটি বাজানো যাচ্ছে না। \"ফাইল থেকে বাছুন\" ব্যবহার করুন।", Toast.LENGTH_LONG).show()
                }
                notifyToneChanged()
            }
        }

    // ফোনের ফাইল/গান বাছাইয়ের ফলাফল
    private val audioPicker =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) {
                try {
                    contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } catch (_: Exception) {
                }
                if (AlarmToneStore.canPlay(this, uri)) {
                    AlarmToneStore.save(this, uri, queryDisplayName(uri) ?: "নির্বাচিত গান")
                } else {
                    Toast.makeText(this, "এই ফাইলটি বাজানো যাচ্ছে না। অন্য অডিও ফাইল বাছুন।", Toast.LENGTH_LONG).show()
                }
                notifyToneChanged()
            }
        }

    override fun pickSystemTone() {
        val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
            putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
            putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "অ্যালার্ম টোন বাছুন")
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
            putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, AlarmToneStore.getUri(this@MainActivity))
        }
        try {
            ringtonePicker.launch(intent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "এই ফোনে টোন বাছাইয়ের অপশন নেই। \"ফাইল থেকে বাছুন\" ব্যবহার করুন।", Toast.LENGTH_LONG).show()
        }
    }

    override fun pickAudioFile() {
        try {
            audioPicker.launch(arrayOf("audio/*"))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "ফাইল বাছাইয়ের অ্যাপ পাওয়া যায়নি", Toast.LENGTH_LONG).show()
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0)?.substringBeforeLast('.') else null
            }
        } catch (e: Exception) {
            null
        }
    }

    // ওয়েব পেজকে জানায় টোন বদলেছে (ওয়েব: window.addEventListener('alarmToneChanged', ...))
    private fun notifyToneChanged() {
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('alarmToneChanged'));", null
        )
    }

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
        reminderBridge = NativeReminderBridge(this, this)
        webView.addJavascriptInterface(reminderBridge, "AndroidReminders")

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
                val internal = host == APP_HOST || host == AUTH_HOST
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
        reminderBridge.release()
        webView.destroy()
        super.onDestroy()
    }
}

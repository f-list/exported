package net.f_list.fchat

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView

class MainActivity : Activity() {
	private lateinit var webView: WebView

	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		setContentView(R.layout.activity_main)
		webView = findViewById(R.id.webview)
		webView.settings.javaScriptEnabled = true
		webView.settings.mediaPlaybackRequiresUserGesture = false
		webView.loadUrl("file:///android_asset/www/index.html")
		webView.addJavascriptInterface(File(this), "NativeFile")
		webView.addJavascriptInterface(Notifications(this), "NativeNotification")
		webView.webChromeClient = WebChromeClient()
	}

	override fun onNewIntent(intent: Intent) {
		super.onNewIntent(intent)
		if(intent.action == "notification") {
			val data = intent.extras.getString("data")
			webView.evaluateJavascript("document.dispatchEvent(new CustomEvent('notification-clicked',{detail:{data:'$data'}}))", {}) //TODO
		}
	}
}

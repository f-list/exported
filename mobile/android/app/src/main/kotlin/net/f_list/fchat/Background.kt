package net.f_list.fchat

import android.content.Context
import android.content.Intent
import android.webkit.JavascriptInterface

class Background(private val ctx: Context) {
	private val serviceIntent: Intent by lazy { Intent(ctx, BackgroundService::class.java) }


	@JavascriptInterface
	fun start() {
		ctx.startService(serviceIntent)
	}

	@JavascriptInterface
	fun stop() {
		ctx.stopService(serviceIntent)
	}
}
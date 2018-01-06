package net.f_list.fchat

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.AsyncTask
import android.os.Vibrator
import android.webkit.JavascriptInterface
import java.net.URL

class Notifications(private val ctx: Context) {
	@JavascriptInterface
	fun notify(notify: Boolean, title: String, text: String, icon: String, sound: String?, data: String?): Int {
		val soundUri = if(sound != null) Uri.parse("file://android_asset/www/sounds/$sound.mp3") else null
		if(!notify) {
			(ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).vibrate(400)
			return 0
		}
		if(soundUri != null) {
			val player = MediaPlayer()
			val asset = ctx.assets.openFd("www/sounds/$sound.mp3")
			player.setDataSource(asset.fileDescriptor, asset.startOffset, asset.length)
			player.setAudioStreamType(AudioManager.STREAM_NOTIFICATION)
			player.prepare()
			player.start()
		}
		val intent = Intent(ctx, MainActivity::class.java)
		intent.action = "notification"
		intent.putExtra("data", data)
		val notification = Notification.Builder(ctx).setContentTitle(title).setContentText(text).setSmallIcon(R.drawable.ic_notification).setDefaults(Notification.DEFAULT_VIBRATE)
				.setContentIntent(PendingIntent.getActivity(ctx, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT)).setAutoCancel(true)
		object : AsyncTask<String, Void, Bitmap>() {
			override fun doInBackground(vararg args: String): Bitmap {
				val connection = URL(args[0]).openConnection()
				return BitmapFactory.decodeStream(connection.getInputStream())
			}

			override fun onPostExecute(result: Bitmap?) {
				notification.setLargeIcon(result)
				(ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(1, notification.build())
			}
		}.execute(icon)
		return 1
	}

	@JavascriptInterface
	fun requestPermission() {

	}
}
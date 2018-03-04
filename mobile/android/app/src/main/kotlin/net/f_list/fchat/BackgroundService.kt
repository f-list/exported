package net.f_list.fchat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

class BackgroundService : Service() {
	override fun onBind(p0: Intent?): IBinder? {
		return null
	}

	override fun onCreate() {
		super.onCreate()
		val notification = Notification.Builder(this).setContentTitle(getString(R.string.app_name))
				.setContentIntent(PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT))
				.setSmallIcon(R.drawable.ic_notification).setAutoCancel(true).setPriority(Notification.PRIORITY_LOW)
		if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
			val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager;
			manager.createNotificationChannel(NotificationChannel("background", getString(R.string.channel_background), NotificationManager.IMPORTANCE_LOW));
			notification.setChannelId("background");
		}
		startForeground(1, notification.build())
	}

	override fun onDestroy() {
		super.onDestroy()
		stopForeground(true)
	}
}
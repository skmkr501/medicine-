package com.shasthobondhu.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

class ShasthobondhuApp : Application() {

    companion object {
        const val CHANNEL_REMINDERS_ID = "channel_medicine_reminders"
        const val CHANNEL_HIGH_ALARM_ID = "channel_medicine_high_alarm"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            // 1. High Priority Ongoing Medicine Alarm Channel
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()

            val highAlarmChannel = NotificationChannel(
                CHANNEL_HIGH_ALARM_ID,
                "ওষুধ সেবনের অ্যালার্ম (জরুরি)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "সময়মতো ওষুধ সেবনের জরুরি অডিও ও ভাইব্রেশন সংকেত"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 800)
                setSound(alarmSound, audioAttributes)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setBypassDnd(true) // Attempt to bypass Do Not Disturb for critical medical doses
            }

            // 2. Standard Reminder Notification Channel
            val standardChannel = NotificationChannel(
                CHANNEL_REMINDERS_ID,
                "ওষুধের সাধারণ রিমাইন্ডার",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "দৈনিক ওষুধ ও প্রেসক্রিপশন সংক্রান্ত সাধারণ তথ্য"
                enableVibration(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            notificationManager.createNotificationChannel(highAlarmChannel)
            notificationManager.createNotificationChannel(standardChannel)
        }
    }
}

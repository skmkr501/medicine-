package com.shasthobondhu.app.reminder

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.shasthobondhu.app.R
import com.shasthobondhu.app.ShasthobondhuApp

class MedicineAlarmForegroundService : Service() {

    companion object {
        const val TAG = "AlarmForegroundService"
        const val NOTIFICATION_ID = 90210
        const val ACTION_TAKE = "com.shasthobondhu.app.ACTION_TAKE_MEDICINE"
        const val ACTION_SNOOZE = "com.shasthobondhu.app.ACTION_SNOOZE_MEDICINE"
        const val ACTION_DISMISS = "com.shasthobondhu.app.ACTION_DISMISS_ALARM"

        private const val AUTO_STOP_DELAY_MS = 180000L // 3 minutes timeout
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        val action = intent.action
        val reminderId = intent.getStringExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID) ?: ""
        val medicineName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME) ?: "ওষুধ"
        val dosage = intent.getStringExtra(MedicineReminderScheduler.EXTRA_DOSAGE) ?: "১ ডোজ"
        val mealTiming = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEAL_TIMING) ?: ""
        val patientName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_PATIENT_NAME) ?: ""

        when (action) {
            ACTION_TAKE -> {
                Log.i(TAG, "User took medicine: $medicineName")
                stopAlarmPlayback()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SNOOZE -> {
                Log.i(TAG, "User snoozed medicine: $medicineName")
                stopAlarmPlayback()
                // Schedule snooze alarm 10 minutes later
                scheduleSnooze(reminderId, medicineName, dosage, mealTiming, patientName)
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_DISMISS -> {
                Log.i(TAG, "User dismissed alarm for: $medicineName")
                stopAlarmPlayback()
                stopForeground(true)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        // Build and display high-priority persistent foreground notification
        val notification = buildForegroundNotification(reminderId, medicineName, dosage, mealTiming, patientName)
        startForeground(NOTIFICATION_ID, notification)

        // Start ongoing looping sound & vibration
        startAlarmPlayback()

        // Auto-stop after 3 minutes if phone is unattended
        handler.postDelayed({
            stopAlarmPlayback()
            stopForeground(false)
            stopSelf()
        }, AUTO_STOP_DELAY_MS)

        return START_STICKY
    }

    private fun startAlarmPlayback() {
        try {
            val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing alarm sound", e)
        }

        // Start continuous vibration pattern: wait 0ms, vibrate 600ms, sleep 300ms, vibrate 600ms
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 600, 300, 600, 300, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) // 0 means loop
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting vibrator", e)
        }
    }

    private fun stopAlarmPlayback() {
        handler.removeCallbacksAndMessages(null)
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing MediaPlayer", e)
        }

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling vibrator", e)
        }
    }

    private fun scheduleSnooze(reminderId: String, name: String, dosage: String, meal: String, patient: String) {
        val calendar = java.util.Calendar.getInstance().apply {
            add(java.util.Calendar.MINUTE, 10)
        }
        val snoozedReminder = ScheduledReminder(
            reminderId = "snooze_${reminderId}_${System.currentTimeMillis()}",
            medicineId = reminderId,
            medicineName = name,
            dosage = dosage,
            mealTiming = meal,
            patientName = patient,
            timeSlot = "স্নুজ",
            targetHour = calendar.get(java.util.Calendar.HOUR_OF_DAY),
            targetMinute = calendar.get(java.util.Calendar.MINUTE)
        )
        val scheduler = MedicineReminderScheduler(applicationContext)
        scheduler.scheduleReminder(snoozedReminder)
    }

    private fun buildForegroundNotification(
        reminderId: String,
        medicineName: String,
        dosage: String,
        mealTiming: String,
        patientName: String
    ): Notification {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Full Screen Intent to display on top of Lock Screen
        val fullScreenIntent = Intent(this, AlarmAlertActivity::class.java).apply {
            putExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID, reminderId)
            putExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME, medicineName)
            putExtra(MedicineReminderScheduler.EXTRA_DOSAGE, dosage)
            putExtra(MedicineReminderScheduler.EXTRA_MEAL_TIMING, mealTiming)
            putExtra(MedicineReminderScheduler.EXTRA_PATIENT_NAME, patientName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(this, 101, fullScreenIntent, flags)

        // Action 1: Take Now
        val takeIntent = Intent(this, MedicineAlarmForegroundService::class.java).apply {
            action = ACTION_TAKE
            putExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID, reminderId)
            putExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME, medicineName)
        }
        val takePendingIntent = PendingIntent.getService(this, 102, takeIntent, flags)

        // Action 2: Snooze 10 mins
        val snoozeIntent = Intent(this, MedicineAlarmForegroundService::class.java).apply {
            action = ACTION_SNOOZE
            putExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID, reminderId)
            putExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME, medicineName)
        }
        val snoozePendingIntent = PendingIntent.getService(this, 103, snoozeIntent, flags)

        val title = "ওষুধ সেবনের সময় হয়েছে: $medicineName"
        val content = if (patientName.isNotEmpty()) {
            "রোগী: $patientName · ডোজ: $dosage $mealTiming"
        } else {
            "ডোজ: $dosage $mealTiming"
        }

        return NotificationCompat.Builder(this, ShasthobondhuApp.CHANNEL_HIGH_ALARM_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Visible on Lock Screen
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.checkbox_on_background, "গ্রহণ করেছি", takePendingIntent)
            .addAction(android.R.drawable.ic_popup_sync, "১০ মি. স্নুজ", snoozePendingIntent)
            .build()
    }

    override fun onDestroy() {
        stopAlarmPlayback()
        super.onDestroy()
    }
}

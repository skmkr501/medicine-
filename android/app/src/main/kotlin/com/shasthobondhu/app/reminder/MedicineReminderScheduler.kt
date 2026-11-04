package com.shasthobondhu.app.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

class MedicineReminderScheduler(private val context: Context) {

    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    private val storage = ReminderStorage(context)

    companion object {
        const val TAG = "MedicineScheduler"
        const val EXTRA_REMINDER_ID = "extra_reminder_id"
        const val EXTRA_MEDICINE_NAME = "extra_medicine_name"
        const val EXTRA_GENERIC_NAME = "extra_generic_name"
        const val EXTRA_DOSAGE = "extra_dosage"
        const val EXTRA_MEAL_TIMING = "extra_meal_timing"
        const val EXTRA_PATIENT_NAME = "extra_patient_name"
        const val EXTRA_TIME_SLOT = "extra_time_slot"
    }

    /**
     * Checks if exact alarms are permitted on Android 12+ (API 31+)
     */
    fun canScheduleExactAlarms(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
    }

    /**
     * Schedules a medicine reminder using exact AlarmManager timing
     */
    fun scheduleReminder(reminder: ScheduledReminder): Boolean {
        // Save locally for offline reboot resilience
        storage.saveReminder(reminder)

        if (!reminder.isActive) {
            cancelReminder(reminder.reminderId)
            return true
        }

        val triggerTimeMs = computeNextOccurrenceMillis(reminder.targetHour, reminder.targetMinute)

        val intent = Intent(context, MedicineAlarmReceiver::class.java).apply {
            action = "com.shasthobondhu.app.ACTION_TRIGGER_MEDICINE_ALARM"
            putExtra(EXTRA_REMINDER_ID, reminder.reminderId)
            putExtra(EXTRA_MEDICINE_NAME, reminder.medicineName)
            putExtra(EXTRA_GENERIC_NAME, reminder.genericName)
            putExtra(EXTRA_DOSAGE, reminder.dosage)
            putExtra(EXTRA_MEAL_TIMING, reminder.mealTiming)
            putExtra(EXTRA_PATIENT_NAME, reminder.patientName)
            putExtra(EXTRA_TIME_SLOT, reminder.timeSlot)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminder.getRequestCode(),
            intent,
            flags
        )

        try {
            if (canScheduleExactAlarms()) {
                // setAlarmClock provides maximum reliability across manufacturer Doze implementations
                val showIntent = Intent(context, AlarmAlertActivity::class.java).apply {
                    putExtra(EXTRA_REMINDER_ID, reminder.reminderId)
                }
                val infoIntent = PendingIntent.getActivity(
                    context,
                    reminder.getRequestCode() + 1000,
                    showIntent,
                    flags
                )

                val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTimeMs, infoIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                Log.d(TAG, "Exact AlarmClock scheduled for ${reminder.medicineName} at $triggerTimeMs")
            } else {
                // Fallback if exact alarm permission is not yet granted by user in System Settings
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent)
                }
                Log.w(TAG, "Scheduled with fallback (exact alarm permission not granted yet)")
            }
            return true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while scheduling exact alarm: ${e.message}")
            // Fallback to inexact idle alarm
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMs, pendingIntent)
            }
            return false
        }
    }

    /**
     * Cancels an existing scheduled reminder
     */
    fun cancelReminder(reminderId: String) {
        val intent = Intent(context, MedicineAlarmReceiver::class.java).apply {
            action = "com.shasthobondhu.app.ACTION_TRIGGER_MEDICINE_ALARM"
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_NO_CREATE
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId.hashCode() and 0x7FFFFFFF,
            intent,
            flags
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    /**
     * Reschedules all saved active reminders (e.g. after reboot or timezone change)
     */
    fun rescheduleAllReminders() {
        val reminders = storage.getAllReminders()
        Log.i(TAG, "Rescheduling ${reminders.size} offline reminders after system event...")
        for (r in reminders) {
            if (r.isActive) {
                scheduleReminder(r)
            }
        }
    }

    private fun computeNextOccurrenceMillis(targetHour: Int, targetMinute: Int): Long {
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, targetHour)
            set(Calendar.MINUTE, targetMinute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // If the target time for today has already passed, schedule for tomorrow
        if (calendar.timeInMillis <= System.currentTimeMillis()) {
            calendar.add(Calendar.DAY_OF_YEAR, 1)
        }

        return calendar.timeInMillis
    }
}

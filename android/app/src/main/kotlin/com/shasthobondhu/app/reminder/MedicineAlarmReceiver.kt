package com.shasthobondhu.app.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat

class MedicineAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "MedicineAlarmReceiver"
        private const val WAKE_LOCK_TAG = "Shasthobondhu:MedicineAlarmWakeLock"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.i(TAG, "Alarm received while app may be closed: ${intent.action}")

        val reminderId = intent.getStringExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID) ?: return
        val medicineName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME) ?: "ওষুধ"
        val dosage = intent.getStringExtra(MedicineReminderScheduler.EXTRA_DOSAGE) ?: "১ ডোজ"
        val mealTiming = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEAL_TIMING) ?: ""
        val patientName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_PATIENT_NAME) ?: ""
        val timeSlot = intent.getStringExtra(MedicineReminderScheduler.EXTRA_TIME_SLOT) ?: ""

        // 1. Acquire temporary wakelock to ensure CPU remains on until service starts
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
            setReferenceCounted(false)
            acquire(30000) // 30 second safety release timeout
        }

        try {
            // 2. Start Foreground Service for continuous alarm sound + vibration + actions
            val serviceIntent = Intent(context, MedicineAlarmForegroundService::class.java).apply {
                putExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID, reminderId)
                putExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME, medicineName)
                putExtra(MedicineReminderScheduler.EXTRA_DOSAGE, dosage)
                putExtra(MedicineReminderScheduler.EXTRA_MEAL_TIMING, mealTiming)
                putExtra(MedicineReminderScheduler.EXTRA_PATIENT_NAME, patientName)
                putExtra(MedicineReminderScheduler.EXTRA_TIME_SLOT, timeSlot)
            }

            ContextCompat.startForegroundService(context, serviceIntent)

            // 3. Reschedule this recurring reminder for tomorrow
            val storage = ReminderStorage(context)
            if (reminderId.startsWith("snooze_") || reminderId.startsWith("test_alarm_")) {
                // স্নুজ ও টেস্ট অ্যালার্ম একবারই বাজবে, প্রতিদিন পুনরাবৃত্তি হবে না
                storage.removeReminder(reminderId)
            } else {
                val reminder = storage.getAllReminders().find { it.reminderId == reminderId }
                if (reminder != null && reminder.isActive) {
                    val scheduler = MedicineReminderScheduler(context)
                    scheduler.scheduleReminder(reminder)
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start MedicineAlarmForegroundService", e)
        } finally {
            if (wakeLock.isHeld) {
                wakeLock.release()
            }
        }
    }
}

package com.shasthobondhu.app.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootAndRebootReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "BootAndRebootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.i(TAG, "System event received: $action. Initiating offline reminder reschedule...")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                try {
                    val scheduler = MedicineReminderScheduler(context)
                    scheduler.rescheduleAllReminders()
                    Log.i(TAG, "All reminders successfully rescheduled after $action")
                } catch (e: Exception) {
                    Log.e(TAG, "Error rescheduling reminders on system event", e)
                }
            }
        }
    }
}

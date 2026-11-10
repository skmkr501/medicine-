package com.shasthobondhu.app

import android.app.Activity
import android.webkit.JavascriptInterface
import com.shasthobondhu.app.reminder.MedicineReminderScheduler
import com.shasthobondhu.app.reminder.PermissionHelper
import com.shasthobondhu.app.reminder.ReminderStorage
import com.shasthobondhu.app.reminder.ScheduledReminder
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * ওয়েব অ্যাপ (WebView) থেকে নেটিভ Android অ্যালার্ম নিয়ন্ত্রণের সেতু।
 * ওয়েবে ব্যবহার: window.AndroidReminders.syncReminders(JSON.stringify([...]))
 */
class NativeReminderBridge(private val activity: Activity) {

    private val appContext = activity.applicationContext
    private val scheduler = MedicineReminderScheduler(appContext)
    private val storage = ReminderStorage(appContext)

    @JavascriptInterface
    fun isNative(): Boolean = true

    /**
     * পুরো রিমাইন্ডার তালিকা একসাথে সিঙ্ক করে।
     * প্রতিটি আইটেম: {reminderId, medicineId, medicineName, genericName, patientName,
     *                 dosage, mealTiming, timeSlot, hour(0-23), minute(0-59), active}
     * তালিকায় নেই এমন পুরনো রিমাইন্ডার বাতিল হয়ে যায়।
     */
    @JavascriptInterface
    fun syncReminders(json: String): String {
        return try {
            val arr = JSONArray(json)
            val wanted = LinkedHashMap<String, ScheduledReminder>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val hour = o.getInt("hour")
                val minute = o.getInt("minute")
                if (hour !in 0..23 || minute !in 0..59) continue
                val id = o.getString("reminderId")
                wanted[id] = ScheduledReminder(
                    reminderId = id,
                    medicineId = o.optString("medicineId", id),
                    medicineName = o.optString("medicineName", "ওষুধ"),
                    genericName = o.optString("genericName", ""),
                    patientName = o.optString("patientName", ""),
                    dosage = o.optString("dosage", "১ ডোজ"),
                    mealTiming = o.optString("mealTiming", ""),
                    timeSlot = o.optString("timeSlot", ""),
                    targetHour = hour,
                    targetMinute = minute,
                    isActive = o.optBoolean("active", true)
                )
            }

            // ওয়েব থেকে আর নেই এমন রিমাইন্ডার বাতিল (স্নুজ বাদে)
            for (old in storage.getAllReminders()) {
                if (old.reminderId.startsWith("snooze_")) continue
                if (!wanted.containsKey(old.reminderId)) {
                    scheduler.cancelReminder(old.reminderId)
                    storage.removeReminder(old.reminderId)
                }
            }

            for (r in wanted.values) scheduler.scheduleReminder(r)

            JSONObject().put("ok", true).put("count", wanted.size).toString()
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "unknown").toString()
        }
    }

    @JavascriptInterface
    fun clearAll() {
        for (old in storage.getAllReminders()) {
            scheduler.cancelReminder(old.reminderId)
            storage.removeReminder(old.reminderId)
        }
    }

    @JavascriptInterface
    fun getPermissionStatus(): String {
        return JSONObject()
            .put("exactAlarm", PermissionHelper.canScheduleExactAlarms(appContext))
            .put("notifications", PermissionHelper.hasNotificationPermission(appContext))
            .put("batteryUnrestricted", PermissionHelper.isIgnoringBatteryOptimizations(appContext))
            .toString()
    }

    @JavascriptInterface
    fun openExactAlarmSettings() {
        activity.runOnUiThread { PermissionHelper.openExactAlarmSettings(activity) }
    }

    @JavascriptInterface
    fun openBatterySettings() {
        activity.runOnUiThread { PermissionHelper.requestIgnoreBatteryOptimizations(activity) }
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        activity.runOnUiThread { PermissionHelper.requestNotificationPermission(activity) }
    }

    /** ১ মিনিট পর একটি টেস্ট অ্যালার্ম */
    @JavascriptInterface
    fun scheduleTestAlarm(): Boolean {
        val cal = Calendar.getInstance().apply { add(Calendar.MINUTE, 1) }
        val r = ScheduledReminder(
            reminderId = "test_alarm_${System.currentTimeMillis()}",
            medicineId = "med_test",
            medicineName = "টেস্ট অ্যালার্ম",
            dosage = "১টি",
            mealTiming = "",
            timeSlot = "টেস্ট",
            targetHour = cal.get(Calendar.HOUR_OF_DAY),
            targetMinute = cal.get(Calendar.MINUTE)
        )
        return scheduler.scheduleReminder(r)
    }
}

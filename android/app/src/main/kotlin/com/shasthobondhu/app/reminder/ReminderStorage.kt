package com.shasthobondhu.app.reminder

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

class ReminderStorage(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("shasthobondhu_local_reminders", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_REMINDERS = "key_scheduled_reminders_v1"
    }

    @Synchronized
    fun saveReminder(reminder: ScheduledReminder) {
        val all = getAllReminders().toMutableList()
        val existingIndex = all.indexOfFirst { it.reminderId == reminder.reminderId }
        if (existingIndex >= 0) {
            all[existingIndex] = reminder
        } else {
            all.add(reminder)
        }
        persistAll(all)
    }

    @Synchronized
    fun removeReminder(reminderId: String) {
        val all = getAllReminders().filter { it.reminderId != reminderId }
        persistAll(all)
    }

    @Synchronized
    fun getAllReminders(): List<ScheduledReminder> {
        val jsonStr = prefs.getString(KEY_REMINDERS, null) ?: return emptyList()
        val list = mutableListOf<ScheduledReminder>()
        try {
            val array = JSONArray(jsonStr)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    ScheduledReminder(
                        reminderId = obj.getString("reminderId"),
                        medicineId = obj.getString("medicineId"),
                        medicineName = obj.getString("medicineName"),
                        genericName = obj.optString("genericName", ""),
                        patientName = obj.optString("patientName", ""),
                        dosage = obj.getString("dosage"),
                        mealTiming = obj.getString("mealTiming"),
                        timeSlot = obj.getString("timeSlot"),
                        targetHour = obj.getInt("targetHour"),
                        targetMinute = obj.getInt("targetMinute"),
                        isActive = obj.optBoolean("isActive", true),
                        soundUri = if (obj.has("soundUri")) obj.getString("soundUri") else null,
                        vibrate = obj.optBoolean("vibrate", true)
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    private fun persistAll(reminders: List<ScheduledReminder>) {
        val array = JSONArray()
        for (r in reminders) {
            val obj = JSONObject().apply {
                put("reminderId", r.reminderId)
                put("medicineId", r.medicineId)
                put("medicineName", r.medicineName)
                put("genericName", r.genericName)
                put("patientName", r.patientName)
                put("dosage", r.dosage)
                put("mealTiming", r.mealTiming)
                put("timeSlot", r.timeSlot)
                put("targetHour", r.targetHour)
                put("targetMinute", r.targetMinute)
                put("isActive", r.isActive)
                put("soundUri", r.soundUri)
                put("vibrate", r.vibrate)
            }
            array.put(obj)
        }
        prefs.edit().putString(KEY_REMINDERS, array.toString()).apply()
    }
}

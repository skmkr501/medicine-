package com.shasthobondhu.app.reminder

data class ScheduledReminder(
    val reminderId: String,
    val medicineId: String,
    val medicineName: String,
    val genericName: String = "",
    val patientName: String = "",
    val dosage: String,
    val mealTiming: String,
    val timeSlot: String,
    val targetHour: Int,
    val targetMinute: Int,
    val isActive: Boolean = true,
    val soundUri: String? = null,
    val vibrate: Boolean = true
) {
    fun getRequestCode(): Int {
        // Unique deterministic integer hash for PendingIntent
        return reminderId.hashCode() and 0x7FFFFFFF
    }
}

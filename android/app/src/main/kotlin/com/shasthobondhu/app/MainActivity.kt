package com.shasthobondhu.app

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.shasthobondhu.app.reminder.MedicineReminderScheduler
import com.shasthobondhu.app.reminder.PermissionHelper
import com.shasthobondhu.app.reminder.ScheduledReminder
import java.util.Calendar

class MainActivity : AppCompatActivity() {

    private lateinit var statusTextView: TextView
    private lateinit var scheduler: MedicineReminderScheduler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        scheduler = MedicineReminderScheduler(this)
        setupUI()
        checkAndExplainPermissions()
    }

    private fun setupUI() {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(40, 60, 40, 60)
            setBackgroundColor(android.graphics.Color.parseColor("#F8FAFC")) // Slate 50
        }

        val header = TextView(this).apply {
            text = "স্বাস্থ্যবন্ধু — Android নেটিভ রিমাইন্ডার"
            textSize = 20f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setTextColor(android.graphics.Color.parseColor("#0F766E")) // Teal 700
            setPadding(0, 0, 0, 16)
        }

        statusTextView = TextView(this).apply {
            text = getPermissionStatusText()
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#334155"))
            setPadding(0, 0, 0, 32)
        }

        val btnScheduleTest = Button(this).apply {
            text = "১ মিনিট পর টেস্ট অ্যালার্ম শিডিউল করুন"
            setBackgroundColor(android.graphics.Color.parseColor("#0F766E"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                scheduleTestAlarm()
            }
        }

        val btnExactAlarmSettings = Button(this).apply {
            text = "সঠিক সময় অ্যালার্ম পারমিশন (Exact Alarm)"
            setBackgroundColor(android.graphics.Color.parseColor("#475569"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                PermissionHelper.openExactAlarmSettings(this@MainActivity)
            }
        }

        val btnBatterySettings = Button(this).apply {
            text = "ব্যাটারি অপ্টিমাইজেশন নিষ্ক্রিয় করুন (Doze Mode)"
            setBackgroundColor(android.graphics.Color.parseColor("#475569"))
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                PermissionHelper.requestIgnoreBatteryOptimizations(this@MainActivity)
            }
        }

        root.addView(header)
        root.addView(statusTextView)
        root.addView(btnScheduleTest)
        root.addView(btnExactAlarmSettings)
        root.addView(btnBatterySettings)

        setContentView(root)
    }

    private fun checkAndExplainPermissions() {
        if (!PermissionHelper.hasNotificationPermission(this)) {
            Toast.makeText(this, "সময়মতো ওষুধ স্মরণ করিয়ে দিতে নোটিফিকেশন পারমিশন প্রয়োজন", Toast.LENGTH_LONG).show()
            PermissionHelper.requestNotificationPermission(this)
        }

        if (!PermissionHelper.canScheduleExactAlarms(this)) {
            Toast.makeText(this, "ইনসুলিন ও প্রেসারের ওষুধের জন্য সঠিক সময়ের অ্যালার্ম পারমিশন সক্রিয় করুন", Toast.LENGTH_LONG).show()
        }
    }

    private fun scheduleTestAlarm() {
        val calendar = Calendar.getInstance().apply {
            add(Calendar.MINUTE, 1)
        }
        val testReminder = ScheduledReminder(
            reminderId = "test_alarm_${System.currentTimeMillis()}",
            medicineId = "med_test",
            medicineName = "সেক্লো ২০ (Seclo 20)",
            genericName = "Omeprazole 20mg",
            patientName = "বাবা (আব্দুল করিম)",
            dosage = "১টি ক্যাপসুল",
            mealTiming = "খাওয়ার আগে",
            timeSlot = "টেস্ট স্লট",
            targetHour = calendar.get(Calendar.HOUR_OF_DAY),
            targetMinute = calendar.get(Calendar.MINUTE)
        )

        val scheduled = scheduler.scheduleReminder(testReminder)
        if (scheduled) {
            Toast.makeText(this, "টেস্ট অ্যালার্ম ১ মিনিট পর বাজার জন্য নির্ধারিত হয়েছে!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "অ্যালার্ম নির্ধারণে সমস্যা হয়েছে। Exact Alarm পারমিশন চেক করুন।", Toast.LENGTH_LONG).show()
        }
        statusTextView.text = getPermissionStatusText()
    }

    private fun getPermissionStatusText(): String {
        val exactAlarmOk = PermissionHelper.canScheduleExactAlarms(this)
        val notifOk = PermissionHelper.hasNotificationPermission(this)
        val batteryOk = PermissionHelper.isIgnoringBatteryOptimizations(this)

        return """
            সিস্টেম পারমিশন ও স্ট্যাটাস:
            • Exact Alarm পারমিশন: ${if (exactAlarmOk) "✓ সক্রিয় (Exact)" else "✕ নিষ্ক্রিয় (Inexact)"}
            • নোটিফিকেশন পারমিশন: ${if (notifOk) "✓ অনুমোদিত" else "✕ প্রয়োজন"}
            • ব্যাটারি অপ্টিমাইজেশন: ${if (batteryOk) "✓ আনরেস্ট্রিক্টেড" else "⚠ অপ্টিমাইজড (Doze Mode সতর্কতা)"}
            
            অফলাইন স্টোরেজ ও অটো-রিবুট শিডিউলার সক্রিয় আছে।
        """.trimIndent()
    }

    override fun onResume() {
        super.onResume()
        statusTextView.text = getPermissionStatusText()
    }
}

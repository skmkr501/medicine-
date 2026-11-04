package com.shasthobondhu.app.reminder

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.shasthobondhu.app.R

class AlarmAlertActivity : Activity() {

    private var reminderId: String = ""
    private var medicineName: String = ""
    private var dosage: String = ""
    private var mealTiming: String = ""
    private var patientName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configure activity to turn screen on and show on top of Lock Screen
        setupLockScreenDisplay()

        reminderId = intent.getStringExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID) ?: ""
        medicineName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME) ?: "ওষুধ"
        dosage = intent.getStringExtra(MedicineReminderScheduler.EXTRA_DOSAGE) ?: "১ ডোজ"
        mealTiming = intent.getStringExtra(MedicineReminderScheduler.EXTRA_MEAL_TIMING) ?: ""
        patientName = intent.getStringExtra(MedicineReminderScheduler.EXTRA_PATIENT_NAME) ?: ""

        setupAlertLayout()
    }

    private fun setupLockScreenDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun setupAlertLayout() {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 64, 48, 64)
            setBackgroundColor(android.graphics.Color.parseColor("#0F172A")) // Slate 900
            gravity = android.view.Gravity.CENTER
        }

        val titleView = TextView(this).apply {
            text = "ওষুধ সেবনের সময় হয়েছে"
            setTextColor(android.graphics.Color.parseColor("#2DD4BF")) // Teal 400
            textSize = 20f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }

        val medNameView = TextView(this).apply {
            text = medicineName
            setTextColor(android.graphics.Color.WHITE)
            textSize = 26f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 8)
        }

        val detailsView = TextView(this).apply {
            text = "রোগী: $patientName\nডোজ: $dosage ($mealTiming)"
            setTextColor(android.graphics.Color.parseColor("#94A3B8")) // Slate 400
            textSize = 15f
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }

        val btnTake = Button(this).apply {
            text = "✓ গ্রহণ করেছি (Take)"
            setBackgroundColor(android.graphics.Color.parseColor("#0F766E")) // Teal 700
            setTextColor(android.graphics.Color.WHITE)
            setPadding(24, 24, 24, 24)
            setOnClickListener {
                sendServiceAction(MedicineAlarmForegroundService.ACTION_TAKE)
                finish()
            }
        }

        val btnSnooze = Button(this).apply {
            text = "১০ মিনিট পর মনে করান (Snooze)"
            setBackgroundColor(android.graphics.Color.parseColor("#334155")) // Slate 700
            setTextColor(android.graphics.Color.WHITE)
            setPadding(24, 24, 24, 24)
            setOnClickListener {
                sendServiceAction(MedicineAlarmForegroundService.ACTION_SNOOZE)
                finish()
            }
        }

        val btnDismiss = Button(this).apply {
            text = "বাদ দিন (Dismiss)"
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setTextColor(android.graphics.Color.parseColor("#94A3B8"))
            setOnClickListener {
                sendServiceAction(MedicineAlarmForegroundService.ACTION_DISMISS)
                finish()
            }
        }

        root.addView(titleView)
        root.addView(medNameView)
        root.addView(detailsView)
        root.addView(btnTake)
        root.addView(btnSnooze)
        root.addView(btnDismiss)

        setContentView(root)
    }

    private fun sendServiceAction(actionStr: String) {
        val intent = Intent(this, MedicineAlarmForegroundService::class.java).apply {
            action = actionStr
            putExtra(MedicineReminderScheduler.EXTRA_REMINDER_ID, reminderId)
            putExtra(MedicineReminderScheduler.EXTRA_MEDICINE_NAME, medicineName)
        }
        startService(intent)
    }
}

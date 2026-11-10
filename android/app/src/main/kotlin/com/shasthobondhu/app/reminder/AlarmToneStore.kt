package com.shasthobondhu.app.reminder

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri

/**
 * ব্যবহারকারীর বাছাই করা অ্যালার্ম টোন সংরক্ষণ ও বাজানোর সহায়ক।
 * কিছু না বাছলে ফোনের ডিফল্ট অ্যালার্ম টোন বাজবে।
 */
object AlarmToneStore {

    private const val PREFS = "shasthobondhu_alarm_tone"
    private const val KEY_URI = "tone_uri"
    private const val KEY_NAME = "tone_name"
    const val DEFAULT_NAME = "ফোনের ডিফল্ট অ্যালার্ম"

    fun getUri(context: Context): Uri? {
        val s = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_URI, null)
        return s?.let { Uri.parse(it) }
    }

    fun getName(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return if (prefs.getString(KEY_URI, null) == null) DEFAULT_NAME
        else prefs.getString(KEY_NAME, null) ?: "নির্বাচিত টোন"
    }

    fun save(context: Context, uri: Uri, name: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_URI, uri.toString())
            .putString(KEY_NAME, name)
            .apply()
    }

    fun reset(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun defaultUri(): Uri? =
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

    private fun buildPlayer(context: Context, uri: Uri, loop: Boolean): MediaPlayer? {
        val player = MediaPlayer()
        return try {
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
            )
            player.setDataSource(context.applicationContext, uri)
            player.isLooping = loop
            player.prepare()
            player
        } catch (e: Exception) {
            try { player.release() } catch (_: Exception) {}
            null
        }
    }

    /** এই টোনটি আসলে বাজানো যায় কিনা যাচাই করে */
    fun canPlay(context: Context, uri: Uri): Boolean {
        val p = buildPlayer(context, uri, false) ?: return false
        p.release()
        return true
    }

    /**
     * বাছাই করা টোনের প্লেয়ার তৈরি করে; না চললে ফোনের ডিফল্ট অ্যালার্ম টোনে ফিরে যায়।
     * ফেরত দেওয়া প্লেয়ার তৈরি (prepared) অবস্থায়, কলকারী start() করবেন।
     */
    fun createPlayer(context: Context, loop: Boolean): MediaPlayer? {
        val chosen = getUri(context)
        if (chosen != null) {
            buildPlayer(context, chosen, loop)?.let { return it }
        }
        val fallback = defaultUri() ?: return null
        return buildPlayer(context, fallback, loop)
    }
}

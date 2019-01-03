package net.f_list.fchat

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.*

class File(private val ctx: Context) {
	@JavascriptInterface
	fun read(name: String): String? {
		val file = File(ctx.filesDir, name)
		if(!file.exists()) return null
		return file.readText()
	}

	@JavascriptInterface
	fun getSize(name: String) = File(ctx.filesDir, name).length()

	@JavascriptInterface
	fun write(name: String, data: String) {
		FileOutputStream(File(ctx.filesDir, name)).use { it.write(data.toByteArray()) }
	}

	@JavascriptInterface
	fun listFilesN(name: String) = JSONArray(File(ctx.filesDir, name).listFiles().filter { it.isFile }.map { it.name }).toString()

	@JavascriptInterface
	fun listDirectoriesN(name: String) = JSONArray(File(ctx.filesDir, name).listFiles().filter { it.isDirectory }.map { it.name }).toString()

	@JavascriptInterface
	fun ensureDirectory(name: String) {
		File(ctx.filesDir, name).mkdirs()
	}
}
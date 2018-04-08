package net.f_list.fchat

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONStringer
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.CharBuffer
import java.util.*

class Logs(private val ctx: Context) {
	data class IndexItem(val name: String, val index: MutableMap<Int, Long> = HashMap(), val dates: MutableList<Int> = LinkedList())

	private var index: MutableMap<String, IndexItem>? = null
	private var loadedIndex: MutableMap<String, IndexItem>? = null
	private lateinit var baseDir: File
	private var character: String? = null
	private val encoder = Charsets.UTF_8.newEncoder()
	private val decoder = Charsets.UTF_8.newDecoder()
	private val buffer = ByteBuffer.allocateDirect(51000).order(ByteOrder.LITTLE_ENDIAN)

	private fun loadIndex(character: String): MutableMap<String, IndexItem> {
		val files = File(ctx.filesDir, "$character/logs").listFiles({ _, name -> name.endsWith(".idx") })
		val index = HashMap<String, IndexItem>(files.size)
		for(file in files) {
			FileInputStream(file).use { stream ->
				buffer.clear()
				val read = stream.channel.read(buffer)
				buffer.rewind()
				val nameLength = buffer.get().toInt()
				buffer.limit(nameLength + 1)
				val cb = CharBuffer.allocate(nameLength)
				decoder.reset()
				decoder.decode(buffer, cb, true)
				decoder.flush(cb)
				cb.flip()
				val indexItem = IndexItem(cb.toString())
				buffer.limit(read)
				while(buffer.position() < buffer.limit()) {
					val key = buffer.short.toInt()
					indexItem.index[key] = buffer.int.toLong() or (buffer.get().toLong() shl 32)
					indexItem.dates.add(key)
				}
				index[file.nameWithoutExtension] = indexItem
			}
		}
		return index
	}

	@JavascriptInterface
	fun initN(character: String): String {
		baseDir = File(ctx.filesDir, "$character/logs")
		baseDir.mkdirs()
		this.character = character
		index = loadIndex(character)
		loadedIndex = index
		val json = JSONStringer().`object`()
		for(item in index!!)
			json.key(item.key).`object`().key("name").value(item.value.name).key("dates").value(JSONArray(item.value.dates)).endObject()
		return json.endObject().toString()
	}

	@JavascriptInterface
	fun logMessage(key: String, conversation: String, time: Int, type: Int, sender: String, text: String) {
		val day = time / 86400
		val file = File(baseDir, key)
		buffer.clear()
		if(!index!!.containsKey(key)) {
			index!![key] = IndexItem(conversation, HashMap())
			buffer.position(1)
			encoder.encode(CharBuffer.wrap(conversation), buffer, true)
			buffer.put(0, (buffer.position() - 1).toByte())
		}
		val item = index!![key]!!
		if(!item.index.containsKey(day)) {
			buffer.putShort(day.toShort())
			val size = file.length()
			item.index[day] = size
			item.dates.add(day)
			buffer.putInt((size and 0xffffffffL).toInt())
			buffer.put((size shr 32).toByte())
			FileOutputStream(File(baseDir, "$key.idx"), true).use { file ->
				buffer.flip()
				file.channel.write(buffer)
			}
		}
		FileOutputStream(file, true).use { file ->
			buffer.clear()
			buffer.putInt(time)
			buffer.put(type.toByte())
			buffer.position(6)
			encoder.encode(CharBuffer.wrap(sender), buffer, true)
			val senderLength = buffer.position() - 6
			buffer.put(5, senderLength.toByte())
			buffer.position(8 + senderLength)
			encoder.encode(CharBuffer.wrap(text), buffer, true)
			buffer.putShort(senderLength + 6, (buffer.position() - senderLength - 8).toShort())
			buffer.putShort(buffer.position().toShort())
			buffer.flip()
			file.channel.write(buffer)
		}
	}

	@JavascriptInterface
	fun getBacklogN(key: String): String {
		buffer.clear()
		val file = File(baseDir, key)
		if(!file.exists()) return "[]"
		val list = LinkedList<JSONStringer>()
		FileInputStream(file).use { stream ->
			val channel = stream.channel
			val lengthBuffer = ByteBuffer.allocateDirect(4).order(ByteOrder.LITTLE_ENDIAN)
			channel.position(channel.size())
			while(channel.position() > 0 && list.size < 20) {
				lengthBuffer.rewind()
				lengthBuffer.limit(2)
				channel.position(channel.position() - 2)
				channel.read(lengthBuffer)
				lengthBuffer.clear()
				val length = lengthBuffer.int
				channel.position(channel.position() - length - 2)
				buffer.rewind()
				buffer.limit(length)
				channel.read(buffer)
				buffer.rewind()
				val stringer = JSONStringer()
				deserializeMessage(buffer, stringer)
				list.addFirst(stringer)
				channel.position(channel.position() - length)
			}
		}
		val json = StringBuilder("[")
		for(item in list) json.append(item).append(",")
		json.setLength(json.length - 1)
		return json.append("]").toString()
	}

	@JavascriptInterface
	fun getLogsN(character: String, key: String, date: Int): String {
		val offset = loadedIndex!![key]?.index?.get(date) ?: return "[]"
		val json = JSONStringer()
		json.array()
		FileInputStream(File(ctx.filesDir, "$character/logs/$key")).use { stream ->
			val channel = stream.channel
			channel.position(offset)
			while(channel.position() < channel.size()) {
				buffer.clear()
				val oldPosition = channel.position()
				channel.read(buffer)
				buffer.rewind()
				deserializeMessage(buffer, json, date)
				if(buffer.position() == 0) break
				channel.position(oldPosition + buffer.position() + 2)
			}
		}
		return json.endArray().toString()
	}

	@JavascriptInterface
	fun loadIndexN(character: String): String {
		loadedIndex = if(character == this.character) this.index else this.loadIndex(character)
		val json = JSONStringer().`object`()
		for(item in loadedIndex!!)
			json.key(item.key).`object`().key("name").value(item.value.name).key("dates").value(JSONArray(item.value.dates)).endObject()
		return json.endObject().toString()
	}

	@JavascriptInterface
	fun getCharactersN(): String {
		return JSONArray(ctx.filesDir.listFiles().filter { it.isDirectory }.map { it.name }).toString()
	}

	private fun deserializeMessage(buffer: ByteBuffer, json: JSONStringer, checkDate: Int = -1) {
		val date = buffer.int
		if(checkDate != -1 && date / 86400 != checkDate) return
		json.`object`()
		json.key("time")
		json.value(date)
		json.key("type")
		json.value(buffer.get())
		json.key("sender")
		val senderLength = buffer.get()
		buffer.limit(6 + senderLength)
		json.value(decoder.decode(buffer))
		buffer.limit(buffer.capacity())
		val textLength = buffer.short.toInt() and 0xffff
		json.key("text")
		buffer.limit(8 + senderLength + textLength)
		json.value(decoder.decode(buffer))
		json.endObject()
	}
}
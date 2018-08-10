package net.f_list.fchat

import android.content.Context
import android.util.SparseArray
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONStringer
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.CharBuffer
import java.util.*

class Logs(private val ctx: Context) {
	data class IndexItem(val name: String, val index: MutableMap<Int, Int> = LinkedHashMap(), val offsets: MutableList<Long> = ArrayList())

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
					indexItem.index[key] = indexItem.offsets.size
					indexItem.offsets.add(buffer.int.toLong() or (buffer.get().toLong() shl 32))
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
			json.key(item.key).`object`().key("name").value(item.value.name).key("dates").value(JSONArray(item.value.index.keys)).endObject()
		return json.endObject().toString()
	}

	@JavascriptInterface
	fun logMessage(key: String, conversation: String, time: Int, type: Int, sender: String, text: String) {
		val day = time / 86400
		val file = File(baseDir, key)
		buffer.clear()
		if(!index!!.containsKey(key)) {
			index!![key] = IndexItem(conversation)
			buffer.position(1)
			encoder.encode(CharBuffer.wrap(conversation), buffer, true)
			buffer.put(0, (buffer.position() - 1).toByte())
		}
		val item = index!![key]!!
		if(!item.index.containsKey(day)) {
			buffer.putShort(day.toShort())
			val size = file.length()
			item.index[day] = item.offsets.size
			item.offsets.add(size)
			buffer.putInt((size and 0xffffffffL).toInt()).put((size shr 32).toByte())
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
		val indexItem = loadedIndex!![key] ?: return "[]"
		val dateKey = indexItem.index[date] ?: return "[]"
		val json = JSONStringer()
		json.array()
		FileInputStream(File(ctx.filesDir, "$character/logs/$key")).use { stream ->
			val channel = stream.channel
			val start = indexItem.offsets[dateKey]
			val end = if(dateKey >= indexItem.offsets.size - 1) channel.size() else indexItem.offsets[dateKey + 1]
			channel.position(start)
			val buffer = ByteBuffer.allocateDirect((end - start).toInt()).order(ByteOrder.LITTLE_ENDIAN)
			channel.read(buffer)
			buffer.rewind()
			while(buffer.position() < buffer.limit()) {
				deserializeMessage(buffer, json)
				buffer.limit(buffer.capacity())
				buffer.position(buffer.position() + 2)
			}
		}
		return json.endArray().toString()
	}

	@JavascriptInterface
	fun loadIndexN(character: String): String {
		loadedIndex = if(character == this.character) this.index else this.loadIndex(character)
		val json = JSONStringer().`object`()
		for(item in loadedIndex!!)
			json.key(item.key).`object`().key("name").value(item.value.name).key("dates").value(JSONArray(item.value.index.keys)).endObject()
		return json.endObject().toString()
	}

	@JavascriptInterface
	fun getCharactersN(): String {
		return JSONArray(ctx.filesDir.listFiles().filter { it.isDirectory }.map { it.name }).toString()
	}

	@JavascriptInterface
	fun repair() {
		val files = baseDir.listFiles()
		val indexBuffer = ByteBuffer.allocateDirect(7).order(ByteOrder.LITTLE_ENDIAN)
		for(entry in files) {
			if(entry.name.endsWith(".idx")) continue
			RandomAccessFile("$entry.idx", "rw").use { idx ->
				buffer.clear()
				buffer.limit(1)
				idx.channel.read(buffer)
				idx.channel.truncate((buffer.get(0) + 1).toLong())
				idx.channel.position(idx.channel.size())
				RandomAccessFile(entry, "rw").use { file ->
 					var lastDay = 0
					val size = file.channel.size()
					var pos = 0L
					try {
						while(file.channel.position() < size) {
							buffer.clear()
							pos = file.channel.position()
							val read = file.channel.read(buffer)
							var success = false
							buffer.flip()
							while(buffer.remaining() > 10) {
								val offset = buffer.position()
								val day = buffer.int / 86400
								buffer.get()
								val senderLength = buffer.get()
								if(buffer.remaining() < senderLength + 4) break
								buffer.limit(buffer.position() + senderLength)
								decoder.decode(buffer)
								buffer.limit(read)
								val textLength = buffer.short.toInt()
								if(buffer.remaining() < textLength + 2) break
								buffer.limit(buffer.position() + textLength)
								decoder.decode(buffer)
								buffer.limit(read)
								val messageSize = buffer.position() - offset
								if(messageSize != buffer.short.toInt()) throw Exception()

								if(day > lastDay) {
									lastDay = day
									indexBuffer.position(0)
									indexBuffer.putShort(day.toShort())
									indexBuffer.putInt((pos and 0xffffffffL).toInt()).put((pos shr 32).toByte())
									indexBuffer.position(0)
									idx.channel.write(indexBuffer)
								}
								pos += messageSize + 2
								success = true
							}
							if(!success) throw Exception()
							file.channel.position(pos)
						}
					} catch(e: Exception) {
						file.channel.truncate(pos)
					}
				}
			}
		}
	}

	private fun deserializeMessage(buffer: ByteBuffer, json: JSONStringer) {
		val start = buffer.position()
		json.`object`()
		json.key("time")
		json.value(buffer.int)
		json.key("type")
		json.value(buffer.get())
		json.key("sender")
		val senderLength = buffer.get()
		buffer.limit(start + 6 + senderLength)
		json.value(decoder.decode(buffer))
		buffer.limit(buffer.capacity())
		val textLength = buffer.short.toInt() and 0xffff
		json.key("text")
		buffer.limit(start + 8 + senderLength + textLength)
		json.value(decoder.decode(buffer))
		json.endObject()
	}
}
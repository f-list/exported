import Foundation
import WebKit

class File: NSObject, WKScriptMessageHandler {
    let encoder = JSONEncoder()
    let fm = FileManager.default;
    let baseDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!

    override init() {
        super.init();
        try! fm.createDirectory(at: baseDir, withIntermediateDirectories: true, attributes: nil)
    }
    
    func escape(_ str: String) -> String {
        return "'" + str.replacingOccurrences(of: "\'", with: "\\\'").replacingOccurrences(of: "\n", with: "\\n") + "'"
    }
    
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let data = message.body as! [String: AnyObject]
        let key = data["_id"] as! String
        do {
            var result: String?
            switch(data["_type"] as! String) {
            case "readFile":
                result = try readFile(data["name"] as! String, (data["start"] as! NSNumber?)?.uint64Value, data["length"] as! Int?)
            case "writeFile":
                try writeFile(data["name"] as! String, data["data"] as! String)
            case "append":
                try append(data["name"] as! String, data["data"] as! String)
            case "listDirectories":
                result = try listDirectories(data["name"] as! String)
            case "listFiles":
                result = try listFiles(data["name"] as! String)
            case "getSize":
                result = try getSize(data["name"] as! String)
            case "ensureDirectory":
                try ensureDirectory(data["name"] as! String)
            default:
                message.webView!.evaluateJavaScript("nativeError('\(key)',new Error('Unknown message type'))")
                return
            }
            let output = result == nil ? "undefined" : result!;
            message.webView!.evaluateJavaScript("nativeMessage('\(key)',\(output))")
        } catch(let error) {
            message.webView!.evaluateJavaScript("nativeError('\(key)',new Error('File-\(data["_type"]!): \(error.localizedDescription)'))")
        }
    }

    func readFile(_ name: String, _ start: UInt64?, _ length: Int?) throws -> String? {
        let url = baseDir.appendingPathComponent(name, isDirectory: false);
        if(!fm.fileExists(atPath: url.path)) { return nil }
        let fd = try FileHandle(forReadingFrom: url)
        fd.seek(toFileOffset: start ?? 0)
        let data: Data = length != nil ? fd.readData(ofLength: length!) : fd.readDataToEndOfFile();
        fd.closeFile()
        return escape(String(data: data, encoding: .utf8)!)
    }

    func writeFile(_ name: String, _ data: String) throws {
        try data.write(to: baseDir.appendingPathComponent(name, isDirectory: false), atomically: true, encoding: .utf8)
    }

    func append(_ name: String, _ data: String) throws {
        let url = baseDir.appendingPathComponent(name, isDirectory: false);
        if(!fm.fileExists(atPath: url.path)) {
            fm.createFile(atPath: url.path, contents: nil)
        }
        let fd = try FileHandle(forWritingTo: url)
        fd.seekToEndOfFile()
        fd.write(data.data(using: .utf8)!)
        fd.closeFile()
    }

    func listDirectories(_ name: String) throws -> String {
        let dirs = try fm.contentsOfDirectory(at: baseDir.appendingPathComponent(name, isDirectory: true), includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]).filter {
            try $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true
        }.map { $0.lastPathComponent }
        return escape(String(data: try JSONSerialization.data(withJSONObject: dirs), encoding: .utf8)!);
    }

    func listFiles(_ name: String) throws -> String {
        let files = try fm.contentsOfDirectory(at: baseDir.appendingPathComponent(name, isDirectory: true), includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]).filter {
            try $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == false
        }.map { $0.lastPathComponent }
        return escape(String(data: try JSONSerialization.data(withJSONObject: files), encoding: .utf8)!);
    }

    func getSize(_ name: String) throws -> String {
        let path = baseDir.appendingPathComponent(name, isDirectory: false).path;
        if(!fm.fileExists(atPath: path)) { return "0"; }
        return String(try fm.attributesOfItem(atPath: path)[.size] as! UInt64)
    }

    func ensureDirectory(_ name: String) throws {
        try fm.createDirectory(at: baseDir.appendingPathComponent(name, isDirectory: true), withIntermediateDirectories: true, attributes: nil)
    }
}

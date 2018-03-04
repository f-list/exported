import Foundation
import WebKit

class File: NSObject, WKScriptMessageHandler {
    let fm = FileManager.default;
    let baseDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    static let escapeRegex = try! NSRegularExpression(pattern: "([`$\\\\])", options: [.caseInsensitive])

    override init() {
        super.init();
        try! fm.createDirectory(at: baseDir, withIntermediateDirectories: true, attributes: nil)
    }
    
    static func escape(_ str: String) -> String {
        return "`" + escapeRegex.stringByReplacingMatches(in: str, range: NSMakeRange(0, str.count), withTemplate: "\\\\$1") + "`"
    }
    
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let data = message.body as! [String: AnyObject]
        let key = data["_id"] as! String
        do {
            var result: String?
            switch(data["_type"] as! String) {
            case "read":
                result = try read(data["name"] as! String)
            case "write":
                try write(data["name"] as! String, data["data"] as! String)
            case "listDirectories":
                result = try list(data["name"] as! String, directories: true)
            case "listFiles":
                result = try list(data["name"] as! String, directories: false)
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

    func read(_ name: String) throws -> String? {
        let url = baseDir.appendingPathComponent(name, isDirectory: false)
        if(!fm.fileExists(atPath: url.path)) { return nil; }
        return File.escape(try String(contentsOf: url, encoding: .utf8))
    }

    func write(_ name: String, _ data: String) throws {
        try data.write(to: baseDir.appendingPathComponent(name, isDirectory: false), atomically: true, encoding: .utf8)
    }

    func list(_ name: String, directories: Bool) throws -> String {
        let url = baseDir.appendingPathComponent(name, isDirectory: true)
        let entries = try fm.contentsOfDirectory(at: url, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]).filter {
            try $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == directories
        }.map { $0.lastPathComponent }
        return String(data: try JSONSerialization.data(withJSONObject: entries), encoding: .utf8)!;
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

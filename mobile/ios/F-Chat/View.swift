import Foundation

import WebKit

class View: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let data = message.body as! [String: AnyObject]
        let key = data["_id"] as! String
        switch(data["_type"] as! String) {
        case "setTheme":
            setTheme(data["theme"] as! String)
        default:
            message.webView!.evaluateJavaScript("nativeError('\(key)',new Error('Unknown message type'))")
            return
        }
        message.webView!.evaluateJavaScript("nativeMessage('\(key)',undefined)")
    }
    
    func setTheme(_ theme: String) {
        UIApplication.shared.statusBarStyle = theme == "light" ? .default : .lightContent;
    }
}

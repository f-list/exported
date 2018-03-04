import UIKit
import WebKit
import AVFoundation

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    var webView: WKWebView!
    let profileRegex = try! NSRegularExpression(pattern: "^https?://(www\\.)?f-list.net/c/(.+)/?#?", options: [.caseInsensitive])

    override func loadView() {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        let scriptPath = Bundle.main.path(forResource: "native", ofType: "js")
        let js = try! String(contentsOfFile: scriptPath!)
        let userScript = WKUserScript(source: js, injectionTime: WKUserScriptInjectionTime.atDocumentStart, forMainFrameOnly: false)
        controller.addUserScript(userScript)
        controller.add(File(), name: "File")
        controller.add(Notification(), name: "Notification")
        controller.add(Background(), name: "Background")
        controller.add(Logs(), name: "Logs")
        config.userContentController = controller
        config.mediaTypesRequiringUserActionForPlayback = [.video]
        config.setValue(true, forKey: "_alwaysRunsAtForegroundPriority")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        view = webView
        UIApplication.shared.statusBarStyle = .lightContent
        (UIApplication.shared.value(forKey: "statusBar") as! UIView).backgroundColor = UIColor(white: 0, alpha: 0.5)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let htmlPath = Bundle.main.path(forResource: "www/index", ofType: "html")
        let url = URL(fileURLWithPath: htmlPath!, isDirectory: false)
        webView.loadFileURL(url, allowingReadAccessTo: url)
        webView.scrollView.isScrollEnabled = false
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: "OK"), style: .default, handler: { (action) in completionHandler() }))
        present(alertController, animated: true, completion: nil)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: "OK"), style: .default, handler: { (action) in completionHandler(true) }))
        alertController.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: "Cancel"), style: .cancel, handler: { (action) in completionHandler(false) }))
        present(alertController, animated: true, completion: nil)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let url = navigationAction.request.url!.absoluteString
        let match = profileRegex.matches(in: url, range: NSRange(location: 0, length: url.count))
        if(match.count == 1) {
            let char = url[Range(match[0].range(at: 2), in: url)!].removingPercentEncoding!;
            webView.evaluateJavaScript("document.dispatchEvent(new CustomEvent('open-profile',{detail:'\(char)'}))", completionHandler: nil)
            return nil
        }
        UIApplication.shared.open( navigationAction.request.url!)
        return nil
    }
}


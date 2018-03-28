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
        NotificationCenter.default.addObserver(self, selector: #selector(ViewController.keyboardWillShow), name: NSNotification.Name.UIKeyboardWillShow, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(ViewController.keyboardWillHide), name: NSNotification.Name.UIKeyboardWillHide, object: nil)
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

    @objc func keyboardWillShow(notification: NSNotification) {
        let info = notification.userInfo!
        let frame = webView.frame
        let newHeight = view.window!.frame.height - (info[UIKeyboardFrameEndUserInfoKey] as! NSValue).cgRectValue.height
        UIView.animate(withDuration: (info[UIKeyboardAnimationDurationUserInfoKey] as! NSNumber).doubleValue, animations: {
            self.webView.scrollView.bounds = CGRect(x: 0, y: 0, width: frame.width, height: newHeight)
        }, completion: { (_: Bool) in self.webView.evaluateJavaScript("window.dispatchEvent(new Event('resize'))", completionHandler: nil) })
    }

    @objc func keyboardWillHide(notification: NSNotification) {
        let info = notification.userInfo!
        let frame = webView.scrollView.bounds
        let newHeight = frame.height + (info[UIKeyboardFrameEndUserInfoKey] as! NSValue).cgRectValue.height
        UIView.animate(withDuration: (info[UIKeyboardAnimationDurationUserInfoKey] as! NSNumber).doubleValue, animations: {
            self.webView.scrollView.bounds = CGRect(x: 0, y: 0, width: frame.width, height: newHeight)
        }, completion: { (_: Bool) in self.webView.evaluateJavaScript("window.dispatchEvent(new Event('resize'))", completionHandler: nil) })
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
        let url = navigationAction.request.url!
        let str = url.absoluteString
        if(url.scheme == "data") {
            let start = str.index(of: ",")!
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(str[str.index(str.startIndex, offsetBy: 5)..<start].removingPercentEncoding!)
            try! str.suffix(from: str.index(after: start)).removingPercentEncoding!.write(to: file, atomically: false, encoding: .utf8)
            self.present(UIActivityViewController(activityItems: [file], applicationActivities: nil), animated: true, completion: nil)
            return nil
        }
        let match = profileRegex.matches(in: str, range: NSRange(location: 0, length: str.count))
        if(match.count == 1) {
            let char = str[Range(match[0].range(at: 2), in: str)!].removingPercentEncoding!;
            webView.evaluateJavaScript("document.dispatchEvent(new CustomEvent('open-profile',{detail:'\(char)'}))", completionHandler: nil)
            return nil
        }
        UIApplication.shared.open(navigationAction.request.url!)
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(.cancel)
    }
}


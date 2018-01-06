import UIKit
import WebKit
import AVFoundation

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    var webView: WKWebView!
    var player = try! AVAudioPlayer(contentsOf: Bundle.main.url(forResource: "www/sounds/login", withExtension: "wav")!)
    
    override func loadView() {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        let scriptPath = Bundle.main.path(forResource: "native", ofType: "js")
        let js = try! String(contentsOfFile: scriptPath!)
        let userScript = WKUserScript(source: js, injectionTime: WKUserScriptInjectionTime.atDocumentStart, forMainFrameOnly: false)
        controller.addUserScript(userScript)
        controller.add(File(), name: "File")
        controller.add(Notification(), name: "Notification")
        controller.add(View(), name: "View")
        config.userContentController = controller
        config.mediaTypesRequiringUserActionForPlayback = [.video]
        config.setValue(true, forKey: "_alwaysRunsAtForegroundPriority")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        view = webView
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        let htmlPath = Bundle.main.path(forResource: "www/index", ofType: "html")
        let url = URL(fileURLWithPath: htmlPath!, isDirectory: false)
        webView.loadFileURL(url, allowingReadAccessTo: url)
        webView.navigationDelegate = self
        webView.scrollView.isScrollEnabled = false
        let session = AVAudioSession.sharedInstance();
        try! session.setCategory(AVAudioSessionCategoryPlayback, with: .mixWithOthers)
        player.volume = 0
        player.numberOfLoops = -1;
        player.play()
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }
    
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .actionSheet)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: "OK"), style: .default, handler: { (action) in completionHandler() }))
        present(alertController, animated: true, completion: nil)
    }
    
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alertController = UIAlertController(title: nil, message: message, preferredStyle: .actionSheet)
        alertController.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: "OK"), style: .default, handler: { (action) in completionHandler(true) }))
        alertController.addAction(UIAlertAction(title: NSLocalizedString("Cancel", comment: "Cancel"), style: .cancel, handler: { (action) in completionHandler(false) }))
        present(alertController, animated: true, completion: nil)
    }
}


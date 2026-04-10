import os.log
import UIKit
import FirebaseCore
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
/// Evita il crash in `FIRInstallations validateAPIKey:` quando `GoogleService-Info.plist`
/// è ancora il placeholder (da sostituire con il file scaricato da Firebase Console per `org.resta.ai`).
private func isFirebaseConfiguredInPlist() -> Bool {
  guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
        let plist = NSDictionary(contentsOfFile: path) as? [String: Any],
        let apiKey = plist["API_KEY"] as? String,
        let projectId = plist["PROJECT_ID"] as? String
  else {
    return false
  }
  if apiKey.contains("REPLACE_ME") { return false }
  if projectId.hasPrefix("replace-with") { return false }
  if !apiKey.hasPrefix("AIza") { return false }
  return true
}

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if isFirebaseConfiguredInPlist() {
      FirebaseApp.configure()
    } else {
#if DEBUG
      print(
        "[Firebase] GoogleService-Info.plist non valido: scarica da Firebase Console "
          + "(progetto iOS con bundle org.resta.ai) e sostituisci il file. Push disabilitate fino ad allora."
      )
#endif
    }

    // BackgroundTasks: registrare gli handler il prima possibile entro `didFinishLaunching` (prima del lavoro pesante),
    // vedi https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler
    os_log(.info, log: OSLog(subsystem: "org.resta.ai", category: "AppDelegate"), "[BGTask] register + initial schedule")
    BackgroundTaskManager.shared.registerBackgroundTask()
    BackgroundTaskManager.shared.scheduleAppRefresh()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "DietAdherenceApp",
      in: window,
      launchOptions: launchOptions
    )

    //LocationTriggerManager.shared.start()

    return true
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    // Ripianifica il prossimo `BGAppRefreshTask` quando l’app torna attiva (pattern descritto in
    // https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app )
    BackgroundTaskManager.shared.scheduleAppRefresh()
    LocationTriggerManager.shared.ensureMonitoringForCurrentAuthorization()
    ContextInferenceCoordinator.shared.retryQueuedRequests()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

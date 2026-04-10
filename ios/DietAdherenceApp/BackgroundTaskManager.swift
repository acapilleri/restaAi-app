import BackgroundTasks
import Foundation
import os.log

// Riferimento: https://developer.apple.com/documentation/backgroundtasks
// Debug su device: https://developer.apple.com/documentation/backgroundtasks/starting-and-terminating-tasks-during-development
// e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.resta.ai.sensor.refresh"]

/// `BGAppRefreshTask` per inferenza contesto/sensori. Identificatore in `Info.plist` → `BGTaskSchedulerPermittedIdentifiers`.
final class BackgroundTaskManager {
  static let shared = BackgroundTaskManager()

  private let taskIdentifier = "com.resta.ai.sensor.refresh"
  private let log = OSLog(subsystem: "org.resta.ai", category: "BackgroundTask")
  private var didRegister = false
  /// Evita di ripetere lo stesso avviso: su Simulator `submit` fallisce sempre con `.unavailable` (doc Apple).
  private var didLogSimulatorSubmitUnavailable = false

  /// Log dell’istante nel fuso del device (`Date.description` di default è UTC e confonde).
  private static let earliestBeginDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = .current
    f.dateFormat = "yyyy-MM-dd HH:mm:ss XXX"
    return f
  }()

  private init() {}

  func registerBackgroundTask() {
    guard !didRegister else {
      os_log(.info, log: log, "[BGTask] registerBackgroundTask skipped — already registered")
      return
    }
    didRegister = true
    os_log(.info, log: log, "[BGTask] registerBackgroundTask called id=%{public}@", taskIdentifier)

    BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { [weak self] task in
      guard let self else {
        os_log(.error, log: OSLog(subsystem: "org.resta.ai", category: "BackgroundTask"), "[BGTask] BGTask handler — manager deallocated")
        task.setTaskCompleted(success: false)
        return
      }
      os_log(.info, log: self.log, "[BGTask] BGTask handler entered")
      guard let refresh = task as? BGAppRefreshTask else {
        os_log(.error, log: self.log, "[BGTask] unexpected task type — setTaskCompleted(success: false)")
        task.setTaskCompleted(success: false)
        return
      }
      self.handleAppRefresh(task: refresh)
    }
  }

  func scheduleAppRefresh() {
#if targetEnvironment(simulator)
    if !didLogSimulatorSubmitUnavailable {
      didLogSimulatorSubmitUnavailable = true
      os_log(
        .info,
        log: log,
        "[BGTask] scheduleAppRefresh: Simulatore — BGTaskScheduler.submit non disponibile (code=unavailable). Registrazione ok; prova su device fisico."
      )
    }
    return
#endif
    let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
    // `earliestBeginDate` è solo un suggerimento al sistema, non una garanzia (doc BGTaskRequest).
#if DEBUG
    let delay: TimeInterval = 60
#else
    let delay: TimeInterval = 15 * 60
#endif
    request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
    let earliestLocal: String
    if let d = request.earliestBeginDate {
      earliestLocal = Self.earliestBeginDateFormatter.string(from: d)
    } else {
      earliestLocal = "nil"
    }
    os_log(
      .info,
      log: log,
      "[BGTask] scheduleAppRefresh earliestBegin(local)=%{public}@ delaySec=%{public}@",
      earliestLocal,
      String(format: "%.0f", delay)
    )
    do {
      try BGTaskScheduler.shared.submit(request)
      os_log(.info, log: log, "[BGTask] scheduleAppRefresh submit ok")
    } catch {
      if let schedulerError = error as? BGTaskScheduler.Error {
        os_log(
          .error,
          log: log,
          "[BGTask] schedule failed BGTaskScheduler.Error code=%{public}d %{public}@",
          schedulerError.errorCode,
          String(describing: schedulerError)
        )
      } else {
        let ns = error as NSError
        os_log(
          .error,
          log: log,
          "[BGTask] schedule failed domain=%{public}@ code=%{public}d %{public}@",
          ns.domain,
          ns.code,
          String(describing: error)
        )
      }
    }
  }

  private func handleAppRefresh(task: BGAppRefreshTask) {
    let lock = NSLock()
    var completed = false

    func finish(success: Bool) {
      lock.lock()
      defer { lock.unlock() }
      guard !completed else {
        os_log(.info, log: log, "[BGTask] setTaskCompleted skipped — already completed")
        return
      }
      completed = true
      // Ripianifica prima di `setTaskCompleted`, così il prossimo refresh è in coda mentre si chiude il task corrente.
      scheduleAppRefresh()
      os_log(.info, log: log, "[BGTask] setTaskCompleted called success=%{public}@", String(success))
      task.setTaskCompleted(success: success)
    }

    task.expirationHandler = {
      os_log(.error, log: self.log, "[BGTask] expiration handler called")
      NotificationManager.shared.logBackgroundTaskEvent(
        outcome: "expired",
        detail: "BGAppRefreshTask expired before inference completed"
      )
      finish(success: false)
    }

    os_log(.info, log: log, "[BGTask] inference started (runInferenceIfNeeded)")
    ContextInferenceCoordinator.shared.runInferenceIfNeeded { success in
      os_log(.info, log: self.log, "[BGTask] inference completion called (coordinator → BGTask) success=%{public}@", String(success))
      NotificationManager.shared.logBackgroundTaskEvent(
        outcome: success ? "completed" : "failed",
        detail: success ? "Inference pipeline finished" : "Inference pipeline reported failure"
      )
      finish(success: success)
    }
  }
}

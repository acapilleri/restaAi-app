import Foundation
import UserNotifications
import os.log

/// One JSON object per line in `eating_risk_notification_log.jsonl` (Application Support).
private struct NotificationScheduleLogEntry: Codable {
  let loggedAtIso: String
  let notificationId: String
  let score: Double
  let title: String
  let body: String
  let source: String
  let outcome: String
  let error: String?
}

final class NotificationManager: NSObject {
  static let shared = NotificationManager()

  private let log = OSLog(subsystem: "org.resta.ai", category: "NotificationManager")
  private var didRequestPermission = false
  private let logFileQueue = DispatchQueue(label: "org.resta.ai.notification.schedule.log", qos: .utility)
  private let logFileName = "eating_risk_notification_log.jsonl"
  private let maxLogLines = 400

  /// Timestamp per JSONL: orario del dispositivo + offset (es. `+02:00`), non UTC con `Z`.
  private func scheduleLogTimestampNow() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"
    return f.string(from: Date())
  }

  private override init() {
    super.init()
    UNUserNotificationCenter.current().delegate = self
  }

  func requestPermission(completion: ((Bool) -> Void)? = nil) {
    if didRequestPermission {
      completion?(true)
      return
    }
    didRequestPermission = true
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
      if let error {
        os_log(.error, log: self.log, "Notification permission error: %{public}@", String(describing: error))
      } else {
        os_log(.info, log: self.log, "Notification permission granted=%{public}d", granted)
      }
      DispatchQueue.main.async {
        completion?(granted)
      }
    }
  }

  func showEatingRiskNotification(score: Double, title: String? = nil, body: String? = nil) {
    let content = UNMutableNotificationContent()
    let resolvedTitle = title ?? "Attenzione"
    let resolvedBody =
      body ?? "Sembra che tu stia per mangiare fuori piano. Vuoi restare nel tuo piano?"
    content.title = resolvedTitle
    content.body = resolvedBody
    content.sound = .default
    content.userInfo = ["score": score, "source": "nativeContextInference"]

    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    let id = UUID().uuidString
    let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

    UNUserNotificationCenter.current().add(request) { error in
      if let error {
        os_log(.error, log: self.log, "Failed to schedule notification: %{public}@", String(describing: error))
        self.appendScheduleLog(
          notificationId: id,
          score: score,
          title: resolvedTitle,
          body: resolvedBody,
          outcome: "schedule_failed",
          error: String(describing: error)
        )
      } else {
        os_log(.info, log: self.log, "Scheduled eating-risk notification id=%{public}@ score=%.3f", id, score)
        self.appendScheduleLog(
          notificationId: id,
          score: score,
          title: resolvedTitle,
          body: resolvedBody,
          outcome: "scheduled",
          error: nil
        )
      }
    }
  }

  /// Registra nel log notifiche (`eating_risk_notification_log.jsonl`) ogni esecuzione del BGAppRefreshTask.
  func logBackgroundTaskEvent(outcome: String, detail: String) {
    let id = "bg-task-\(UUID().uuidString)"
    appendScheduleLog(
      notificationId: id,
      score: 0,
      title: "BG refresh",
      body: detail,
      outcome: outcome,
      error: nil,
      source: "backgroundTask"
    )
    os_log(.info, log: log, "[BGTask] notification log: outcome=%{public}@ detail=%{public}@", outcome, detail)
  }

  /// Persists inference outcomes even when no notification is sent.
  func logInferenceOutcome(score: Double, title: String? = nil, body: String? = nil, outcome: String) {
    let resolvedTitle = title ?? "InferenceOnly"
    let resolvedBody = body ?? "No notification scheduled"
    let id = "inference-\(UUID().uuidString)"
    appendScheduleLog(
      notificationId: id,
      score: score,
      title: resolvedTitle,
      body: resolvedBody,
      outcome: outcome,
      error: nil
    )
  }

  /// Full JSONL text for debugging / export.
  func readScheduleLogContents() -> String {
    logFileQueue.sync {
      guard let url = scheduleLogFileURL(),
            let text = try? String(contentsOf: url, encoding: .utf8) else {
        return ""
      }
      return text
    }
  }

  func clearScheduleLog(completion: @escaping (Error?) -> Void) {
    logFileQueue.async {
      do {
        if let url = self.scheduleLogFileURL(), FileManager.default.fileExists(atPath: url.path) {
          try FileManager.default.removeItem(at: url)
        }
        DispatchQueue.main.async { completion(nil) }
      } catch {
        DispatchQueue.main.async { completion(error) }
      }
    }
  }

  private func scheduleLogFileURL() -> URL? {
    guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
      return nil
    }
    let dir = base.appendingPathComponent("DietAdherenceApp", isDirectory: true)
    if !FileManager.default.fileExists(atPath: dir.path) {
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    return dir.appendingPathComponent(logFileName, isDirectory: false)
  }

  private func appendScheduleLog(
    notificationId: String,
    score: Double,
    title: String,
    body: String,
    outcome: String,
    error: String?,
    source: String = "nativeContextInference"
  ) {
    logFileQueue.async {
      guard let url = self.scheduleLogFileURL() else { return }
      let entry = NotificationScheduleLogEntry(
        loggedAtIso: self.scheduleLogTimestampNow(),
        notificationId: notificationId,
        score: score,
        title: title,
        body: body,
        source: source,
        outcome: outcome,
        error: error
      )
      guard let data = try? JSONEncoder().encode(entry),
            var line = String(data: data, encoding: .utf8) else {
        return
      }
      line.removeAll { $0 == "\n" || $0 == "\r" }

      var existing = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
      existing.append(line)
      existing.append("\n")

      var lines = existing.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
      if lines.count > self.maxLogLines {
        lines = Array(lines.suffix(self.maxLogLines))
        existing = lines.joined(separator: "\n")
        if !existing.isEmpty {
          existing.append("\n")
        }
      }

      try? existing.write(to: url, atomically: true, encoding: .utf8)
    }
  }
}

// MARK: - Foreground presentation

extension NotificationManager: UNUserNotificationCenterDelegate {
  /// Senza questo, con l’app aperta le notifiche locali non mostrano banner (restano solo in Notification Center).
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge, .list])
  }
}

import CoreLocation
import Foundation
import UIKit
import os.log

/// When inference is triggered by a POI geofence (enter/exit), carried through to JS metadata.
struct GeofenceInferenceContext {
  enum GeofenceEvent: String {
    case enter
    case exit
    case arrival
    case departure
  }

  let poiId: String
  let poiName: String?
  let event: GeofenceEvent
  let visitArrivalSince1970: Double?
  let visitDepartureSince1970: Double?

  init(
    poiId: String,
    poiName: String?,
    event: GeofenceEvent,
    visitArrivalSince1970: Double? = nil,
    visitDepartureSince1970: Double? = nil
  ) {
    self.poiId = poiId
    self.poiName = poiName
    self.event = event
    self.visitArrivalSince1970 = visitArrivalSince1970
    self.visitDepartureSince1970 = visitDepartureSince1970
  }
}

struct ContextFeatures {
  let latitude: Double
  let longitude: Double
  let speed: Double
  let hourOfDay: Int
  let isForeground: Bool
}

private struct PendingInferenceRequest: Codable {
  let requestId: String
  let timestampIso: String
  let latitude: Double
  let longitude: Double
  let speed: Double
  let hourOfDay: Int
  let isForeground: Bool
  let poiId: String?
  let poiName: String?
  let geofenceEvent: String?
  let visitArrival: Double?
  let visitDeparture: Double?
}

final class ContextInferenceCoordinator {
  static let shared = ContextInferenceCoordinator()

  private let log = OSLog(subsystem: "org.resta.ai", category: "ContextInference")
  private let inferenceQueue = DispatchQueue(label: "org.resta.ai.context.inference", qos: .utility)
  private let queueStoreKey = "nativePendingInferenceRequests"
  private let maxQueueSize = 20
  private let queueTtlSeconds: TimeInterval = 15 * 60
  private let isoFormatter = ISO8601DateFormatter()

  private var pendingById: [String: PendingInferenceRequest] = [:]

  /// Completamento BGTask: atteso quando `performInference` è invocato con `backgroundCompletion`.
  private var backgroundInferenceRequestId: String?
  private var backgroundInferenceCompletion: ((Bool) -> Void)?
  private var backgroundInferenceTimeoutWorkItem: DispatchWorkItem?
  private let backgroundInferenceTimeoutSeconds: TimeInterval = 25

  private init() {}

  func runInference(location: CLLocation, geofence: GeofenceInferenceContext? = nil) {
    inferenceQueue.async { [weak self] in
      self?.performInference(location: location, geofence: geofence, backgroundCompletion: nil)
    }
  }

  /// Entry point per BGTask — stesso flusso di `runInference` + emit verso JS; notifiche solo in `handleJSInferenceResult`.
  func runInferenceIfNeeded(completion: @escaping (Bool) -> Void) {
    // `BGAppRefreshTask` ha budget molto breve: `requestLocation()` in background spesso supera il tempo e scatta `expirationHandler`.
    // 1) Se c’è una fix recente, usala subito. 2) Altrimenti one-shot con timeout corto.
    let tempManager = CLLocationManager()
    if let cached = tempManager.location {
      let age = abs(cached.timestamp.timeIntervalSinceNow)
      if age < 5 * 60, cached.horizontalAccuracy > 0, cached.horizontalAccuracy <= 2_000 {
        os_log(
          .info,
          log: log,
          "[BGTask] runInferenceIfNeeded — cached location age=%.1fs acc=%.0fm",
          age,
          cached.horizontalAccuracy
        )
        inferenceQueue.async { [weak self] in
          self?.performInference(location: cached, geofence: nil, backgroundCompletion: completion)
        }
        return
      }
    }

    os_log(.info, log: log, "[BGTask] runInferenceIfNeeded — requesting one-shot location (timeout 12s)")
    let fetcher = OneShotLocationFetcher(timeoutSeconds: 12) { [weak self] result in
      guard let self else {
        os_log(.error, log: OSLog(subsystem: "org.resta.ai", category: "ContextInference"), "[BGTask] runInferenceIfNeeded aborted — coordinator deallocated")
        os_log(.info, log: OSLog(subsystem: "org.resta.ai", category: "ContextInference"), "[BGTask] inference completion called success=0 reason=coordinator_deallocated")
        completion(false)
        return
      }
      switch result {
      case .failure(let error):
        os_log(.error, log: self.log, "[BGTask] location failed: %{public}@", String(describing: error))
        os_log(.info, log: self.log, "[BGTask] inference completion called success=0 reason=location_failure")
        completion(false)
      case .success(let location):
        os_log(
          .info,
          log: self.log,
          "[BGTask] location ok lat=%.5f lon=%.5f — enqueue performInference",
          location.coordinate.latitude,
          location.coordinate.longitude
        )
        self.inferenceQueue.async {
          self.performInference(location: location, geofence: nil, backgroundCompletion: completion)
        }
      }
    }
    fetcher.requestLocation()
  }

  private func performInference(location: CLLocation, geofence: GeofenceInferenceContext?, backgroundCompletion: ((Bool) -> Void)? = nil) {
    let calendar = Calendar.current
    let hour = calendar.component(.hour, from: Date())
    let isForeground: Bool = {
      if Thread.isMainThread {
        return UIApplication.shared.applicationState == .active
      }
      return DispatchQueue.main.sync {
        UIApplication.shared.applicationState == .active
      }
    }()

    let speed = location.speed >= 0 ? location.speed : 0

    let features = ContextFeatures(
      latitude: location.coordinate.latitude,
      longitude: location.coordinate.longitude,
      speed: speed,
      hourOfDay: hour,
      isForeground: isForeground
    )

    let requestId = UUID().uuidString
    let payload = PendingInferenceRequest(
      requestId: requestId,
      timestampIso: isoFormatter.string(from: Date()),
      latitude: features.latitude,
      longitude: features.longitude,
      speed: features.speed,
      hourOfDay: features.hourOfDay,
      isForeground: features.isForeground,
      poiId: geofence?.poiId,
      poiName: geofence?.poiName,
      geofenceEvent: geofence?.event.rawValue,
      visitArrival: geofence?.visitArrivalSince1970,
      visitDeparture: geofence?.visitDepartureSince1970
    )
    pendingById[requestId] = payload

    if backgroundCompletion != nil {
      os_log(.info, log: log, "[BGTask] performInference started requestId=%{public}@", requestId)
    }

    if let g = geofence {
      os_log(
        .info,
        log: log,
        "Inference request queued id=%{public}@ poi=%{public}@ event=%{public}@ lat=%.5f lon=%.5f hour=%d fg=%d",
        requestId,
        g.poiId,
        g.event.rawValue,
        features.latitude,
        features.longitude,
        features.hourOfDay,
        isForeground
      )
    } else {
      os_log(
        .info,
        log: log,
        "Inference request queued id=%{public}@ lat=%.5f lon=%.5f hour=%d fg=%d",
        requestId,
        features.latitude,
        features.longitude,
        features.hourOfDay,
        isForeground
      )
    }

    var locationPayload: [String: Any] = [
      "latitude": payload.latitude,
      "longitude": payload.longitude,
      "speed": payload.speed,
      "hourOfDay": payload.hourOfDay,
      "isForeground": payload.isForeground,
    ]
    if let pid = payload.poiId { locationPayload["poiId"] = pid }
    if let pname = payload.poiName { locationPayload["poiName"] = pname }
    if let ev = payload.geofenceEvent { locationPayload["geofenceEvent"] = ev }
    if let visitArrival = payload.visitArrival { locationPayload["visitArrival"] = visitArrival }
    if let visitDeparture = payload.visitDeparture { locationPayload["visitDeparture"] = visitDeparture }

    let emitted = EatingRiskEventEmitter.emitInferenceRequest(
      InferenceRequestPayload(
        requestId: payload.requestId,
        timestampIso: payload.timestampIso,
        location: locationPayload
      )
    )
    if !emitted {
      enqueuePendingRequest(payload)
      os_log(.info, log: log, "JS unavailable. queued request id=%{public}@", requestId)
    }

    if backgroundCompletion != nil {
      os_log(
        .info,
        log: log,
        "[BGTask] emit to JS emitted=%{public}d id=%{public}@",
        emitted ? 1 : 0,
        requestId
      )
    }

    if let bg = backgroundCompletion {
      scheduleBackgroundInferenceCompletion(requestId: requestId, completion: bg)
    }
  }

  private func scheduleBackgroundInferenceCompletion(requestId: String, completion: @escaping (Bool) -> Void) {
    backgroundInferenceTimeoutWorkItem?.cancel()
    backgroundInferenceRequestId = requestId
    backgroundInferenceCompletion = completion
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      guard self.backgroundInferenceRequestId == requestId else { return }
      os_log(.error, log: self.log, "[BGTask] JS result TIMEOUT id=%{public}@", requestId)
      self.clearBackgroundInferenceState()
      os_log(.info, log: self.log, "[BGTask] inference completion called success=0 reason=js_timeout")
      completion(false)
    }
    backgroundInferenceTimeoutWorkItem = work
    inferenceQueue.asyncAfter(deadline: .now() + backgroundInferenceTimeoutSeconds, execute: work)
    os_log(
      .info,
      log: log,
      "[BGTask] waiting for JS result timeout=%{public}d s id=%{public}@",
      Int(backgroundInferenceTimeoutSeconds),
      requestId
    )
  }

  private func clearBackgroundInferenceState() {
    backgroundInferenceRequestId = nil
    backgroundInferenceCompletion = nil
    backgroundInferenceTimeoutWorkItem = nil
  }

  private func finishBackgroundInferenceIfNeeded(requestId: String) {
    guard backgroundInferenceRequestId == requestId, let finish = backgroundInferenceCompletion else { return }
    os_log(.info, log: log, "[BGTask] JS result received — completing BG callback id=%{public}@", requestId)
    backgroundInferenceTimeoutWorkItem?.cancel()
    clearBackgroundInferenceState()
    os_log(.info, log: log, "[BGTask] inference completion called success=1 reason=js_result")
    finish(true)
  }

  func retryQueuedRequests() {
    inferenceQueue.async { [weak self] in
      self?.drainQueueIfPossible()
    }
  }

  func handleJSInferenceResult(requestId: String, score: Double, metadata: [String: Any]?) {
    inferenceQueue.async { [weak self] in
      guard let self else { return }

      if self.pendingById[requestId] == nil {
        os_log(.info, log: self.log, "Received result for non-pending id=%{public}@", requestId)
      } else {
        self.pendingById.removeValue(forKey: requestId)
      }

      let label = metadata?["label"] as? String ?? "-"
      let quality = metadata?["qualityScore"] as? Double ?? -1
      let notifTitle = metadata?["title"] as? String
      let notifBody = metadata?["body"] as? String
      os_log(
        .info,
        log: self.log,
        "JS inference result id=%{public}@ score=%.3f label=%{public}@ quality=%.3f",
        requestId,
        score,
        label,
        quality
      )

      let threshold = InferenceConfig.scoreThreshold
      NotificationManager.shared.logInferenceOutcome(
        score: score,
        title: notifTitle,
        body: notifBody,
        outcome: score > threshold ? "above_threshold" : "low_score"
      )
      guard score > threshold else {
        self.finishBackgroundInferenceIfNeeded(requestId: requestId)
        return
      }
      NotificationManager.shared.showEatingRiskNotification(
        score: score,
        title: notifTitle,
        body: notifBody
      )
      EatingRiskEventEmitter.emitHighRisk(score: score)
      self.finishBackgroundInferenceIfNeeded(requestId: requestId)
    }
  }

  private func enqueuePendingRequest(_ request: PendingInferenceRequest) {
    var queue = loadQueue()
    queue.append(request)

    if queue.count > maxQueueSize {
      queue = Array(queue.suffix(maxQueueSize))
    }
    saveQueue(queue)
  }

  private func drainQueueIfPossible() {
    var queue = loadQueue()
    guard !queue.isEmpty else { return }
    let now = Date()
    var remaining: [PendingInferenceRequest] = []

    for item in queue {
      guard let ts = isoFormatter.date(from: item.timestampIso) else { continue }
      if now.timeIntervalSince(ts) > queueTtlSeconds {
        os_log(.info, log: log, "Dropping expired queued request id=%{public}@", item.requestId)
        continue
      }

      pendingById[item.requestId] = item
      var locationPayload: [String: Any] = [
        "latitude": item.latitude,
        "longitude": item.longitude,
        "speed": item.speed,
        "hourOfDay": item.hourOfDay,
        "isForeground": item.isForeground,
      ]
      if let pid = item.poiId { locationPayload["poiId"] = pid }
      if let pname = item.poiName { locationPayload["poiName"] = pname }
      if let ev = item.geofenceEvent { locationPayload["geofenceEvent"] = ev }
      if let visitArrival = item.visitArrival { locationPayload["visitArrival"] = visitArrival }
      if let visitDeparture = item.visitDeparture { locationPayload["visitDeparture"] = visitDeparture }

      let emitted = EatingRiskEventEmitter.emitInferenceRequest(
        InferenceRequestPayload(
          requestId: item.requestId,
          timestampIso: item.timestampIso,
          location: locationPayload
        )
      )
      if !emitted {
        remaining.append(item)
      }
    }
    saveQueue(remaining)
  }

  private func loadQueue() -> [PendingInferenceRequest] {
    guard let data = UserDefaults.standard.data(forKey: queueStoreKey) else { return [] }
    do {
      return try JSONDecoder().decode([PendingInferenceRequest].self, from: data)
    } catch {
      os_log(.error, log: log, "Failed decoding queue: %{public}@", String(describing: error))
      return []
    }
  }

  private func saveQueue(_ queue: [PendingInferenceRequest]) {
    do {
      let data = try JSONEncoder().encode(queue)
      UserDefaults.standard.set(data, forKey: queueStoreKey)
    } catch {
      os_log(.error, log: log, "Failed encoding queue: %{public}@", String(describing: error))
    }
  }
}

// MARK: - One-shot location for background inference

private final class OneShotLocationFetcher: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private let completion: (Result<CLLocation, Error>) -> Void
  private let timeoutSeconds: TimeInterval?
  private var retained: OneShotLocationFetcher?
  private let finishLock = NSLock()
  private var didFinish = false
  private var timeoutWork: DispatchWorkItem?

  init(timeoutSeconds: TimeInterval? = nil, completion: @escaping (Result<CLLocation, Error>) -> Void) {
    self.completion = completion
    self.timeoutSeconds = timeoutSeconds
    super.init()
    retained = self
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
  }

  private func finish(_ result: Result<CLLocation, Error>) {
    finishLock.lock()
    defer { finishLock.unlock() }
    guard !didFinish else { return }
    didFinish = true
    timeoutWork?.cancel()
    timeoutWork = nil
    manager.delegate = nil
    retained = nil
    completion(result)
  }

  func requestLocation() {
    let status: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      status = manager.authorizationStatus
    } else {
      status = CLLocationManager.authorizationStatus()
    }
    guard status == .authorizedAlways || status == .authorizedWhenInUse else {
      finish(.failure(NSError(
        domain: "ContextInference",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Location not authorized for background inference"]
      )))
      return
    }
    if let t = timeoutSeconds, t > 0 {
      let work = DispatchWorkItem { [weak self] in
        self?.finish(.failure(NSError(
          domain: "ContextInference",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "One-shot location timed out"]
        )))
      }
      timeoutWork = work
      DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + t, execute: work)
    }
    manager.requestLocation()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else {
      finish(.failure(NSError(
        domain: "ContextInference",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No location fix"]
      )))
      return
    }
    finish(.success(loc))
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finish(.failure(error))
  }
}

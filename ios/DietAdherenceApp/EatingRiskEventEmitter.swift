import Foundation
import React

struct InferenceRequestPayload {
  let requestId: String
  let timestampIso: String
  let location: [String: Any]
}

/// Bridge for native<->JS context inference orchestration.
@objc(EatingRiskEventEmitter)
class EatingRiskEventEmitter: RCTEventEmitter {
  private static weak var instance: EatingRiskEventEmitter?
  private var hasJsListeners = false

  override init() {
    super.init()
    EatingRiskEventEmitter.instance = self
  }

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  override func supportedEvents() -> [String]! {
    ["onHighEatingRisk", "onContextInferenceRequested"]
  }

  override func startObserving() {
    hasJsListeners = true
    ContextInferenceCoordinator.shared.retryQueuedRequests()
  }

  override func stopObserving() {
    hasJsListeners = false
  }

  @objc(submitContextInferenceResult:score:metadata:)
  func submitContextInferenceResult(
    _ requestId: String,
    score: NSNumber,
    metadata: NSDictionary
  ) {
    let map = metadata as? [String: Any]
    ContextInferenceCoordinator.shared.handleJSInferenceResult(
      requestId: requestId,
      score: score.doubleValue,
      metadata: map
    )
  }

  @objc(getNotificationScheduleLog:reject:)
  func getNotificationScheduleLog(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      let text = NotificationManager.shared.readScheduleLogContents()
      DispatchQueue.main.async {
        resolve(text)
      }
    }
  }

  @objc(clearNotificationScheduleLog:reject:)
  func clearNotificationScheduleLog(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    NotificationManager.shared.clearScheduleLog { error in
      if let error {
        reject("clear_notification_log", error.localizedDescription, error)
      } else {
        resolve(true)
      }
    }
  }

  /// Replaces the persisted POI list and refreshes `CLCircularRegion` monitoring (max 20 by `priority`).
  @objc(setMonitoredPois:resolve:reject:)
  func setMonitoredPois(
    _ pois: NSArray,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let parsed = MonitoredPOIStore.parseFromReactNative(pois)
    MonitoredPOIStore.save(parsed)
    LocationTriggerManager.shared.reloadMonitoredRegionsFromPersistence()
    let capped = MonitoredPOIStore.cappedAndSorted(parsed)
    resolve([
      "total": capped.total,
      "monitored": capped.active.count,
      "capped": capped.total > MonitoredPOIStore.maxRegions,
    ])
  }

  static func emitHighRisk(score: Double) {
    DispatchQueue.main.async {
      instance?.sendEvent(withName: "onHighEatingRisk", body: ["score": score])
    }
  }

  static func emitInferenceRequest(_ payload: InferenceRequestPayload) -> Bool {
    guard let emitter = instance, emitter.hasJsListeners else { return false }
    DispatchQueue.main.async {
      emitter.sendEvent(
        withName: "onContextInferenceRequested",
        body: [
          "requestId": payload.requestId,
          "timestamp": payload.timestampIso,
          "location": payload.location,
        ]
      )
    }
    return true
  }
}

import CoreLocation
import Foundation
import os.log
import UIKit

/// Owns `CLLocationManager`, visit monitoring, and dispatches to `ContextInferenceCoordinator`.
final class LocationTriggerManager: NSObject {
  static let shared = LocationTriggerManager()

  private let log = OSLog(subsystem: "org.resta.ai", category: "LocationTrigger")
  private let locationManager = CLLocationManager()

  /// In DEBUG solo `print` (evita doppie righe in Xcode: console unifica anche `os_log`).
  /// In Release solo `os_log` per strumenti di sistema.
  private func trace(_ message: String) {
#if DEBUG
    print(message)
#else
    os_log(.default, log: log, "%{public}@", message)
#endif
  }

  private var started = false
  private var didRequestAlwaysThisSession = false
  private var visitsMonitoringActive = false
  /// Evita spam in console: `applyAuthorizationState` viene richiamato spesso (es. `applicationDidBecomeActive`).
  private var lastApplyAuthSnapshot: (statusRaw: Int32, visitsOn: Bool)? = nil
#if DEBUG && targetEnvironment(simulator)
  /// Una sola visita sintetica per processo (variabile d’ambiente `SIMULATE_CLVISIT=1`).
  private var didScheduleSimulatorSyntheticVisit = false
#endif

  private override init() {
    super.init()
    locationManager.delegate = self
    locationManager.pausesLocationUpdatesAutomatically = true
  }

  /// Idempotent: requests notification permission, location auth, then starts visit monitoring when allowed.
  func start() {
    if started {
      applyAuthorizationState()
      return
    }
    started = true

    trace("[LocationTrigger] start()")
    NotificationManager.shared.requestPermission { _ in }
    requestLocationAuthorizationChain()
  }

  /// Call from `applicationDidBecomeActive` to refresh background flags after returning from Settings.
  func ensureMonitoringForCurrentAuthorization() {
    applyAuthorizationState()
  }

  /// Kept for API compatibility with existing callers.
  func reloadMonitoredRegionsFromPersistence() {
    DispatchQueue.main.async { [weak self] in
      self?.applyAuthorizationState()
    }
  }

  private func requestLocationAuthorizationChain() {
    let status = locationManager.authorizationStatus
    switch status {
    case .notDetermined:
      trace("[LocationTrigger] authorization notDetermined → requestWhenInUse")
      locationManager.requestWhenInUseAuthorization()
    case .authorizedWhenInUse, .authorizedAlways:
      trace("[LocationTrigger] authorization ok raw=\(status.rawValue)")
      applyAuthorizationState()
    case .denied, .restricted:
      trace("[LocationTrigger] Location denied/restricted raw=\(status.rawValue)")
    @unknown default:
      break
    }
  }

  private func applyAuthorizationState() {
    let status = locationManager.authorizationStatus
    switch status {
    case .authorizedAlways:
      if #available(iOS 9.0, *) {
        locationManager.allowsBackgroundLocationUpdates = true
      }
      startVisitMonitoringIfNeeded()
    case .authorizedWhenInUse:
      if #available(iOS 9.0, *) {
        locationManager.allowsBackgroundLocationUpdates = false
      }
      startVisitMonitoringIfNeeded()
    case .notDetermined, .denied, .restricted:
      if #available(iOS 9.0, *) {
        locationManager.allowsBackgroundLocationUpdates = false
      }
      stopVisitMonitoringIfNeeded()
    @unknown default:
      break
    }

    let newSnapshot = (statusRaw: status.rawValue, visitsOn: visitsMonitoringActive)
    let shouldLog: Bool = {
      guard let prev = lastApplyAuthSnapshot else { return true }
      return prev.statusRaw != newSnapshot.statusRaw || prev.visitsOn != newSnapshot.visitsOn
    }()
    if shouldLog {
      lastApplyAuthSnapshot = newSnapshot
      let name: String
      switch status {
      case .notDetermined: name = "notDetermined"
      case .restricted: name = "restricted"
      case .denied: name = "denied"
      case .authorizedAlways: name = "authorizedAlways"
      case .authorizedWhenInUse: name = "authorizedWhenInUse"
      @unknown default: name = "unknown"
      }
      trace(
        "[LocationTrigger] applyAuthorizationState \(name) raw=\(status.rawValue) visitsMonitoring=\(visitsMonitoringActive)"
      )
    }
  }

  private func startVisitMonitoringIfNeeded() {
    guard !visitsMonitoringActive else { return }
    locationManager.startMonitoringVisits()
    visitsMonitoringActive = true
    trace("[LocationTrigger] startMonitoringVisits() chiamato")
#if DEBUG && targetEnvironment(simulator)
    scheduleSimulatorSyntheticVisitIfNeeded()
#endif
  }

  private func stopVisitMonitoringIfNeeded() {
    guard visitsMonitoringActive else { return }
    locationManager.stopMonitoringVisits()
    visitsMonitoringActive = false
    trace("[LocationTrigger] stopMonitoringVisits() chiamato")
  }

  /// Kept for API compatibility; no gating (every `CLVisit` may run inference).
  func shouldEvaluateGeofenceContext() -> Bool {
    true
  }

  /// Percorso unico verso `ContextInferenceCoordinator` (visita reale o sintetica).
  private func deliverVisitInference(
    coordinate: CLLocationCoordinate2D,
    horizontalAccuracy: CLLocationAccuracy,
    arrivalDate: Date,
    departureDate: Date,
    logPrefix: String
  ) {
    guard CLLocationCoordinate2DIsValid(coordinate) else {
      trace("[LocationTrigger] \(logPrefix) ignorata: coordinate non valide")
      return
    }
    guard shouldEvaluateGeofenceContext() else { return }

    let isArrival = departureDate == Date.distantFuture
    let event: GeofenceInferenceContext.GeofenceEvent = isArrival ? .arrival : .departure
    let departure: Double? = isArrival ? nil : departureDate.timeIntervalSince1970
    let timestamp = isArrival ? arrivalDate : departureDate

    trace(
      String(
        format: "[LocationTrigger] %@ event=%@ lat=%.5f lon=%.5f",
        logPrefix,
        event.rawValue,
        coordinate.latitude,
        coordinate.longitude
      )
    )

    let location = CLLocation(
      coordinate: coordinate,
      altitude: 0,
      horizontalAccuracy: max(horizontalAccuracy, 0),
      verticalAccuracy: -1,
      course: -1,
      speed: 0,
      timestamp: timestamp
    )
    let ctx = GeofenceInferenceContext(
      poiId: "visit_auto",
      poiName: "Luogo automatico",
      event: event,
      visitArrivalSince1970: arrivalDate.timeIntervalSince1970,
      visitDepartureSince1970: departure
    )
    ContextInferenceCoordinator.shared.runInference(location: location, geofence: ctx)
  }
}

extension LocationTriggerManager: CLLocationManagerDelegate {
  func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    deliverVisitInference(
      coordinate: visit.coordinate,
      horizontalAccuracy: visit.horizontalAccuracy,
      arrivalDate: visit.arrivalDate,
      departureDate: visit.departureDate,
      logPrefix: "didVisit"
    )
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    trace("[LocationTrigger] didFailWithError: \(String(describing: error))")
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    trace("[LocationTrigger] authorization changed raw=\(status.rawValue)")
    if status == .authorizedWhenInUse, !didRequestAlwaysThisSession {
      didRequestAlwaysThisSession = true
      manager.requestAlwaysAuthorization()
    }
    applyAuthorizationState()
  }
}

#if DEBUG && targetEnvironment(simulator)
extension LocationTriggerManager {
  /// Solo simulatore + **Debug**: imposta nello schema Xcode `SIMULATE_CLVISIT` = `1` per simulare un `arrival` senza `CLVisit` reale.
  private func scheduleSimulatorSyntheticVisitIfNeeded() {
    guard !didScheduleSimulatorSyntheticVisit else { return }
    guard ProcessInfo.processInfo.environment["SIMULATE_CLVISIT"] == "1" else { return }
    didScheduleSimulatorSyntheticVisit = true
    trace("[LocationTrigger] SIMULATORE: SIMULATE_CLVISIT=1 → tra 2s visita sintetica (arrival)")
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
      guard let self else { return }
      let coord = CLLocationCoordinate2D(latitude: 37.3349, longitude: -122.0090)
      let now = Date()
      self.deliverVisitInference(
        coordinate: coord,
        horizontalAccuracy: 65,
        arrivalDate: now,
        departureDate: Date.distantFuture,
        logPrefix: "simSyntheticVisit"
      )
    }
  }
}
#endif

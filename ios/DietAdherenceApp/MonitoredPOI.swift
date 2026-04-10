import CoreLocation
import Foundation

/// User-defined point of interest for geofence monitoring (persisted; synced from JS via native module).
struct MonitoredPOI: Codable, Equatable {
  let id: String
  let name: String?
  let latitude: Double
  let longitude: Double
  let radiusMeters: CLLocationDistance
  let priority: Int
}

enum MonitoredPOIStore {
  static let userDefaultsKey = "nativeMonitoredPoisV1"
  /// iOS limit for concurrent `CLCircularRegion` monitors per app.
  static let maxRegions = 20
  static let minRadiusMeters: CLLocationDistance = 100
  static let defaultRadiusMeters: CLLocationDistance = 150

  static func load() -> [MonitoredPOI] {
    guard let data = UserDefaults.standard.data(forKey: userDefaultsKey) else { return [] }
    return (try? JSONDecoder().decode([MonitoredPOI].self, from: data)) ?? []
  }

  static func save(_ pois: [MonitoredPOI]) {
    guard let data = try? JSONEncoder().encode(pois) else { return }
    UserDefaults.standard.set(data, forKey: userDefaultsKey)
  }

  /// Highest `priority` first, then stable `id` ordering. Returns active subset and original count.
  static func cappedAndSorted(_ pois: [MonitoredPOI]) -> (active: [MonitoredPOI], total: Int) {
    let sorted = pois.sorted { a, b in
      if a.priority != b.priority { return a.priority > b.priority }
      return a.id < b.id
    }
    let total = pois.count
    return (Array(sorted.prefix(maxRegions)), total)
  }

  static func regionIdentifier(forPoiId poiId: String) -> String {
    "poi:\(poiId)"
  }

  /// Builds models from RN `setMonitoredPois` array of dictionaries. Invalid entries are skipped.
  static func parseFromReactNative(_ array: NSArray) -> [MonitoredPOI] {
    var out: [MonitoredPOI] = []
    for case let item as NSDictionary in array {
      guard let id = item["id"] as? String, !id.isEmpty else { continue }
      let name = item["name"] as? String
      let lat = doubleValue(from: item["latitude"])
      let lon = doubleValue(from: item["longitude"])
      guard lat.isFinite, lon.isFinite, abs(lat) <= 90, abs(lon) <= 180 else { continue }
      let rawRadius = doubleValue(from: item["radiusMeters"])
      let radius: CLLocationDistance = rawRadius.isFinite && rawRadius > 0
        ? max(minRadiusMeters, rawRadius)
        : defaultRadiusMeters
      let priority = intValue(from: item["priority"])
      out.append(
        MonitoredPOI(
          id: id,
          name: name,
          latitude: lat,
          longitude: lon,
          radiusMeters: radius,
          priority: priority
        )
      )
    }
    return out
  }

  private static func doubleValue(from value: Any?) -> Double {
    if let n = value as? NSNumber { return n.doubleValue }
    if let d = value as? Double { return d }
    return .nan
  }

  private static func intValue(from value: Any?) -> Int {
    if let n = value as? NSNumber { return n.intValue }
    if let i = value as? Int { return i }
    return 0
  }
}

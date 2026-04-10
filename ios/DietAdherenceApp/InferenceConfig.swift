import Foundation

/// Tunable parameters for native context inference (threshold, debounce, etc.).
enum InferenceConfig {
  private static let thresholdKey = "nativeEatingRiskScoreThreshold"

  /// Score above which we show a local notification and emit to RN (default 0.7).
  static var scoreThreshold: Double {
    if UserDefaults.standard.object(forKey: thresholdKey) != nil {
      return UserDefaults.standard.double(forKey: thresholdKey)
    }
    return 0.7
  }
}

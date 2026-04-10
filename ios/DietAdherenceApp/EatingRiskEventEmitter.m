#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(EatingRiskEventEmitter, RCTEventEmitter)
RCT_EXTERN_METHOD(submitContextInferenceResult:(NSString *)requestId
                  score:(nonnull NSNumber *)score
                  metadata:(NSDictionary *)metadata)
RCT_EXTERN_METHOD(getNotificationScheduleLog:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearNotificationScheduleLog:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setMonitoredPois:(NSArray *)pois
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
@end

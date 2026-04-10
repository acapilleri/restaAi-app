import { useCallback, useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { useExecutorchModule } from 'react-native-executorch';
import CONTEXT_SNAPSHOT_LINEAR_PTE from '../assets/models/context_snapshot_linear.pte';
import { collectSensors } from '../services/SensorCollector';
import { runContextSnapshotLinear } from '../services/contextSnapshotLinearModel';
import { useSensorFusion } from '../context/SensorFusionContext';
import type { RawSensorBundle } from '../services/SensorCollector';
import type { LinearClassifierOutput } from '../services/contextSnapshotLinearModel';

type InferenceRequestEvent = {
  requestId: string;
  timestamp: string;
  location?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    hourOfDay?: number;
    isForeground?: boolean;
    poiId?: string;
    poiName?: string;
    geofenceEvent?: 'enter' | 'exit';
  };
};

type EatingRiskNativeModule = {
  submitContextInferenceResult: (
    requestId: string,
    score: number,
    metadata: Record<string, unknown>
  ) => void;
};

const LLM_COPY_TIMEOUT_MS = 5000;

function getNativeModule(): EatingRiskNativeModule | null {
  const mod = NativeModules.EatingRiskEventEmitter as Partial<EatingRiskNativeModule> | undefined;
  if (!mod || typeof mod.submitContextInferenceResult !== 'function') {
    return null;
  }
  return mod as EatingRiskNativeModule;
}

export function NativeInferenceBridge() {
  const nativeModule = getNativeModule();
  const linearModule = useExecutorchModule({ modelSource: CONTEXT_SNAPSHOT_LINEAR_PTE });
  const llm = useSensorFusion();
  const llmQueueRef = useRef(Promise.resolve());

  const withTimeout = useCallback(async <T,>(p: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('llm_timeout')), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  const parseLlmJson = useCallback((text: string): { title: string; body: string } | null => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        title?: unknown;
        body?: unknown;
      };
      if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null;
      const title = parsed.title.replace(/\s+/g, ' ').trim().slice(0, 40);
      const body = parsed.body.replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!title || !body) return null;
      return { title, body };
    } catch {
      return null;
    }
  }, []);

  const generateNotificationCopyWithLLM = useCallback(
    async (
      requestId: string,
      output: LinearClassifierOutput,
      bundle: RawSensorBundle,
      score: number
    ): Promise<{ title: string; body: string; copyStatus: string }> => {
      const fallback = buildNotificationCopy(output, bundle, score);
      if (!llm.isReady) {
        return { ...fallback, copyStatus: 'llm_not_ready_fallback' };
      }

      const payload = {
        request_id: requestId,
        context_label: output.gated.label || output.rawLabel || 'unknown',
        confidence: Number(score.toFixed(4)),
        quality_score: Number(output.qualityScore.toFixed(4)),
        speed_kmh: Number.isFinite(bundle.gps.speed_kmh) ? Math.round(bundle.gps.speed_kmh) : null,
        time_of_day_it: bundle.temporal.time_of_day_it ?? '',
        area_hint_it: bundle.gps.area_hint_it ?? '',
        is_foreground: bundle.system.app_state === 'active',
      };

      const systemPrompt = `You are an on-device notification copy generator for a diet-adherence app.
Write concise Italian text for a local notification.

Return ONLY valid JSON, no markdown, no extra text:
{"title":"...","body":"..."}

Constraints:
- title: max 40 chars
- body: max 140 chars
- tone: supportive, non-judgmental, no fear language
- avoid medical claims
- do not mention model/AI
- if confidence < 0.55, be softer/uncertain
- if context is unknown, keep generic and safe`;

      try {
        const response = await withTimeout(
          llm.generate([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload) },
          ]),
          LLM_COPY_TIMEOUT_MS
        );
        const parsed = parseLlmJson(response);
        if (!parsed) {
          return { ...fallback, copyStatus: 'llm_parse_fallback' };
        }
        return { ...parsed, copyStatus: 'llm_ok' };
      } catch (error) {
        if (__DEV__) {
          console.warn('[NativeInferenceBridge] LLM copy fallback', requestId, error);
        }
        const status = error instanceof Error && error.message === 'llm_timeout'
          ? 'llm_timeout_fallback'
          : 'llm_error_fallback';
        return { ...fallback, copyStatus: status };
      }
    },
    [llm, parseLlmJson, withTimeout]
  );

  useEffect(() => {
    if (!nativeModule) return;
    const emitter = new NativeEventEmitter(NativeModules.EatingRiskEventEmitter);
    const enqueueLlmTask = async <T,>(task: () => Promise<T>): Promise<T> => {
      const run = llmQueueRef.current.then(task, task);
      llmQueueRef.current = run.then(
        () => Promise.resolve(),
        () => Promise.resolve()
      );
      return run;
    };

    const sub = emitter.addListener(
      'onContextInferenceRequested',
      async (event: InferenceRequestEvent) => {
        const requestId = event?.requestId;
        if (!requestId) return;

        try {
          if (!linearModule.isReady || linearModule.error) {
            nativeModule.submitContextInferenceResult(requestId, 0, {
              ts: new Date().toISOString(),
              status: 'model_not_ready',
              error: linearModule.error ? String(linearModule.error) : 'model_not_ready',
            });
            return;
          }

          const bundle = await collectSensors();
          const output = await runContextSnapshotLinear(linearModule.forward, bundle);
          const score = Number.isFinite(output.gated.confidence) ? output.gated.confidence : 0;
          const notif = await enqueueLlmTask(() =>
            generateNotificationCopyWithLLM(requestId, output, bundle, score)
          );
          nativeModule.submitContextInferenceResult(requestId, score, {
            ts: new Date().toISOString(),
            status: 'ok',
            label: output.gated.label,
            rawLabel: output.rawLabel,
            qualityScore: output.qualityScore,
            title: notif.title,
            body: notif.body,
            copyStatus: notif.copyStatus,
          });
        } catch (error) {
          nativeModule.submitContextInferenceResult(requestId, 0, {
            ts: new Date().toISOString(),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [
    generateNotificationCopyWithLLM,
    linearModule.error,
    linearModule.forward,
    linearModule.isReady,
    nativeModule,
  ]);

  return null;
}

function buildNotificationCopy(
  output: LinearClassifierOutput,
  bundle: RawSensorBundle,
  score: number
): { title: string; body: string } {
  const label = (output.gated.label || output.rawLabel || 'contesto').toLowerCase();
  const confidencePct = Math.round(score * 100);
  const speed = Number.isFinite(bundle.gps.speed_kmh) ? Math.round(bundle.gps.speed_kmh) : null;
  const tod = typeof bundle.temporal.time_of_day_it === 'string' ? bundle.temporal.time_of_day_it : '';

  const title = 'Attenzione';
  const contextChunk = label !== 'unknown' ? `Contesto: ${label}` : 'Contesto rilevato dal modello';
  const speedChunk = speed !== null ? ` | velocita ${speed} km/h` : '';
  const todChunk = tod ? ` | fascia ${tod}` : '';
  const body =
    `${contextChunk} (confidenza ${confidencePct}%).` +
    `${speedChunk}${todChunk}
`.trim();
  return { title, body };
}

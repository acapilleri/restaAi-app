import { ScalarType, type TensorPtr } from 'react-native-executorch';
import type { RawSensorBundle } from './SensorCollector';
import linearMeta from '../assets/models/context_snapshot_linear.pte.json';
import {
  extractSnapshotFeatures,
  gatePrediction,
  type GatedPrediction,
} from './contextSnapshotFeatures';

export const CONTEXT_SNAPSHOT_LINEAR_CLASSES: readonly string[] = linearMeta.classes;
export const CONTEXT_SNAPSHOT_N_FEATURES = linearMeta.n_features as number;
export const CONTEXT_SNAPSHOT_N_CLASSES = linearMeta.n_classes as number;

export interface LinearClassifierOutput {
  logits: number[];
  probs: number[];
  rawLabel: string;
  gated: GatedPrediction;
  qualityScore: number;
  /** Allineato a `context_snapshot_linear.pte.json` `feature_names` — per confronto con training / Python. */
  featureNames: string[];
  featureVector: number[];
}

export function softmax(logits: number[]): number[] {
  if (logits.length === 0) return [];
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  if (sum === 0) return logits.map(() => 1 / logits.length);
  return exps.map((e) => e / sum);
}

/** Legge logits [1, C] o [C] dal tensore in uscita ExecuTorch. */
export function readLogitsFromTensorPtr(t: TensorPtr): number[] {
  const raw = t.dataPtr;
  const f32 = raw instanceof Float32Array ? raw : new Float32Array(raw as ArrayBuffer);
  const sizes = t.sizes;
  let count = CONTEXT_SNAPSHOT_N_CLASSES;
  if (sizes.length === 2 && sizes[0] === 1 && typeof sizes[1] === 'number') {
    count = sizes[1];
  } else if (sizes.length === 1 && typeof sizes[0] === 'number') {
    count = sizes[0];
  }
  return Array.from(f32.subarray(0, count));
}

export async function runContextSnapshotLinear(
  forward: (input: TensorPtr[]) => Promise<TensorPtr[]>,
  bundle: RawSensorBundle,
): Promise<LinearClassifierOutput> {
  const { vector, featureNames, qualityScore } = extractSnapshotFeatures(
    bundle as unknown as Record<string, unknown>,
  );
  if (vector.length !== CONTEXT_SNAPSHOT_N_FEATURES) {
    throw new Error(
      `context_snapshot_linear: attese ${CONTEXT_SNAPSHOT_N_FEATURES} feature, ricevute ${vector.length}`,
    );
  }

  const inputTensor: TensorPtr = {
    dataPtr: Float32Array.from(vector),
    sizes: [1, CONTEXT_SNAPSHOT_N_FEATURES],
    scalarType: ScalarType.FLOAT,
  };

  const outputs = await forward([inputTensor]);
  if (!outputs?.length) {
    throw new Error('context_snapshot_linear: forward senza output');
  }

  const logits = readLogitsFromTensorPtr(outputs[0]);
  const probs = softmax(logits);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[bestIdx]) bestIdx = i;
  }
  const rawLabel = CONTEXT_SNAPSHOT_LINEAR_CLASSES[bestIdx] ?? `class_${bestIdx}`;
  const confidence = probs[bestIdx] ?? 0;
  const gated = gatePrediction(rawLabel, confidence, qualityScore);

  return { logits, probs, rawLabel, gated, qualityScore, featureNames, featureVector: vector };
}

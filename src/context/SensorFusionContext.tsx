/**
 * SensorFusionContext — LLM on-device (ExecuTorch) se il nativo è linkato.
 *
 * Ordine corretto:
 * 1) ETInstaller disponibile su TurboModuleRegistry (dopo avvio bridge)
 * 2) initExecutorch({ BareResourceFetcher }) — altrimenti ResourceFetcher non scarica il modello
 * 3) useLLM (SensorFusionContextInner)
 */

import React, { lazy, Suspense, useContext, useEffect, useState, ReactNode } from 'react';
import { SensorFusionContext } from './sensorFusionContextBase';
import type { SensorFusionContextType } from './sensorFusionContextBase';
import { ensureExecutorchInitialized, hasETInstallerModule } from '../ensureExecutorchInit';

const SensorFusionProviderInner = lazy(() => import('./SensorFusionContextInner'));

interface Props {
  children: ReactNode;
}

const INIT_POLL_MS = 80;
const INIT_GIVE_UP_MS = 12000;

export function SensorFusionProvider({ children }: Props) {
  const [phase, setPhase] = useState<'checking' | 'no_native' | 'init_failed' | 'ready'>('checking');

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    const tick = () => {
      if (cancelled) return;

      if (!hasETInstallerModule()) {
        if (Date.now() - started < INIT_GIVE_UP_MS) {
          setTimeout(tick, INIT_POLL_MS);
          return;
        }
        if (!cancelled) {
          setPhase('no_native');
          if (__DEV__) {
            console.warn(
              '[SensorFusion] ETInstaller non trovato dopo il timeout. Pod install + rebuild iOS/Android.',
            );
          }
        }
        return;
      }

      if (ensureExecutorchInitialized()) {
        if (!cancelled) setPhase('ready');
        return;
      }

      if (Date.now() - started < INIT_GIVE_UP_MS) {
        setTimeout(tick, INIT_POLL_MS);
        return;
      }
      if (!cancelled) {
        setPhase('init_failed');
        if (__DEV__) {
          console.warn('[SensorFusion] initExecutorch non riuscito entro il timeout.');
        }
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'checking') {
    return <SensorFusionContext.Provider value={null}>{children}</SensorFusionContext.Provider>;
  }

  if (phase === 'no_native' || phase === 'init_failed') {
    if (__DEV__ && phase === 'init_failed') {
      console.warn(
        '[SensorFusion] LLM disattivato (init fallito). Controlla log [ExecuTorch] e permessi rete per il download.',
      );
    }
    return <SensorFusionContext.Provider value={null}>{children}</SensorFusionContext.Provider>;
  }

  return (
    <Suspense fallback={null}>
      <SensorFusionProviderInner>{children}</SensorFusionProviderInner>
    </Suspense>
  );
}

export function useSensorFusion(): SensorFusionContextType {
  return useContext(SensorFusionContext);
}

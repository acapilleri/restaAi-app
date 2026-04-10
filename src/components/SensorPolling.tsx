/**
 * SensorPolling
 * Componente invisibile che avvia il polling dei sensori
 * ogni 5 minuti quando l'utente è autenticato.
 * Montalo una sola volta dopo il login.
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSensorFusion } from '../context/SensorFusionContext';
import { collectAndSend } from '../services/SensorBundleService';

export function SensorPolling() {
  const { token } = useAuth();
  const llm = useSensorFusion();
  const llmRef = useRef(llm);
  llmRef.current = llm;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      const llm = llmRef.current;
      if (llm?.isGenerating) return;
      const ctx = await collectAndSend(llm);
      if (ctx?.should_intervene) {
        Alert.alert('🍽️ Resta', ctx.intervention_reason ?? ctx.key_insight);
      }
    };

    /** Ritarda il primo ciclo: evita competizione con cold start / ExecuTorch e riduce rischio crash in release. */
    const bootDelayMs = 5000;
    const bootTimer = setTimeout(() => {
      void run();
      intervalRef.current = setInterval(() => {
        void run();
      }, 5 * 60 * 1000);
    }, bootDelayMs);

    return () => {
      clearTimeout(bootTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      const current = llmRef.current;
      if (current?.isGenerating) {
        try {
          current.interrupt();
        } catch {
          /* ignore */
        }
      }
    };
  }, [token, llm?.isReady]);

  return null;
}

/**
 * Caricato solo se il TurboModule ETInstaller è linkato (vedi SensorFusionContext).
 * Evita di importare react-native-executorch quando il nativo manca → niente crash a schermo bianco.
 */

import React, { ReactNode, useLayoutEffect } from 'react';
import { useLLM, LLAMA3_2_1B_SPINQUANT, SlidingWindowContextStrategy } from 'react-native-executorch';
import { LOCAL_LLM_SLIDING_WINDOW_BUFFER_TOKENS } from '../config/localLlmChat';
import { SYSTEM_PROMPT } from '../screens/localAi/shared';
import { SensorFusionContext } from './sensorFusionContextBase';

interface Props {
  children: ReactNode;
}

export default function SensorFusionProviderInner({ children }: Props) {
  const llm = useLLM({ model: LLAMA3_2_1B_SPINQUANT });

  /** useLayoutEffect: configure prima del paint così non si interagisce prima del reset template/cronologia. */
  useLayoutEffect(() => {
    if (!llm.isReady) return;
    /**
     * Lo streaming in UI dipende da quanto spesso il nativo chiama il tokenCallback JS.
     * Valori alti (15 token / 100 ms) ritardano molto gli aggiornamenti visibili.
     * 1 token e ~16 ms danno flush frequenti senza sovraccaricare il bridge.
     */
    llm.configure({
      chatConfig: {
        systemPrompt: SYSTEM_PROMPT,
        initialMessageHistory: [],
        contextStrategy: new SlidingWindowContextStrategy(LOCAL_LLM_SLIDING_WINDOW_BUFFER_TOKENS),
      },
      generationConfig: {
        outputTokenBatchSize: 1,
        batchTimeInterval: 16,
        temperature: 0.7,
        topp: 0.9,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configure once when model becomes ready
  }, [llm.isReady]);

  if (__DEV__) {
    if (!llm.isReady) {
      console.log(
        '[SensorFusion] Download modello:',
        Math.round(llm.downloadProgress * 100) + '%',
      );
    } else {
      console.log('[SensorFusion] Modello pronto');
    }
    if (llm.error) {
      console.error('[SensorFusion] Errore:', llm.error);
    }
  }

  return <SensorFusionContext.Provider value={llm}>{children}</SensorFusionContext.Provider>;
}

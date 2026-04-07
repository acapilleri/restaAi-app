import { createContext } from 'react';
import type { LLMType } from 'react-native-executorch';

export type SensorFusionContextType = LLMType | null;

export const SensorFusionContext = createContext<SensorFusionContextType>(null);

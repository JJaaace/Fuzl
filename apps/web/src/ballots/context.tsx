import { createContext, useContext } from 'react';
import type { BallotOption } from '@fuzl/planning';
export const ShortlistContext = createContext<((option: () => BallotOption) => void) | null>(null);
export function useShortlist() { return useContext(ShortlistContext); }

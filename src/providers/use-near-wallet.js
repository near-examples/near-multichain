import { createContext, useContext } from 'react';

export const NearContext = createContext(undefined);

export function useNearWallet() {
  const context = useContext(NearContext);
  if (!context) throw new Error('useNearWallet must be used within NearProvider');
  return context;
}

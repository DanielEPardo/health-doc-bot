import { createContext, useContext } from 'react';
export const ClerkReadyContext = createContext(false);
export const useClerkReady = () => useContext(ClerkReadyContext);
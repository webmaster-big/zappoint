import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface WaiverTourContextValue {
  run: boolean;
  stepIndex: number;
  tourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
  setRun: (v: boolean) => void;
  setStepIndex: (v: number) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const WaiverTourContext = createContext<WaiverTourContextValue | null>(null);

export const WaiverTourProvider = ({ children }: { children: React.ReactNode }) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourActive, setTourActive] = useState(false);
  const pendingResume = useRef(false);

  const startTour = useCallback(() => {
    pendingResume.current = false;
    setStepIndex(0);
    setTourActive(true);
    setRun(true);
  }, []);

  const stopTour = useCallback(() => {
    setRun(false);
    setTourActive(false);
    setStepIndex(0);
    pendingResume.current = false;
  }, []);

  return (
    <WaiverTourContext.Provider value={{ run, stepIndex, tourActive, startTour, stopTour, setRun, setStepIndex }}>
      {children}
    </WaiverTourContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWaiverTour = () => {
  const ctx = useContext(WaiverTourContext);
  if (!ctx) throw new Error('useWaiverTour must be used inside WaiverTourProvider');
  return ctx;
};

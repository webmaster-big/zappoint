import { useCallback, useState } from 'react';
import { Joyride, type CallBackProps, EVENTS, STATUS } from 'react-joyride';
import { WAIVER_FORM_TOUR_STEPS } from './waiverFormTourSteps';

const FORM_TOUR_DONE_KEY = 'wf_tour_done';

const joyrideStyles = {
  options: {
    primaryColor: '#1d4ed8',
    backgroundColor: '#0f172a',
    textColor: '#e2e8f0',
    arrowColor: '#0f172a',
    overlayColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10000,
    width: 340,
  },
  buttonNext: { backgroundColor: '#1d4ed8', color: '#fff', borderRadius: 8, fontWeight: 600 },
  buttonBack: { color: '#93c5fd', marginRight: 8, fontWeight: 500 },
  buttonSkip: { color: '#64748b', fontSize: 13 },
  buttonClose: { color: '#93c5fd' },
  tooltip: { borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
  tooltipTitle: { fontSize: 15, fontWeight: 700, color: '#fff' },
  tooltipContent: { fontSize: 13, lineHeight: 1.65, color: '#bfdbfe' },
};

const WaiverFormTour = () => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);

  const hasDone = !!localStorage.getItem(FORM_TOUR_DONE_KEY);

  const startTour = () => {
    setStepIndex(0);
    setActive(true);
    setRun(true);
  };

  const stopTour = () => {
    setRun(false);
    setActive(false);
    setStepIndex(0);
  };

  const handleCallback = useCallback((data: CallBackProps) => {
    const { type, status, index, action } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const next = index + (action === 'prev' ? -1 : 1);
      setStepIndex(next);
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(FORM_TOUR_DONE_KEY, '1');
      stopTour();
    }
  }, []);

  return (
    <>
      <Joyride
        steps={WAIVER_FORM_TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress
        disableScrolling={false}
        scrollToFirstStep
        styles={joyrideStyles}
        callback={handleCallback}
        locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip tour' }}
      />

      <button
        onClick={() => (active ? stopTour() : startTour())}
        title={active ? 'Stop tour' : hasDone ? 'Replay tour' : 'How to fill this form'}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold shadow-lg bg-blue-700 hover:bg-blue-800 text-white transition-all"
        style={{ boxShadow: '0 4px 18px rgba(29,78,216,0.45)' }}
      >
        {active ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            Stop tour
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {hasDone ? 'Replay tour' : 'How to fill this'}
          </>
        )}
      </button>
    </>
  );
};

export default WaiverFormTour;

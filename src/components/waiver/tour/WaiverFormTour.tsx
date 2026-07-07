import { useCallback, useState } from 'react';
import { Joyride, type CallBackProps, STATUS } from 'react-joyride';
import { WAIVER_FORM_TOUR_STEPS } from './waiverFormTourSteps';

const FORM_TOUR_DONE_KEY = 'wf_tour_done';

const joyrideStyles = {
  options: {
    primaryColor: '#2563eb',
    overlayColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    width: 380,
  },
  buttonNext: {
    backgroundColor: '#2563eb',
    color: '#fff',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    padding: '8px 18px',
  },
  buttonBack: {
    color: '#2563eb',
    marginRight: 8,
    fontWeight: 500,
    fontSize: 14,
  },
  buttonSkip: { color: '#94a3b8', fontSize: 13 },
  buttonClose: { color: '#64748b' },
  tooltip: {
    borderRadius: 14,
    padding: '18px 22px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    maxWidth: 400,
  },
  tooltipTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 8,
  },
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.6,
    color: '#475569',
    padding: '0 0 4px',
  },
  tooltipFooter: { marginTop: 16 },
  spotlight: { borderRadius: 8 },
};

const WaiverFormTour = () => {
  const [run, setRun] = useState(false);
  const [hasDone, setHasDone] = useState(() => !!localStorage.getItem(FORM_TOUR_DONE_KEY));

  const handleCallback = useCallback((data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      localStorage.setItem(FORM_TOUR_DONE_KEY, '1');
      setHasDone(true);
      setRun(false);
    }
  }, []);

  return (
    <>
      <Joyride
        steps={WAIVER_FORM_TOUR_STEPS}
        run={run}
        continuous
        showSkipButton
        showProgress
        disableScrolling={false}
        scrollToFirstStep
        scrollOffset={120}
        spotlightClicks={false}
        styles={joyrideStyles}
        callback={handleCallback}
        locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip tour' }}
      />

      <button
        onClick={() => setRun((r) => !r)}
        className="fixed bottom-5 right-5 z-[999] flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold shadow-lg bg-blue-600 hover:bg-blue-700 text-white transition-all select-none"
        style={{ boxShadow: '0 4px 18px rgba(37,99,235,0.45)' }}
      >
        {run ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Stop tour
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {hasDone ? 'Replay tour' : 'How to fill this'}
          </>
        )}
      </button>
    </>
  );
};

export default WaiverFormTour;

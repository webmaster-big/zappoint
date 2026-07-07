import { useCallback, useState } from 'react';
import { Joyride, type CallBackProps, STATUS, type Step } from 'react-joyride';

interface Props {
  steps: Step[];
  storageKey: string;
}

const joyrideStyles = {
  options: {
    primaryColor: '#6366f1',
    overlayColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    width: 380,
  },
  buttonNext: {
    backgroundColor: '#6366f1',
    color: '#fff',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    padding: '8px 18px',
  },
  buttonBack: {
    color: '#6366f1',
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
    fontSize: 14,
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

const WaiverPageTour = ({ steps, storageKey }: Props) => {
  const [run, setRun] = useState(false);
  const [hasDone, setHasDone] = useState(() => !!localStorage.getItem(storageKey));

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        localStorage.setItem(storageKey, '1');
        setHasDone(true);
        setRun(false);
      }
    },
    [storageKey],
  );

  return (
    <>
      <Joyride
        steps={steps}
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
        locale={{ back: 'Back', close: 'Close', last: 'Finish', next: 'Next', skip: 'Skip tour' }}
      />

      <button
        onClick={() => setRun((r) => !r)}
        className="fixed bottom-6 right-6 z-[999] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white select-none"
        style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}
      >
        {run ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Stop tour
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {hasDone ? 'Replay tour' : 'Take tour'}
          </>
        )}
      </button>
    </>
  );
};

export default WaiverPageTour;

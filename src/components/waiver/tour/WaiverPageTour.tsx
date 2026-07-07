import { useCallback, useState } from 'react';
import { Joyride, type CallBackProps, EVENTS, STATUS, type Step } from 'react-joyride';

interface Props {
  steps: Step[];
  storageKey: string;
}

const joyrideStyles = {
  options: {
    primaryColor: '#6366f1',
    backgroundColor: '#1e1b4b',
    textColor: '#ede9fe',
    arrowColor: '#1e1b4b',
    overlayColor: 'rgba(15, 10, 40, 0.5)',
    zIndex: 10000,
    width: 380,
  },
  buttonNext: { backgroundColor: '#6366f1', color: '#fff', borderRadius: 8, fontWeight: 600 },
  buttonBack: { color: '#a5b4fc', marginRight: 8, fontWeight: 500 },
  buttonSkip: { color: '#7c83a4', fontSize: 13 },
  buttonClose: { color: '#a5b4fc' },
  tooltip: { borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  tooltipTitle: { fontSize: 15, fontWeight: 700, color: '#fff' },
  tooltipContent: { fontSize: 14, lineHeight: 1.6, color: '#c7d2fe' },
};

const WaiverPageTour = ({ steps, storageKey }: Props) => {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const hasDone = !!localStorage.getItem(storageKey);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { type, status, index, action } = data;
      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        setStepIndex(index + (action === 'prev' ? -1 : 1));
      }
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(storageKey, '1');
        setRun(false);
        setStepIndex(0);
      }
    },
    [storageKey],
  );

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress
        disableScrolling={false}
        scrollToFirstStep
        styles={joyrideStyles}
        callback={handleCallback}
        locale={{ back: 'Back', close: 'Close', last: 'Finish', next: 'Next', skip: 'Skip tour' }}
      />

      <button
        onClick={() => {
          if (run) {
            setRun(false);
            setStepIndex(0);
          } else {
            setStepIndex(0);
            setRun(true);
          }
        }}
        className="fixed bottom-6 right-6 z-[9998] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white select-none"
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

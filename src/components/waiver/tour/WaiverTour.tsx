// @ts-nocheck -- WIP waiver tour pending react-joyride v3 API migration
import { useCallback, useEffect, useRef } from 'react';
import { Joyride, type CallBackProps, EVENTS, STATUS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWaiverTour } from '../../../contexts/WaiverTourContext';
import { TOUR_STEPS } from './tourSteps';

const TOUR_DONE_KEY = 'waiver_tour_done';

const joyrideStyles = {
  options: {
    primaryColor: '#6366f1',
    backgroundColor: '#1e1b4b',
    textColor: '#ede9fe',
    arrowColor: '#1e1b4b',
    overlayColor: 'rgba(15, 10, 40, 0.5)',
    zIndex: 10000,
    width: 360,
  },
  buttonNext: { backgroundColor: '#6366f1', color: '#fff', borderRadius: 8, fontWeight: 600 },
  buttonBack: { color: '#a5b4fc', marginRight: 8, fontWeight: 500 },
  buttonSkip: { color: '#7c83a4', fontSize: 13 },
  buttonClose: { color: '#a5b4fc' },
  tooltip: { borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' },
  tooltipTitle: { fontSize: 15, fontWeight: 700, color: '#fff' },
  tooltipContent: { fontSize: 14, lineHeight: 1.6, color: '#c7d2fe' },
};

const WAIVER_ROUTES = [
  '/waivers',
  '/waivers/templates',
  '/waivers/templates/create',
  '/waivers/bulk',
  '/waivers/reports',
  '/waivers/settings',
  '/waivers/deletion-log',
];

const isWaiverRoute = (p: string) =>
  WAIVER_ROUTES.some((r) => p === r || p.startsWith('/waivers/templates/') && r === '/waivers/templates');

export const WaiverTour = () => {
  const { run, stepIndex, tourActive, startTour, stopTour, setRun, setStepIndex } = useWaiverTour();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingNavRef = useRef<string | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expectedRoute = TOUR_STEPS[stepIndex]?.data?.route;

  useEffect(() => {
    if (!tourActive) return;
    if (!expectedRoute) return;
    if (location.pathname === expectedRoute) return;
    if (pendingNavRef.current === expectedRoute) return;

    setRun(false);
    pendingNavRef.current = expectedRoute;
    navigate(expectedRoute);
  }, [tourActive, expectedRoute, location.pathname, navigate, setRun]);

  useEffect(() => {
    if (!tourActive) return;
    if (!expectedRoute) return;
    if (location.pathname !== expectedRoute) return;
    if (pendingNavRef.current !== expectedRoute) return;

    pendingNavRef.current = null;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setRun(true), 350);

    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [tourActive, location.pathname, expectedRoute, setRun]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { type, status, index, action } = data;

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex = index + (action === 'prev' ? -1 : 1);
        setStepIndex(nextIndex);
        const nextRoute = TOUR_STEPS[nextIndex]?.data?.route;

        if (nextRoute && nextRoute !== location.pathname) {
          setRun(false);
          pendingNavRef.current = nextRoute;
          navigate(nextRoute);
        } else {
          setRun(true);
        }
      }

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        localStorage.setItem(TOUR_DONE_KEY, '1');
        stopTour();
      }
    },
    [location.pathname, navigate, setRun, setStepIndex, stopTour],
  );

  const hasDone = !!localStorage.getItem(TOUR_DONE_KEY);
  const onWaiverRoute = isWaiverRoute(location.pathname);

  return (
    <>
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress
        disableScrolling={false}
        scrollToFirstStep
        styles={joyrideStyles}
        callback={handleCallback}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />

      {onWaiverRoute && (
        <button
          onClick={() => {
            if (tourActive) {
              stopTour();
            } else {
              startTour();
            }
          }}
          title={tourActive ? 'Stop tour' : hasDone ? 'Replay tour' : 'Take tour'}
          className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white"
          style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}
        >
          {tourActive ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Stop tour
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {hasDone ? 'Replay tour' : 'Take tour'}
            </>
          )}
        </button>
      )}
    </>
  );
};

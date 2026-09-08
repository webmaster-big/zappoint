import React, { useCallback, useEffect, useRef, useState } from 'react';
import ChangeReasonModal from './ChangeReasonModal';
import { registerChangeReasonHandler, type ChangeReasonRequest } from '../../../utils/changeReasonPrompt';
import { useThemeColor } from '../../../hooks/useThemeColor';

/**
 * Mounted once inside the admin shell. Any booking mutation that comes back 422 asking for a
 * reason routes through here, so every admin surface gets the prompt without its own modal state.
 */
const ChangeReasonHost: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [request, setRequest] = useState<ChangeReasonRequest | null>(null);
  const resolverRef = useRef<((reason: string | null) => void) | null>(null);

  useEffect(
    () =>
      registerChangeReasonHandler(
        next =>
          new Promise<string | null>(resolve => {
            // If a prompt is somehow already open, release the previous waiter rather than
            // leaving its request hanging forever.
            resolverRef.current?.(null);
            resolverRef.current = resolve;
            setRequest(next);
          })
      ),
    []
  );

  const settle = useCallback((reason: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(reason);
  }, []);

  return (
    <ChangeReasonModal
      open={request !== null}
      title="Why are you making this change?"
      summary={request?.summary}
      confirmLabel={request?.destructive ? 'Confirm and record' : 'Save change'}
      destructive={request?.destructive}
      onCancel={() => settle(null)}
      onConfirm={reason => settle(reason)}
      themeColor={themeColor}
      fullColor={fullColor}
    />
  );
};

export default ChangeReasonHost;

/**
 * Bridge between the axios layer and the React reason prompt.
 *
 * The backend requires a reason on every employee-made booking change and answers 422 with
 * errors.change_reason when one is missing. Rather than bolt a modal onto each of the ~12 admin
 * surfaces that mutate a booking, the booking API interceptor asks for a reason here and retries.
 * A single host component registers the handler.
 */

export interface ChangeReasonRequest {
  /** Short description of the change, shown in the prompt so staff know what they are justifying. */
  summary?: string;
  /** True for deletes/cancellations, so the prompt can present itself as destructive. */
  destructive?: boolean;
}

type Handler = (request: ChangeReasonRequest) => Promise<string | null>;

let handler: Handler | null = null;

export function registerChangeReasonHandler(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function changeReasonPromptAvailable(): boolean {
  return handler !== null;
}

/**
 * Resolves with the reason the employee typed, or null if they cancelled or no prompt is mounted
 * (for example a background request outside the admin shell).
 */
export function requestChangeReason(request: ChangeReasonRequest = {}): Promise<string | null> {
  if (!handler) return Promise.resolve(null);
  return handler(request).catch(() => null);
}

/** Reads the change_reason validation message out of a Laravel 422 payload. */
export function changeReasonWasRequired(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } })?.response;
  if (response?.status !== 422) return false;
  return Boolean(response?.data?.errors?.change_reason);
}

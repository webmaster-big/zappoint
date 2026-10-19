type FailedRequest = { response?: { status?: number; data?: { message?: unknown } } };

export const requestErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as FailedRequest | null | undefined)?.response;
  const status = Number(response?.status ?? 0);
  const message = response?.data?.message;

  return status >= 400 && status < 500 && status !== 404 && typeof message === 'string' && message.trim() !== '' ? message : fallback;
};

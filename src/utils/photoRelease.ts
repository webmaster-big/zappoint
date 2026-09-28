export const releaseConfirmMessage = (error: unknown): string | null => {
  const response = (error as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response;
  if (response?.status !== 409 || response.data?.code !== 'photo_release_unconfirmed') return null;
  return response.data.message ?? 'Some players in this game were not asked about a photo release.';
};

export const confirmPhotoRelease = (message: string): boolean =>
  window.confirm(`${message}\n\nPress OK only if the group agreed to be shown on the venue slideshow.`);

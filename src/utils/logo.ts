export const LOGO_BOX_RATIO = 2.5;

export const LOGO_RECOMMENDED_WIDTH = 600;
export const LOGO_RECOMMENDED_HEIGHT = Math.round(LOGO_RECOMMENDED_WIDTH / LOGO_BOX_RATIO);

export const LOGO_MAX_BYTES = 20 * 1024 * 1024;

export const LOGO_RATIO_LABEL = '5:2';

export const LOGO_SIZE_HINT =
  `Recommended: ${LOGO_RECOMMENDED_WIDTH} x ${LOGO_RECOMMENDED_HEIGHT} px (${LOGO_RATIO_LABEL} landscape).`;

export const LOGO_FIT_HINT =
  'Every logo is scaled to fit the same box without being stretched, so portrait and square logos work too. A PNG with a transparent background looks best.';

export const LOGO_FILE_HINT = 'Max size: 20MB. Supported: PNG, JPG, JPEG, WEBP.';

export const DEFAULT_LOGO_SRC = '/Zap-Zone.png';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const LOGO_HEIGHTS: Record<LogoSize, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 80,
};

export const logoBoxStyle = (size: LogoSize): { width: number; height: number } => {
  const height = LOGO_HEIGHTS[size];
  return { width: Math.round(height * LOGO_BOX_RATIO), height };
};

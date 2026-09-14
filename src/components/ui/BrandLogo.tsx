import { useEffect, useState } from 'react';
import { getImageUrl } from '../../utils/storage';
import { DEFAULT_LOGO_SRC, logoBoxStyle, type LogoSize } from '../../utils/logo';

interface BrandLogoProps {
  src?: string | null;
  alt?: string;
  size?: LogoSize;
  height?: number;
  className?: string;
  fallbackSrc?: string;
}

const BrandLogo = ({
  src,
  alt = 'Logo',
  size = 'md',
  height,
  className = '',
  fallbackSrc = DEFAULT_LOGO_SRC,
}: BrandLogoProps) => {
  const resolved = src ? getImageUrl(src) : '';
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const displaySrc = !resolved || failed ? fallbackSrc : resolved;
  if (!displaySrc) return null;

  const box = logoBoxStyle(size);
  const boxHeight = height ?? box.height;
  const boxWidth = height ? Math.round(height * (box.width / box.height)) : box.width;

  return (
    <img
      src={displaySrc}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-contain object-center ${className}`}
      style={{ width: boxWidth, height: boxHeight, maxWidth: '100%' }}
    />
  );
};

export default BrandLogo;

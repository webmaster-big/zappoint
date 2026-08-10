import { useEffect, useRef, useState } from 'react';
import WhatsIncluded from './WhatsIncluded';

interface MobilePurchaseIntroProps {
  name: string;
  price: number;
  priceUnit: string;
  image?: string | null;
  showName?: boolean;
  priceNote?: string;
  description?: string | null;
  bullets?: string[];
  bulletsFromDescription?: boolean;
  className?: string;
}

const MobilePurchaseIntro = ({
  name,
  price,
  priceUnit,
  image,
  showName = false,
  priceNote,
  description,
  bullets = [],
  bulletsFromDescription = false,
  className = '',
}: MobilePurchaseIntroProps) => {
  const [descOpen, setDescOpen] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const trimmedDescription = description?.trim() ?? '';

  const showBullets = bullets.length > 0 && (!bulletsFromDescription || bullets.length > 1);
  const showDescription = trimmedDescription !== '' && !(bulletsFromDescription && showBullets);

  useEffect(() => {
    if (descOpen || !showDescription) return;
    const el = descRef.current;
    if (!el) return;

    const measure = () => setDescOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [trimmedDescription, descOpen, showDescription]);

  return (
    <div className={`bg-white ${className}`}>
      {image && !imageFailed && (
        <img
          src={image}
          alt={name}
          onError={() => setImageFailed(true)}
          className="block w-full h-44 object-cover"
        />
      )}
      <div className="px-4 py-3.5 space-y-3">
        {showName && (
          <h2 className="text-xl font-bold text-gray-900 leading-tight break-words">{name}</h2>
        )}

        {Number.isFinite(price) && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Base price</span>
              <span className="text-2xl font-extrabold text-blue-800">${price.toFixed(2)}</span>
              <span className="text-xs text-gray-500">{priceUnit}</span>
            </div>
            {priceNote && <p className="text-[11px] text-gray-500 leading-relaxed">{priceNote}</p>}
          </>
        )}

        {showDescription && (
          <div>
            <p
              ref={descRef}
              className={`text-xs leading-relaxed text-gray-600 whitespace-pre-line break-words ${descOpen ? '' : 'line-clamp-2'}`}
            >
              {trimmedDescription}
            </p>
            {(descOverflows || descOpen) && (
              <button
                type="button"
                onClick={() => setDescOpen((prev) => !prev)}
                className="mt-1 text-xs font-medium text-blue-700 active:text-blue-900"
              >
                {descOpen ? 'See less' : 'See more'}
              </button>
            )}
          </div>
        )}

        {showBullets && (
          <WhatsIncluded items={bullets} tone={bulletsFromDescription ? 'details' : 'inclusions'} />
        )}
      </div>
    </div>
  );
};

export default MobilePurchaseIntro;

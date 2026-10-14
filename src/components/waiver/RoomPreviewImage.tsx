import { useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { getImageUrl } from '../../utils/storage';

interface Props {
  image?: string | null;
  preview?: string | null;
  waiting?: boolean;
  className?: string;
  iconClassName?: string;
}

const RoomPreviewImage = ({ image, preview, waiting = false, className = '', iconClassName = 'w-7 h-7' }: Props) => {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = (waiting ? [] : [preview, image])
    .map((value) => (value ? getImageUrl(value) : ''))
    .filter((url, index, all) => url !== '' && all.indexOf(url) === index);
  const src = candidates.find((url) => !failed.includes(url));

  return (
    <span
      className={`relative block overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 ${className}`}
      aria-hidden="true"
    >
      <span className={`absolute inset-0 flex items-center justify-center ${waiting ? 'motion-safe:animate-pulse' : ''}`}>
        <DoorOpen className={`text-white/70 ${iconClassName}`} />
      </span>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed((list) => (list.includes(src) ? list : [...list, src]))}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </span>
  );
};

export default RoomPreviewImage;

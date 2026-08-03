import { useEffect, useRef, useState } from 'react';

interface Props {
  onChange: (dataUrl: string) => void;
}

const WaiverSignaturePad = ({ onChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dataUrl = useRef('');
  const [empty, setEmpty] = useState(true);

  const configureContext = (ctx: CanvasRenderingContext2D, ratio: number) => {
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = window.devicePixelRatio || 1;
      const prev = dataUrl.current;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      configureContext(ctx, ratio);
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };

    const id = requestAnimationFrame(fit);
    let orient: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(orient);
      orient = setTimeout(fit, 150);
    };
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(orient);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    last.current = point(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk.current) {
      hasInk.current = true;
      setEmpty(false);
    }
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (hasInk.current && canvasRef.current) {
      dataUrl.current = canvasRef.current.toDataURL('image/png');
      onChange(dataUrl.current);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasInk.current = false;
    dataUrl.current = '';
    setEmpty(true);
    onChange('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-700">
          Signature <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        {!empty && (
          <button type="button" onClick={clear} className="text-[11px] font-semibold text-gray-500 hover:text-red-600 transition">
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          style={{ touchAction: 'none', width: '100%', height: '11rem' }}
          className="rounded-lg border border-gray-200 bg-gray-50/50 cursor-crosshair"
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-300">
            Sign here (optional)
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        Your typed name above is your signature. You may also draw one here.
      </p>
    </div>
  );
};

export default WaiverSignaturePad;

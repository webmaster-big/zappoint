const COLORS = ['#2563eb', '#facc15', '#10b981', '#f97316', '#ec4899', '#8b5cf6', '#ef4444'];
const DURATION_MS = 2800;
const FADE_MS = 700;
const GRAVITY = 0.32;
const DRAG = 0.985;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  tilt: number;
  wobble: number;
  color: string;
  round: boolean;
}

let running = false;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const launch = (width: number, height: number, count: number): Piece[] =>
  Array.from({ length: count }, (_, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const speed = height * (0.018 + Math.random() * 0.012);
    const spread = 0.3 + Math.random() * 0.55;
    return {
      x: direction === 1 ? width * 0.06 : width * 0.94,
      y: height * 0.98,
      vx: direction * Math.sin(spread) * speed,
      vy: -Math.cos(spread) * speed,
      size: 6 + Math.random() * 7,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      tilt: Math.random() * Math.PI * 2,
      wobble: 0.08 + Math.random() * 0.12,
      color: COLORS[index % COLORS.length],
      round: index % 5 === 0,
    };
  });

export const celebrate = (): void => {
  if (running || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function' || prefersReducedMotion()) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  running = true;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483646';
  document.body.appendChild(canvas);

  let width = window.innerWidth;
  let height = window.innerHeight;
  const resize = () => {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const pieces = launch(width, height, width < 640 ? 90 : 160);
  const started = performance.now();

  const finish = () => {
    window.removeEventListener('resize', resize);
    canvas.remove();
    running = false;
  };

  let last = started;
  const frame = (now: number) => {
    const elapsed = now - started;
    const step = Math.min(Math.max((now - last) / 16.67, 0), 3);
    const drag = Math.pow(DRAG, step);
    last = now;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = elapsed > DURATION_MS - FADE_MS ? Math.max(0, (DURATION_MS - elapsed) / FADE_MS) : 1;

    pieces.forEach((piece) => {
      piece.vx *= drag;
      piece.vy = piece.vy * drag + GRAVITY * step;
      piece.x += (piece.vx + Math.sin(piece.tilt) * 0.6) * step;
      piece.y += piece.vy * step;
      piece.rotation += piece.spin * step;
      piece.tilt += piece.wobble * step;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      if (piece.round) {
        context.beginPath();
        context.arc(0, 0, piece.size * 0.4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-piece.size / 2, -piece.size * 0.3, piece.size, piece.size * 0.6 * Math.abs(Math.cos(piece.tilt)) + 1);
      }
      context.restore();
    });

    if (elapsed < DURATION_MS) {
      requestAnimationFrame(frame);
    } else {
      finish();
    }
  };

  requestAnimationFrame(frame);
};

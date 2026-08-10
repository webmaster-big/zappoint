const BULLET_PREFIX = /^\s*(?:[-–—•*·▪]|\d+[.)])\s*/;
const SENTENCE_BREAK = /([.!?])\s+(?=["'(]?[A-Z0-9])/g;
const SPLIT_MARKER = '\u0000';

const normalize = (value: string) => value.replace(BULLET_PREFIX, '').replace(/\s+/g, ' ').trim();

const splitSentences = (value: string) =>
  value
    .replace(SENTENCE_BREAK, `$1${SPLIT_MARKER}`)
    .split(SPLIT_MARKER)
    .map((part) => normalize(part).replace(/\.$/, ''))
    .filter(Boolean);

const splitText = (text: string): string[] => {
  const lines = text.split(/\r?\n+/).map(normalize).filter(Boolean);
  if (lines.length === 0) return [];
  if (lines.length > 1) return lines;

  const single = lines[0];
  if (/[•·▪]/.test(single)) return single.split(/[•·▪]/);
  if (single.includes(';')) return single.split(';');

  const sentences = splitSentences(single);
  return sentences.length > 1 ? sentences : [single];
};

export const deriveBullets = (source?: string | string[] | null, limit = 24): string[] => {
  if (!source) return [];

  const raw = Array.isArray(source) ? source : splitText(source);
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const entry of raw) {
    const value = normalize(String(entry ?? ''));
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(value);
    if (bullets.length >= limit) break;
  }

  return bullets;
};

export interface ResolvedBullets {
  bullets: string[];
  fromDescription: boolean;
}

export const resolveBullets = (
  features?: string | string[] | null,
  description?: string | null,
  limit = 24,
): ResolvedBullets => {
  const list = Array.isArray(features)
    ? features
    : typeof features === 'string' && features.trim() !== ''
      ? features.split(',')
      : null;

  const fromFeatures = deriveBullets(list, limit);
  if (fromFeatures.length > 0) return { bullets: fromFeatures, fromDescription: false };

  return { bullets: deriveBullets(description, limit), fromDescription: true };
};

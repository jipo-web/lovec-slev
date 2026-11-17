import React, { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Shows the product tile cut out of the flyer page image, using the
 * bounding box the pipeline detected. No server-side cropping: the full
 * page image is positioned inside an overflow-hidden box so only the
 * bbox region is visible.
 *
 * The pipeline emits [x0, y0, x1, y1] as fractions of the page (0..1).
 * Older data mixed scales per axis; the same rule as pipeline/normalize.py
 * (normalize_bbox) is applied here as a fallback: values <= 1 are fractions,
 * up to 100 percent, above that Gemini's 0..1000 grid.
 */

export type BBox = [number, number, number, number];

/** Pad the box a little so the price tag and label around the tile stay visible. */
const PAD = 0.015;

function axisDivisor(a: number, b: number): number {
  const m = Math.max(a, b);
  return m <= 1 ? 1 : m <= 100 ? 100 : 1000;
}

/** Returns a padded, clamped bbox in fractions, or null when the box is unusable. */
export function normalizeBBox(raw: unknown): BBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const v = raw.map((n) => (typeof n === 'number' && isFinite(n) && n >= 0 ? n : NaN));
  if (v.some((n) => isNaN(n))) return null;
  const dx = axisDivisor(v[0], v[2]);
  const dy = axisDivisor(v[1], v[3]);
  const xs = [Math.min(v[0] / dx, 1), Math.min(v[2] / dx, 1)];
  const ys = [Math.min(v[1] / dy, 1), Math.min(v[3] / dy, 1)];
  const x0 = Math.max(0, Math.min(...xs) - PAD);
  const y0 = Math.max(0, Math.min(...ys) - PAD);
  const x1 = Math.min(1, Math.max(...xs) + PAD);
  const y1 = Math.min(1, Math.max(...ys) + PAD);
  const w = x1 - x0;
  const h = y1 - y0;
  // Too small to show anything useful, or practically the whole page.
  if (w < 0.04 || h < 0.03 || (w > 0.95 && h > 0.95)) return null;
  return [x0, y0, x1, y1];
}

/** True when the offer carries enough data to even attempt a crop. */
export function hasCropData(pageImageUrl?: string | null, bbox?: unknown): boolean {
  return !!pageImageUrl && Array.isArray(bbox) && bbox.length === 4;
}

interface FlyerCropProps {
  pageImageUrl?: string | null;
  bbox?: unknown;
  alt: string;
  /** Height of the box (Tailwind class), e.g. "h-40". Width follows the crop's aspect ratio. */
  heightClass: string;
  className?: string;
}

export const FlyerCrop: React.FC<FlyerCropProps> = ({ pageImageUrl, bbox, alt, heightClass, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const canTry = hasCropData(pageImageUrl, bbox) && !failed;

  // Start loading only when the card gets near the viewport – the grid can hold
  // a couple of thousand cards and every crop needs the whole page image.
  useEffect(() => {
    if (!canTry || visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [canTry, visible]);

  // Load the page image off-DOM to learn its real size (needed to normalise the bbox).
  useEffect(() => {
    if (!visible || !canTry || page) return;
    let cancelled = false;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      if (img.naturalWidth && img.naturalHeight) setPage({ w: img.naturalWidth, h: img.naturalHeight });
      else setFailed(true);
    };
    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };
    img.src = pageImageUrl!;
    return () => {
      cancelled = true;
    };
  }, [visible, canTry, page, pageImageUrl]);

  const box = canTry && page ? normalizeBBox(bbox) : null;

  // Placeholder: no data, image failed, or box unusable after load.
  if (!canTry || (page && !box)) {
    return (
      <div
        ref={ref}
        className={`${heightClass} w-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 ${className}`}
      >
        <ImageOff className="w-6 h-6" />
      </div>
    );
  }

  // Not loaded yet: neutral box of the final height.
  if (!box) {
    return <div ref={ref} className={`${heightClass} w-full bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`} />;
  }

  const [x0, y0, x1, y1] = box;
  const w = x1 - x0;
  const h = y1 - y0;
  const aspect = (w * page!.w) / (h * page!.h);

  return (
    <div
      ref={ref}
      className={`${heightClass} w-full flex justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden ${className}`}
    >
      <div className="relative h-full overflow-hidden" style={{ aspectRatio: `${aspect}` }}>
        <img
          src={pageImageUrl!}
          alt={alt}
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute max-w-none"
          style={{
            width: `${100 / w}%`,
            height: `${100 / h}%`,
            left: `${(-x0 / w) * 100}%`,
            top: `${(-y0 / h) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

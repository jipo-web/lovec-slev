import React, { useState } from 'react';
import { FlyerCrop } from './FlyerCrop';

interface ProductImageProps {
  /** Pre-cut WebP from the pipeline, relative to the site root (media/<store>/<hash>.webp). */
  imageUrl?: string | null;
  pageImageUrl?: string | null;
  bbox?: unknown;
  alt: string;
  /** Height of the box (Tailwind class), e.g. "h-40". */
  heightClass: string;
  className?: string;
}

/**
 * Product picture on a card: the small image the pipeline cut out of the
 * flyer (just the product photo where the model found it). Falls back to the
 * in-browser crop of the whole page when there is no file or it fails to load.
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  imageUrl,
  pageImageUrl,
  bbox,
  alt,
  heightClass,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return <FlyerCrop pageImageUrl={pageImageUrl} bbox={bbox} alt={alt} heightClass={heightClass} className={className} />;
  }
  const src = /^https?:/.test(imageUrl) ? imageUrl : `${import.meta.env.BASE_URL}${imageUrl}`;
  return (
    <div
      className={`${heightClass} w-full flex items-center justify-center p-2 bg-stone-100 dark:bg-slate-800 overflow-hidden ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain rounded-md"
      />
    </div>
  );
};

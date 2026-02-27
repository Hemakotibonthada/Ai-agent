import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type SkeletonShape = 'text' | 'heading' | 'circle' | 'rect' | 'card';

interface SkeletonProps {
  shape?: SkeletonShape;
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

/* ------------------------------------------------------------------ */
/*  Shape style map                                                    */
/* ------------------------------------------------------------------ */
const shapeStyles: Record<SkeletonShape, string> = {
  text: 'skeleton-text',
  heading: 'skeleton-heading',
  circle: 'skeleton-avatar',
  rect: 'skeleton h-20 w-full rounded-lg',
  card: 'skeleton-card',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Skeleton({
  shape = 'text',
  width,
  height,
  className = '',
  count = 1,
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${shapeStyles[shape]} ${className}`} style={style} />
      ))}
    </>
  );
}

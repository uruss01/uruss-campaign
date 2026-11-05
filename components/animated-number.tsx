'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/date';

type Props = {
  value: number | null;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export default function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: Props) {
  const [displayed, setDisplayed] = useState(value ?? 0);
  const current = useRef(value ?? 0);

  useEffect(() => {
    if (value === null) return;
    const from = current.current;
    const to = value;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
      current.current = to;
      setDisplayed(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 1100;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      const next = from + (to - from) * ease;
      current.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else current.current = to;
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  if (value === null) return <span className={`${className} empty-number`}>Not reported</span>;
  return <span className={className} aria-label={`${prefix}${formatNumber(value)}${suffix}`}>
    {prefix && <span className="number-prefix">{prefix}</span>}
    <span>{formatNumber(displayed)}</span>
    {suffix && <span className="number-suffix">{suffix}</span>}
  </span>;
}

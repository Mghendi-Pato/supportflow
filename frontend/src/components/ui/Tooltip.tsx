'use client';
import { useState, useRef } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  /** 'top' (default) | 'bottom' */
  placement?: 'top' | 'bottom';
}

/**
 * Lightweight hover tooltip — no external deps, no portal needed.
 * Wraps any inline element and shows a dark floating label on hover.
 */
export function Tooltip({ text, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 120);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  const positionClass =
    placement === 'bottom'
      ? 'top-full mt-1.5'
      : 'bottom-full mb-1.5';

  const arrowClass =
    placement === 'bottom'
      ? 'top-0 -translate-y-full border-b-gray-800'
      : 'bottom-0 translate-y-full border-t-gray-800';

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {visible && (
        <span
          role="tooltip"
          className={`
            pointer-events-none absolute left-1/2 -translate-x-1/2 z-50
            whitespace-nowrap rounded-lg bg-gray-800 px-2.5 py-1.5
            text-xs font-medium text-white shadow-lg
            ${positionClass}
          `}
        >
          {text}
          {/* Arrow */}
          <span
            className={`
              absolute left-1/2 -translate-x-1/2
              border-4 border-transparent
              ${arrowClass}
            `}
          />
        </span>
      )}
    </span>
  );
}

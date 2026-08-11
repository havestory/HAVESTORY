import { useEffect, useRef, useState } from 'react';

export function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  // Ring position uses smooth lerp (requestAnimationFrame)
  const ringPos = useRef({ x: -100, y: -100 });
  const mouse   = useRef({ x: -100, y: -100 });
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };

      // Dot snaps immediately
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX}px`;
        dotRef.current.style.top  = `${e.clientY}px`;
      }
    };

    const onEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickable =
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a, button, [role="button"], [tabindex]') !== null;
      setHovering(isClickable);
    };

    const lerp = (a: number, b: number, n: number) => a + (b - a) * n;

    const animate = () => {
      ringPos.current.x = lerp(ringPos.current.x, mouse.current.x, 0.12);
      ringPos.current.y = lerp(ringPos.current.y, mouse.current.y, 0.12);

      if (ringRef.current) {
        ringRef.current.style.left = `${ringPos.current.x}px`;
        ringRef.current.style.top  = `${ringPos.current.y}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onEnter, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        className={`cursor-dot ${hovering ? 'hovering' : ''}`}
      />
      <div
        ref={ringRef}
        className={`cursor-ring ${hovering ? 'hovering' : ''}`}
      />
    </>
  );
}

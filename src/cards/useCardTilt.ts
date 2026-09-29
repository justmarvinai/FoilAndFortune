import { type RefObject, useEffect } from 'react';

/**
 * Pointer/touch-driven tilt + foil position. Writes CSS custom properties straight onto the
 * element (no React state), so moving the cursor over a card never re-renders anything.
 *
 * --px / --py: pointer position 0–1 · --hover: 0/1 · --rx / --ry: tilt in degrees.
 */
export function useCardTilt(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const rect = element.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (pending.x - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (pending.y - rect.top) / rect.height));
      element.style.setProperty('--px', px.toFixed(4));
      element.style.setProperty('--py', py.toFixed(4));
      element.style.setProperty('--hover', '1');
      if (!reduced) {
        element.style.setProperty('--ry', `${((px - 0.5) * 22).toFixed(2)}deg`);
        element.style.setProperty('--rx', `${((0.5 - py) * 18).toFixed(2)}deg`);
      }
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      element.classList.add('is-active');
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      pending = null;
      element.classList.remove('is-active');
      for (const name of ['--px', '--py', '--hover', '--rx', '--ry'])
        element.style.removeProperty(name);
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('pointercancel', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('pointercancel', onLeave);
    };
  }, [ref, enabled]);
}

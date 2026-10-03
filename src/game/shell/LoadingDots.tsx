/** Three bouncing card-suit dots for lazy panels (the "Shuffling…" beat, docs/05 §6). */
export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`shell-loading-dots flex gap-1.5 ${className}`} aria-hidden="true">
      <span className="size-3 rounded-full border-2 border-ink bg-coral" />
      <span className="size-3 rounded-full border-2 border-ink bg-sun" />
      <span className="size-3 rounded-full border-2 border-ink bg-teal" />
    </span>
  );
}

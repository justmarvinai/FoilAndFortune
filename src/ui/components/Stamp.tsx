import { motion } from 'motion/react';

export interface StampProps {
  text: string;
  color?: string;
  rotate?: number;
}

/** Rubber-stamp slam ("DEAL!", "SOLD!") for success moments (docs/05 §6). */
export function Stamp({ text, color = 'var(--color-coral)', rotate = -12 }: StampProps) {
  return (
    <motion.span
      initial={{ scale: 2.4, opacity: 0, rotate: rotate - 10 }}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ type: 'spring', stiffness: 700, damping: 18, mass: 0.8 }}
      className="inline-block rounded-lg border-[4px] px-3 py-1 font-display text-3xl tracking-widest uppercase"
      style={{
        color,
        borderColor: color,
        boxShadow: `inset 0 0 0 2px ${color}`,
        textShadow: '0 1px 0 rgb(255 255 255 / 0.4)',
        mixBlendMode: 'multiply',
      }}
    >
      {text}
    </motion.span>
  );
}

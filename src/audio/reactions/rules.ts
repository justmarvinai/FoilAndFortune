import type { DomainEvent } from '@/sim/events';
import type { SfxId, VoiceMood } from '../index';

/**
 * Which sounds sim events make (docs/05 §6 "Feedback & Juice Mapping"), pure and testable.
 *
 * Only sounds nobody else plays: the shell already plays the cha-ching and the delivery
 * (`src/game/shell/reactions.tsx`), the level-up jingle (`CelebrationHost`), sheet open/close
 * (`toggleSheet`) and picks the music (`audioSession.ts`); screens play their own receipt and
 * stinger sounds. This adds the door bell, the register scan, the customers' blip voices and
 * the box opening.
 */

export type AudioAction =
  | { kind: 'sfx'; id: SfxId; delay?: number }
  | { kind: 'speak'; uid: number; mood: VoiceMood; syllables: number };

export interface Reaction {
  /** Rate-limit group: a busy tick plays each group at most once per its gap. */
  key: ReactionKey;
  /** The customer it belongs to: one customer can't chatter several times in a row. */
  uid?: number;
  actions: AudioAction[];
}

export type ReactionKey = 'bell' | 'register' | 'mood' | 'chatter' | 'unbox';

export const reactionLimits = {
  /** Minimum gap (ms) between two reactions of the same group. */
  gapMs: { bell: 900, register: 250, mood: 350, chatter: 600, unbox: 400 } satisfies Record<
    ReactionKey,
    number
  >,
  /** Minimum gap (ms) between two voice reactions of the same customer. */
  perCustomerMs: 2000,
  /** At most this many reactions per window, whatever the groups. */
  maxPerWindow: 6,
  windowMs: 1000,
  /** Satisfaction at exit (−3…+3, docs/02 §5.4) that earns a happy or grumbly blip. */
  happyAt: 1,
  grumbleAt: -1,
  /** Register beeps per sale: one per item, capped, 110 ms apart. */
  maxBeeps: 3,
  beepGap: 0.11,
};

export function reactionFor(event: DomainEvent): Reaction | null {
  switch (event.type) {
    case 'customer/entered':
      return { key: 'bell', actions: [{ kind: 'sfx', id: 'shop.doorBell' }] };
    case 'sale/completed': {
      let items = 0;
      for (const item of event.items) items += item.qty;
      const beeps = Math.min(reactionLimits.maxBeeps, Math.max(1, items));
      return {
        key: 'register',
        actions: Array.from({ length: beeps }, (_, i) => ({
          kind: 'sfx' as const,
          id: 'shop.register' as const,
          delay: i * reactionLimits.beepGap,
        })),
      };
    }
    case 'customer/left': {
      const { uid, satisfaction } = event;
      if (satisfaction >= reactionLimits.happyAt) {
        return { key: 'mood', uid, actions: [{ kind: 'speak', uid, mood: 'happy', syllables: 2 }] };
      }
      if (satisfaction <= reactionLimits.grumbleAt) {
        return {
          key: 'mood',
          uid,
          actions: [{ kind: 'speak', uid, mood: 'grumble', syllables: 2 }],
        };
      }
      return null;
    }
    case 'customer/bubble': {
      const { uid } = event;
      switch (event.bubble) {
        case 'delight':
          return {
            key: 'mood',
            uid,
            actions: [
              { kind: 'sfx', id: 'shop.happy' },
              { kind: 'speak', uid, mood: 'happy', syllables: 3 },
            ],
          };
        case 'angry':
          return {
            key: 'mood',
            uid,
            actions: [
              { kind: 'sfx', id: 'shop.angry' },
              { kind: 'speak', uid, mood: 'grumble', syllables: 2 },
            ],
          };
        case 'steal':
          return {
            key: 'chatter',
            uid,
            actions: [{ kind: 'speak', uid, mood: 'excited', syllables: 2 }],
          };
        case 'ripoff':
          return {
            key: 'chatter',
            uid,
            actions: [{ kind: 'speak', uid, mood: 'grumble', syllables: 1 }],
          };
        case 'outOfStock':
          return {
            key: 'chatter',
            uid,
            actions: [{ kind: 'speak', uid, mood: 'question', syllables: 2 }],
          };
        default:
          return null;
      }
    }
    case 'product/unboxed':
      return { key: 'unbox', actions: [{ kind: 'sfx', id: 'shop.boxOpen' }] };
    default:
      return null;
  }
}

/** Gap-per-group, gap-per-customer and a global window cap, on a caller-supplied clock (ms). */
export class RateLimiter {
  private readonly last = new Map<string, number>();
  private recent: number[] = [];
  suppressed = 0;
  allowed = 0;

  constructor(private readonly limits: typeof reactionLimits = reactionLimits) {}

  allow(key: ReactionKey, now: number, uid?: number): boolean {
    const since = (k: string) => now - (this.last.get(k) ?? Number.NEGATIVE_INFINITY);
    const customer = uid === undefined ? null : `uid:${uid}`;
    this.recent = this.recent.filter((time) => now - time < this.limits.windowMs);
    const ok =
      since(key) >= this.limits.gapMs[key] &&
      (customer === null || since(customer) >= this.limits.perCustomerMs) &&
      this.recent.length < this.limits.maxPerWindow;
    if (!ok) {
      this.suppressed++;
      return false;
    }
    this.allowed++;
    this.last.set(key, now);
    if (customer) this.last.set(customer, now);
    this.recent.push(now);
    // Customers come and go all day: forget the ones not heard from in a while.
    if (this.last.size > 200) {
      for (const [k, time] of this.last)
        if (now - time > 10 * this.limits.perCustomerMs) this.last.delete(k);
    }
    return true;
  }
}

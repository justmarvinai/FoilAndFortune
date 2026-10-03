import { describe, expect, it } from 'vitest';
import type { Cents } from '@/core/money';
import type { DomainEvent } from '@/sim/events';
import { RateLimiter, reactionFor, reactionLimits } from './rules';

const sale = (qty: number): DomainEvent => ({
  type: 'sale/completed',
  uid: 1,
  items: [{ productId: 'p', qty, priceCents: 100 as Cents }],
  totalCents: (100 * qty) as Cents,
});

describe('event → sound mapping', () => {
  it('rings the door bell when a customer walks in (not when they spawn outside)', () => {
    expect(reactionFor({ type: 'customer/entered', uid: 4 })).toEqual({
      key: 'bell',
      actions: [{ kind: 'sfx', id: 'shop.doorBell' }],
    });
    expect(reactionFor({ type: 'customer/arrived', uid: 4, archetypeId: 'arch.kid' })).toBeNull();
  });

  it('beeps the register once per item, capped, before the cha-ching the shell plays', () => {
    const one = reactionFor(sale(1));
    expect(one?.actions).toEqual([{ kind: 'sfx', id: 'shop.register', delay: 0 }]);
    const many = reactionFor(sale(9));
    expect(many?.actions).toHaveLength(reactionLimits.maxBeeps);
    expect(many?.actions.map((a) => (a.kind === 'sfx' ? a.delay : -1))).toEqual([0, 0.11, 0.22]);
    // The cha-ching itself is the shell's (src/game/shell/reactions.tsx): never doubled here.
    expect(many?.actions.some((a) => a.kind === 'sfx' && a.id === 'shop.chaChing')).toBe(false);
  });

  it('turns satisfaction at exit into a happy or grumbly blip, silence in between', () => {
    const left = (satisfaction: number): DomainEvent => ({
      type: 'customer/left',
      uid: 9,
      satisfaction,
      bought: true,
    });
    expect(reactionFor(left(2.5))?.actions).toEqual([
      { kind: 'speak', uid: 9, mood: 'happy', syllables: 2 },
    ]);
    expect(reactionFor(left(-2))?.actions).toEqual([
      { kind: 'speak', uid: 9, mood: 'grumble', syllables: 2 },
    ]);
    expect(reactionFor(left(0.3))).toBeNull();
    expect(reactionFor(left(2))?.uid).toBe(9);
  });

  it('gives bubbles a voice: delight and anger with their SFX, price reactions as chatter', () => {
    const bubble = (kind: Extract<DomainEvent, { type: 'customer/bubble' }>['bubble']) =>
      reactionFor({ type: 'customer/bubble', uid: 2, bubble: kind });
    expect(bubble('delight')?.actions.map((a) => (a.kind === 'sfx' ? a.id : a.mood))).toEqual([
      'shop.happy',
      'happy',
    ]);
    expect(bubble('angry')?.actions.map((a) => (a.kind === 'sfx' ? a.id : a.mood))).toEqual([
      'shop.angry',
      'grumble',
    ]);
    expect(bubble('steal')?.key).toBe('chatter');
    expect(bubble('ripoff')?.actions[0]).toMatchObject({ kind: 'speak', mood: 'grumble' });
    expect(bubble('outOfStock')?.actions[0]).toMatchObject({ kind: 'speak', mood: 'question' });
    expect(bubble('search')).toBeNull();
    expect(bubble('cart')).toBeNull();
  });

  it('opens boxes audibly and stays quiet for events other code already voices', () => {
    expect(reactionFor({ type: 'product/unboxed', productId: 'box', packs: [] })?.actions).toEqual([
      { kind: 'sfx', id: 'shop.boxOpen' },
    ]);
    // Delivery, level-up and sheets have sounds in the shell; the music follows audioSession.ts.
    expect(reactionFor({ type: 'order/delivered', orderUid: 'o1', supplierId: 's' })).toBeNull();
    expect(reactionFor({ type: 'level/up', level: 2 })).toBeNull();
    expect(
      reactionFor({ type: 'clock/phaseChanged', day: 1, from: 'prep', to: 'open' }),
    ).toBeNull();
  });
});

describe('reaction rate limiter', () => {
  it('a busy tick rings one bell, not ten', () => {
    const limiter = new RateLimiter();
    const played = Array.from({ length: 10 }, () => limiter.allow('bell', 1000)).filter(Boolean);
    expect(played).toHaveLength(1);
    expect(limiter.suppressed).toBe(9);
    // After the gap the next customer gets their bell.
    expect(limiter.allow('bell', 1000 + reactionLimits.gapMs.bell - 1)).toBe(false);
    expect(limiter.allow('bell', 1000 + reactionLimits.gapMs.bell)).toBe(true);
  });

  it('limits each group on its own clock', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('bell', 0)).toBe(true);
    expect(limiter.allow('register', 0)).toBe(true);
    expect(limiter.allow('unbox', 0)).toBe(true);
    expect(limiter.allow('register', 100)).toBe(false);
    expect(limiter.allow('register', 300)).toBe(true);
  });

  it('one customer cannot chatter twice in a row, others still can', () => {
    const limiter = new RateLimiter();
    expect(limiter.allow('chatter', 0, 7)).toBe(true);
    expect(limiter.allow('mood', 1000, 7)).toBe(false);
    expect(limiter.allow('mood', 1000, 8)).toBe(true);
    expect(limiter.allow('mood', 1000 + reactionLimits.perCustomerMs, 7)).toBe(true);
  });

  it('caps the total per window during an event storm', () => {
    const limiter = new RateLimiter();
    const groups = ['bell', 'register', 'mood', 'chatter', 'unbox'] as const;
    let played = 0;
    // 200 events over one second from many customers.
    for (let i = 0; i < 200; i++)
      if (limiter.allow(groups[i % groups.length] ?? 'bell', i * 5, i)) played++;
    expect(played).toBeLessThanOrEqual(reactionLimits.maxPerWindow);
    expect(played).toBeGreaterThan(1);
  });
});

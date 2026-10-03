import { useEffect } from 'react';
import { Vector3 } from 'three';
import { presentationBus } from '@/state/presentationBus';
import { useDioramaRuntime } from '../runtime';
import { moodFor } from './agentMath';
import { useLiveRuntime } from './liveRuntime';

/**
 * Domain events → scene feedback (docs/05 §6 juice mapping), visual only: the audio package
 * plays the bell, the register and the stingers from the same events, so nothing here calls
 * `playSfx` (no double sounds).
 *
 * - `sale/completed`: the register drawer and coins, the owner's scan, a `+$` float, a bag.
 * - `customer/left`: the mood their face keeps on the way out; angry exits slam the door.
 * - `customer/bubble`: hearts for delight, steam for anger.
 */
export function LiveEvents() {
  const live = useLiveRuntime();
  const diorama = useDioramaRuntime();
  useEffect(() => {
    const above = (uid: number, lift = 0) => {
      const v = live.agents.get(uid);
      return v ? new Vector3(v.x + v.ox, v.anchor.position.y + lift, v.z + v.oz) : null;
    };
    const offs = [
      presentationBus.on('sale/completed', (event) => {
        diorama.register.sales += 1;
        diorama.register.lastSaleAt = diorama.time;
        live.scanAt = diorama.time;
        live.floats.push({
          cents: event.totalCents,
          at: live.dom.registerTop.clone(),
          time: diorama.time,
        });
        live.particles.push({
          kind: 'coin',
          position: live.dom.registerTop.clone().setY(live.dom.registerTop.y - 0.35),
          count: 6,
          spread: 0.3,
        });
        const v = live.agents.get(event.uid);
        if (v) v.paid = true;
      }),
      presentationBus.on('customer/left', (event) => {
        const v = live.agents.get(event.uid);
        if (!v) return;
        v.mood = moodFor(event.satisfaction);
        if (v.mood === 'angry') v.angry = true;
      }),
      presentationBus.on('customer/bubble', (event) => {
        if (event.bubble === 'delight') {
          const at = above(event.uid, -0.1);
          if (at) live.particles.push({ kind: 'heart', position: at, count: 5, spread: 0.35 });
        } else if (event.bubble === 'angry') {
          const v = live.agents.get(event.uid);
          if (v) v.angry = true;
          const at = above(event.uid, -0.12);
          if (at) live.particles.push({ kind: 'steam', position: at, count: 4, spread: 0.25 });
        }
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [live, diorama]);
  return null;
}

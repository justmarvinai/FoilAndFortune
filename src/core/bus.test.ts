import { describe, expect, it } from 'vitest';
import { createBus } from './bus';

describe('bus', () => {
  it('delivers typed events and supports unsubscribe', () => {
    const bus = createBus<{ ping: number; pong: string }>();
    const got: number[] = [];
    const off = bus.on('ping', (n) => got.push(n));
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(got).toEqual([1]);
  });

  it('onAny sees every event with its type', () => {
    const bus = createBus<{ ping: number; pong: string }>();
    const seen: string[] = [];
    bus.onAny((event) => seen.push(String(event.type)));
    bus.emit('ping', 1);
    bus.emit('pong', 'x');
    expect(seen).toEqual(['ping', 'pong']);
  });
});

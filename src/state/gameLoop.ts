import { defaultBalance } from '@/content/balance';
import type { GameState } from '@/sim/state/types';
import { simClock } from './simClock';

/**
 * Converts real time into whole simulation ticks (one tick = one game-minute).
 * Pure so it can be unit-tested; the backlog is dropped beyond `maxTicks` so a stalled tab or a
 * hitch never fast-forwards a whole afternoon at once.
 */
export function computeTicks(
  accumulatorMs: number,
  deltaMs: number,
  speed: number,
  msPerGameMinute: number,
  maxTicks: number,
): { ticks: number; accumulatorMs: number } {
  if (speed <= 0 || deltaMs <= 0) return { ticks: 0, accumulatorMs };
  let accumulated = accumulatorMs + deltaMs * speed;
  let ticks = Math.floor(accumulated / msPerGameMinute);
  accumulated -= ticks * msPerGameMinute;
  if (ticks > maxTicks) {
    ticks = maxTicks;
    accumulated = 0;
  }
  return { ticks, accumulatorMs: accumulated };
}

export interface GameLoopDeps {
  getGame(): GameState | null;
  advance(ticks: number, realMs: number): void;
  /** Debug override for the length of a game-minute (the engine sandbox's time-scale slider). */
  msPerGameMinute?(): number;
  /** Interaction pause (docs/05 §1.7): while true the clock stands still, whatever the speed. */
  isPaused?(): boolean;
}

/** Play time is flushed at least this often even while nothing ticks (prep, night, pause). */
const PLAY_TIME_FLUSH_MS = 1000;

/** requestAnimationFrame driver for the simulation (docs/06 §6). */
export class GameLoop {
  private frameId = 0;
  private last = 0;
  private accumulator = 0;
  private pendingPlayMs = 0;
  private running = false;

  constructor(private readonly deps: GameLoopDeps) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    // Hidden tabs don't simulate; reset the clock so we don't catch up on return.
    this.last = performance.now();
    this.accumulator = 0;
  };

  private readonly frame = (now: number) => {
    if (!this.running) return;
    // Clamp long frames (debugger pauses, tab switches) so time never jumps.
    const delta = Math.min(now - this.last, 250);
    this.last = now;
    const game = this.deps.getGame();
    if (game && !document.hidden) {
      const { time } = defaultBalance;
      const paused = this.deps.isPaused?.() ?? false;
      const speed = game.clock.phase === 'open' && !paused ? game.clock.speed : 0;
      const result = computeTicks(
        this.accumulator,
        delta,
        speed,
        this.deps.msPerGameMinute?.() ?? time.realSecondsPerGameMinute * 1000,
        time.maxTicksPerFrame,
      );
      this.accumulator = result.accumulatorMs;
      this.pendingPlayMs += delta;
      const msPerMinute = this.deps.msPerGameMinute?.() ?? time.realSecondsPerGameMinute * 1000;
      // Only touch the store when something changed, not every frame (CLAUDE.md rule 7).
      if (result.ticks > 0 || this.pendingPlayMs >= PLAY_TIME_FLUSH_MS) {
        this.deps.advance(result.ticks, this.pendingPlayMs);
        this.pendingPlayMs = 0;
      }
      // Publish continuous time for the view (read after advancing, so it matches the state).
      const clock = this.deps.getGame()?.clock;
      if (clock) {
        simClock.day = clock.day;
        simClock.minute = clock.minute;
        simClock.speed = clock.phase === 'open' && !paused ? clock.speed : 0;
        simClock.fraction =
          clock.phase === 'open' ? Math.min(0.999, this.accumulator / msPerMinute) : 0;
      }
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
}

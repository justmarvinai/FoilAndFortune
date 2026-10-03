import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRegistry } from '@/content/registry';
import { useGame } from '@/state/gameStore';
import type { Insets } from '../camera/cameraMath';
import { parsePlacementKey, placementKey } from './layoutMath';

/**
 * On-screen camera controls (docs/05 §4 "Camera: … buttons"), Q/E and +/− on the keyboard, a
 * keyboard route to every fixture (visually hidden until focused) and a status line for screen
 * readers ("the 3D scene has a textual shop status summary", docs/05 §10).
 */

export const ZOOM_STEP = 1.3;

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-xl border-[3px] border-ink bg-paper text-ink shadow-[0_3px_0_var(--color-ink)] transition-[transform,box-shadow,background-color] duration-100 select-none hover:bg-white active:translate-y-[3px] active:shadow-none pointer-coarse:size-11 [@media(max-height:500px)]:size-9"
    >
      {children}
    </button>
  );
}

/** Keys that type text: shortcuts must not steal them. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(type);
}

export function CameraControls({
  insets,
  onRotate,
  onZoom,
}: {
  insets: Insets;
  onRotate(direction: 1 | -1): void;
  onZoom(direction: 1 | -1): void;
}) {
  const { t } = useTranslation('scene');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat || typing(event.target)) return;
      switch (event.key.toLowerCase()) {
        case 'q':
          onRotate(-1);
          break;
        case 'e':
          onRotate(1);
          break;
        case '+':
        case '=':
          onZoom(1);
          break;
        case '-':
        case '_':
          onZoom(-1);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRotate, onZoom]);

  return (
    <div
      role="toolbar"
      aria-label={t('camera.group')}
      className="pointer-events-auto absolute flex gap-1.5 rounded-2xl bg-ink/35 p-1.5 backdrop-blur-sm"
      style={{ left: insets.left + 10, bottom: 10 }}
    >
      <IconButton label={t('camera.rotateLeft')} onClick={() => onRotate(-1)}>
        <RotateCcw className="size-5" strokeWidth={2.6} />
      </IconButton>
      <IconButton label={t('camera.rotateRight')} onClick={() => onRotate(1)}>
        <RotateCw className="size-5" strokeWidth={2.6} />
      </IconButton>
      <IconButton label={t('camera.zoomOut')} onClick={() => onZoom(-1)}>
        <ZoomOut className="size-5" strokeWidth={2.6} />
      </IconButton>
      <IconButton label={t('camera.zoomIn')} onClick={() => onZoom(1)}>
        <ZoomIn className="size-5" strokeWidth={2.6} />
      </IconButton>
    </div>
  );
}

const NO_KEY = '';

/**
 * Buttons for every fixture, for keyboard and screen-reader users: hidden until one gets focus,
 * then shown as a chip row above the camera controls.
 */
export function FixtureKeys({
  insets,
  onFixture,
  onRegister,
}: {
  insets: Insets;
  onFixture(uid: string): void;
  onRegister(uid: string): void;
}) {
  const { t } = useTranslation('scene');
  const key = useGame((game) => placementKey(game.shop.fixtures), NO_KEY);
  const registry = getRegistry();
  const counts = { shelf: 0, decor: 0 };
  const items = parsePlacementKey(key).flatMap((placement) => {
    const def = registry.fixtures.get(placement.fixtureId);
    if (!def) return [];
    switch (def.category) {
      case 'register':
        return [{ uid: placement.uid, label: t('fixtures.register'), register: true }];
      case 'case':
        return [{ uid: placement.uid, label: t('fixtures.case'), register: false }];
      case 'shelf':
        counts.shelf += 1;
        return [
          { uid: placement.uid, label: t('fixtures.shelf', { n: counts.shelf }), register: false },
        ];
      default:
        counts.decor += 1;
        return [
          { uid: placement.uid, label: t('fixtures.decor', { n: counts.decor }), register: false },
        ];
    }
  });
  return (
    <nav
      aria-label={t('fixtures.group')}
      className="pointer-events-auto absolute flex flex-wrap gap-1.5 opacity-0 focus-within:opacity-100 [&:not(:focus-within)]:pointer-events-none"
      style={{ left: insets.left + 10, bottom: 70, maxWidth: 520 }}
    >
      {items.map((item) => (
        <button
          key={item.uid}
          type="button"
          onClick={() => (item.register ? onRegister(item.uid) : onFixture(item.uid))}
          className="rounded-full border-[3px] border-ink bg-paper px-3 py-1 font-display text-sm tracking-wide text-ink shadow-[0_3px_0_var(--color-ink)]"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Textual shop status for screen readers (docs/05 §10): who's in the shop and who's waiting. Not
 * a live region: arrivals come every few seconds and would drown out everything else.
 */
export function ShopStatus() {
  const { t } = useTranslation('scene');
  const count = useGame((game) => game.customers.active.length, 0);
  const queue = useGame((game) => game.customers.lane.length, 0);
  return (
    <p className="sr-only">
      {queue > 0 ? t('statusQueue', { count, queue }) : t('status', { count })}
    </p>
  );
}

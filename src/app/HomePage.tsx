import { Link } from '@/app/router';

interface HubCard {
  to: string;
  title: string;
  blurb: string;
  emoji: string;
  accent: string;
  badge?: string;
}

// Debug hub for the Phase 1 preview. Debug pages are exempt from i18n (see CLAUDE.md).
const cards: readonly HubCard[] = [
  {
    to: '/debug/art',
    title: 'Card Art',
    blurb: 'Glimmerkin cards with Clay Critters art and our own holo foils. Tilt them!',
    emoji: '🃏',
    accent: 'var(--color-grape)',
  },
  {
    to: '/debug/scene',
    title: 'Shop Diorama',
    blurb:
      'A corner of the toy-diorama shop: shelves, counter, day & evening light, a walking customer.',
    emoji: '🏪',
    accent: 'var(--color-teal)',
  },
  {
    to: '/debug/engine',
    title: 'Engine Sandbox',
    blurb: 'The simulation core: clock, day phases, commands, save & load.',
    emoji: '⚙️',
    accent: 'var(--color-sky)',
  },
  {
    to: '/debug/ui',
    title: 'UI Kit',
    blurb: 'Chunky, tactile game UI components with juice.',
    emoji: '🎛️',
    accent: 'var(--color-coral)',
  },
  {
    to: '/debug/clay',
    title: 'Clay Workshop',
    blurb: 'The card-art renderer up close: soft 3D "vinyl toy" creatures, every pose and biome.',
    emoji: '🧸',
    accent: 'var(--color-sun)',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-full overflow-hidden bg-night text-paper">
      <div
        className="hub-stars pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-14 pb-16 sm:pt-20">
        <span className="mb-4 -rotate-2 rounded-full border-[3px] border-ink bg-sun px-4 py-1 font-display text-sm tracking-wider text-ink shadow-[0_3px_0_var(--color-ink)]">
          Phase 1 · Tech Demo & Art Spike
        </span>
        <h1 className="foil-text text-center font-display text-6xl leading-none tracking-wide drop-shadow-[0_6px_0_rgb(0_0_0/0.35)] sm:text-8xl">
          Foil &amp; Fortune
        </h1>
        <p className="mt-4 max-w-xl text-center text-lg text-paper/80">
          Rip packs, read customers, ride the market, and grow a dusty corner shop into a
          collectibles empire.
        </p>

        <nav
          className="mt-12 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Phase 1 demos"
        >
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative flex flex-col rounded-[var(--radius-panel)] border-[3px] border-ink bg-paper p-5 text-ink shadow-[0_6px_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-1 hover:rotate-[-0.5deg] active:translate-y-[3px] active:shadow-[0_3px_0_var(--color-ink)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid size-12 place-items-center rounded-xl border-[3px] border-ink text-2xl"
                  style={{ background: card.accent }}
                  aria-hidden="true"
                >
                  {card.emoji}
                </span>
                <h2 className="font-display text-2xl tracking-wide">{card.title}</h2>
              </div>
              <p className="mt-3 text-[15px] leading-snug text-ink/80">{card.blurb}</p>
              {card.badge ? (
                <span className="absolute -top-3 -right-3 rotate-6 rounded-lg border-[3px] border-ink bg-coral px-2 py-0.5 font-display text-sm text-white shadow-[0_3px_0_var(--color-ink)] transition-transform group-hover:rotate-12">
                  {card.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <p className="mt-14 text-sm text-paper/50">
          v{__APP_VERSION__} · Nothing here is final. Tell us what you love.
        </p>
      </div>
    </div>
  );
}

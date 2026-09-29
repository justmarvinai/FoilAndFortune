import { Coins, Package, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { CardBack } from '@/cards/CardBack';
import { CardView } from '@/cards/CardView';
import type { GameSpeed } from '@/content/balance/time';
import type { ElementId, Rarity } from '@/content/schema/common';
import { emberdawnCards } from '@/content/tcg/gk/sets/emberdawn';
import {
  Button,
  ElementIcon,
  Modal,
  MoneyCounter,
  Panel,
  ProgressBar,
  RarityGem,
  SpeedControl,
  Stamp,
  StarRating,
  Sticker,
  ToastViewport,
  Tooltip,
  useToasts,
} from '@/ui/components';
import { DebugShell } from './DebugShell';

const RARITIES: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'holoRare',
  'ultraRare',
  'illustrationRare',
  'secretRare',
  'mythicRare',
  'promo',
];
const ELEMENTS: readonly ElementId[] = [
  'ember',
  'tide',
  'bloom',
  'volt',
  'terra',
  'mystic',
  'shade',
  'frost',
  'neutral',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

// Debug page: exempt from i18n (CLAUDE.md).
export default function UiGalleryPage() {
  const push = useToasts((state) => state.push);
  const [cash, setCash] = useState(60_000);
  const [xp, setXp] = useState(0.35);
  const [stars, setStars] = useState(2.5);
  const [speed, setSpeed] = useState<GameSpeed>(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [stampKey, setStampKey] = useState(0);

  return (
    <DebugShell
      title="UI Kit Gallery"
      subtitle="Chunky & tactile components (docs/04 §8, docs/05 §12)"
    >
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button icon={<Sparkles />}>Rip a pack</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="gold" icon={<Coins />}>
              Buy for $104
            </Button>
            <Button variant="danger">Crack slab</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg" icon={<Package />}>
              Large
            </Button>
          </div>
        </Section>

        <Section title="Counters, stars & bars">
          <div className="grid gap-6 md:grid-cols-3">
            <Panel title="Cash register">
              <MoneyCounter cents={cash} className="text-4xl" />
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="gold" onClick={() => setCash((c) => c + 1299)}>
                  +$12.99
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCash((c) => c - 24500)}>
                  −$245 rent
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCash((c) => c + 1_500_000)}>
                  +$15k
                </Button>
              </div>
            </Panel>
            <Panel title="Reputation">
              <StarRating value={stars} size={30} />
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStars((s) => Math.max(0, s - 0.5))}
                >
                  −½
                </Button>
                <Button size="sm" onClick={() => setStars((s) => Math.min(5, s + 0.5))}>
                  +½
                </Button>
              </div>
            </Panel>
            <Panel title="XP">
              <ProgressBar value={xp} label={`Lv 7 · ${Math.round(xp * 1633)} / 1,633 XP`} />
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setXp((v) => Math.min(1, v + 0.15))}>
                  +XP
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setXp(0)}>
                  Reset
                </Button>
              </div>
            </Panel>
          </div>
        </Section>

        <Section title="Controls">
          <div className="flex flex-wrap items-center gap-6">
            <SpeedControl value={speed} onChange={setSpeed} size="md" />
            <Tooltip content="Expected value: what a pack is worth on average if you open it.">
              <span className="cursor-help border-b-2 border-dotted border-ink font-semibold">
                EV
              </span>
            </Tooltip>
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
          </div>
        </Section>

        <Section title="Stickers, stamps & toasts">
          <div className="flex flex-wrap items-center gap-6">
            <Sticker>NEW!</Sticker>
            <Sticker color="var(--color-grape)" rotate={4}>
              1st ED
            </Sticker>
            <Sticker color="var(--color-teal)" rotate={-3}>
              HOT 🔥
            </Sticker>
            <button
              type="button"
              onClick={() => setStampKey((k) => k + 1)}
              className="cursor-pointer"
            >
              <Stamp key={stampKey} text="Deal!" />
            </button>
            <Button
              variant="secondary"
              onClick={() =>
                push({
                  title: 'Level up!',
                  body: 'Level 5 unlocked Manga.',
                  tone: 'celebrate',
                  icon: '🎉',
                })
              }
            >
              Toast: level up
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                push({
                  title: 'Delivery arrived',
                  body: '2 booster boxes',
                  tone: 'info',
                  icon: '📦',
                })
              }
            >
              Toast: delivery
            </Button>
          </div>
        </Section>

        <Section title="Rarity gems & element icons">
          <div className="flex flex-wrap items-end gap-6">
            {RARITIES.map((rarity) => (
              <span key={rarity} className="flex flex-col items-center gap-1 text-xs">
                <RarityGem rarity={rarity} size={22} />
                {rarity}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {ELEMENTS.map((element) => (
              <span key={element} className="flex flex-col items-center gap-1 text-xs">
                <ElementIcon element={element} size={40} />
                {element}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Cards (placeholder art, real frames & foils)">
          <div className="flex flex-wrap items-start gap-8 rounded-3xl bg-night p-8">
            {emberdawnCards.map((card) => (
              <CardView key={card.id} card={card} width={260} />
            ))}
            {emberdawnCards[0] ? (
              <CardView card={emberdawnCards[0]} finish="reverseHolo" width={260} />
            ) : null}
            <CardBack width={260} />
          </div>
        </Section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Open this box?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Keep sealed
            </Button>
            <Button variant="gold" onClick={() => setModalOpen(false)}>
              Rip it!
            </Button>
          </>
        }
      >
        <p>Opening this 1st Edition box forfeits its sealed value ($1,240).</p>
      </Modal>
      <ToastViewport />
    </DebugShell>
  );
}

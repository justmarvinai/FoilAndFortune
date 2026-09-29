import { Dices, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Difficulty } from '@/content/balance/difficulty';
import { formatMoney } from '@/core/money';
import type { SaveFile } from '@/save/saveFile';
import { useGameStore } from '@/state/gameStore';
import { getSaveManager } from '@/state/persistence';
import { Button, Panel, SegmentedControl } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md); difficulty names use the real keys.

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const field =
  'w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-semibold shadow-[inset_0_2px_0_rgb(0_0_0/0.08)] outline-none focus:border-teal';

/** Title-screen prototype: continue the latest save or open a new shop. */
export function NewGamePanel() {
  const { t } = useTranslation();
  const startNewGame = useGameStore((store) => store.startNewGame);
  const loadGame = useGameStore((store) => store.loadGame);
  const [shopName, setShopName] = useState('Corner Cards');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [seed, setSeed] = useState(randomSeed);
  const [latest, setLatest] = useState<SaveFile | null>(null);

  useEffect(() => {
    let alive = true;
    getSaveManager()
      .loadLatest()
      .then(
        (file) => {
          if (alive) setLatest(file ?? null);
        },
        () => undefined,
      );
    return () => {
      alive = false;
    };
  }, []);

  const name = shopName.trim();

  return (
    <div className="space-y-10">
      {latest ? (
        <Panel title="Continue">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl tracking-wide">{latest.summary.shopName}</p>
              <p className="text-ink/70">
                Day {latest.summary.day} · Lv {latest.summary.level} ·{' '}
                {formatMoney(latest.summary.cashCents)}
              </p>
            </div>
            <Button size="lg" icon={<Play />} onClick={() => loadGame(latest.state)}>
              {t('actions.continue')}
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel theme="clipboard" title={t('actions.newGame')}>
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="font-display tracking-wide">Shop name</span>
            <input
              className={field}
              value={shopName}
              maxLength={32}
              onChange={(event) => setShopName(event.target.value)}
            />
          </label>

          <div className="space-y-1.5">
            <span className="block font-display tracking-wide">Difficulty</span>
            <SegmentedControl<Difficulty>
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'cozy', label: t('difficulty.cozy') },
                { value: 'standard', label: t('difficulty.standard') },
                { value: 'tycoon', label: t('difficulty.tycoon') },
              ]}
            />
            <p className="font-hand text-xl text-ink/75">{t(`difficulty.${difficulty}Blurb`)}</p>
          </div>

          <label className="block space-y-1.5">
            <span className="font-display tracking-wide">World seed</span>
            <span className="flex gap-2">
              <input
                className={`${field} tabular-nums`}
                inputMode="numeric"
                value={seed}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value.replace(/\D/g, '') || '0', 10);
                  setSeed(Math.min(next, 0xffff_ffff));
                }}
              />
              <Button
                variant="secondary"
                aria-label="Random seed"
                onClick={() => setSeed(randomSeed())}
              >
                <Dices className="size-5" />
              </Button>
            </span>
          </label>

          <Button
            variant="gold"
            size="lg"
            icon={<Sparkles />}
            disabled={name.length === 0}
            onClick={() => startNewGame({ seed, shopName: name, difficulty })}
          >
            Open the shop
          </Button>
        </div>
      </Panel>
    </div>
  );
}

import { BookHeart, Check, PackageOpen, X } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardView } from '@/cards/CardView';
import { formatMoney } from '@/core/money';
import { openProductWithStage, runCommand } from '@/game/actions';
import { itemMarketValue } from '@/sim/pricing';
import { sealedInStorage } from '@/sim/systems/inventory';
import { useGame } from '@/state/gameStore';
import { Button } from '@/ui/components/Button';
import { NewSticker, RarityLabel, rarityStyle } from './bits';
import {
  bestPull,
  binderPlan,
  groupPulls,
  hitCountsByRarity,
  type OpeningModel,
  type PullGroup,
  type StageContext,
  summaryTotals,
} from './model';
import { sfx } from './stageAudio';

const NO_BINDER: Readonly<Record<string, { cardKey: string }>> = {};

/** A pulled card in the summary grid (tap to inspect). */
function Cell({ group, order, onInspect }: { group: PullGroup; order: number; onInspect(): void }) {
  const { t } = useTranslation(['opening', 'cards']);
  const { card } = group;
  return (
    <button
      type="button"
      className="ffo-cell"
      data-hit={card.hit}
      style={rarityStyle(card.rarity, { '--d': `${Math.min(order, 24) * 35}ms` })}
      aria-label={t('summary.cellAria', {
        name: card.def.name,
        rarity: t(`rarity.${card.rarity}`, { ns: 'cards' }),
        value: formatMoney(card.valueCents),
        count: group.count,
      })}
      onClick={onInspect}
    >
      <span className="ffo-cell__card">
        <CardView card={card.def} finish={card.finish} width="100%" interactive={false} />
        {group.isNew ? <NewSticker className="ffo-cell__new" /> : null}
        {group.count > 1 ? (
          <span className="ffo-count">{t('copies', { count: group.count })}</span>
        ) : null}
      </span>
      <span className="ffo-cell__value">{formatMoney(card.valueCents)}</span>
    </button>
  );
}

/**
 * The end of the show (docs/01 §14.1, docs/05 §5.7): every pull in a grid with NEW badges and
 * values, a tally slip with market value against what the product cost and a verdict stamp, and
 * the quick actions. Boxes add hit counts by rarity and the best pull (docs/01 §14.2).
 */
export function SummaryView({
  model,
  ctx,
  reduced,
  onInspect,
  onDone,
}: {
  model: OpeningModel;
  ctx: StageContext;
  reduced: boolean;
  onInspect(group: PullGroup): void;
  onDone(): void;
}) {
  const { t } = useTranslation('opening');
  const binder = useGame((game) => game.collection.binder, NO_BINDER);
  const stockLeft = useGame((game) => sealedInStorage(game, model.productId), 0);
  const [added, setAdded] = useState<number | null>(null);
  const totals = summaryTotals(model);
  const groups = groupPulls(model.cards);
  const hitRows = hitCountsByRarity(model.cards);
  const best = model.presentation === 'box' ? bestPull(model.cards) : null;
  const product = ctx.content.products.get(model.productId);
  const valueOfKey = (cardKey: string) => itemMarketValue(ctx, { cardKey }) ?? 0;
  const plan = binderPlan(model, binder, valueOfKey);
  const canOpenAnother = product?.kind === 'booster' && stockLeft > 0;

  function addHitsToBinder() {
    let count = 0;
    for (const cardKey of plan) {
      if (runCommand({ type: 'collection/addToBinder', cardKey }).ok) count += 1;
    }
    setAdded(count);
    sfx(count > 0 ? 'ui.coin' : 'ui.error');
  }

  const delta = totals.deltaCents;

  return (
    <div className="ffo-view">
      <div className="ffo-summary" data-reduced={reduced}>
        <aside className="ffo-slip" aria-label={t('summary.tally')}>
          <h2>{t('summary.tally')}</h2>
          <p className="ffo-slip__meta">
            {t('summary.cards', { count: totals.cards })}
            {totals.newCards > 0 ? ` · ${t('summary.newCount', { count: totals.newCards })}` : ''}
          </p>
          {totals.verdict ? (
            <span className="ffo-stamp" data-verdict={totals.verdict}>
              {t(`verdict.${totals.verdict}`)}
            </span>
          ) : null}
          <div className="ffo-slip__lines">
            <div className="ffo-slip__line">
              <span>{t('summary.marketValue')}</span>
              <span>{formatMoney(totals.totalCents)}</span>
            </div>
            {totals.costCents !== null ? (
              <div className="ffo-slip__line">
                <span>{t('summary.cost')}</span>
                <span>{formatMoney(totals.costCents)}</span>
              </div>
            ) : null}
            {delta !== null ? (
              <div className="ffo-slip__line ffo-slip__line--total">
                <span>{t('summary.net')}</span>
                <span className={delta >= 0 ? 'ffo-up' : 'ffo-down'}>
                  {formatMoney(delta, { signed: true })}
                </span>
              </div>
            ) : null}
          </div>
          {hitRows.length > 0 ? (
            <ul className="ffo-slip__hits" aria-label={t('summary.hitCounts')}>
              {hitRows.map((row) => (
                <li key={row.rarity}>
                  <RarityLabel rarity={row.rarity} />
                  <span>{t('copies', { count: row.count })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ffo-slip__meta">{t('summary.noHits')}</p>
          )}
          <div className="ffo-slip__actions">
            {totals.hits > 0 ? (
              <Button
                variant="gold"
                icon={added !== null || plan.length === 0 ? <Check /> : <BookHeart />}
                disabled={added !== null || plan.length === 0}
                onClick={addHitsToBinder}
              >
                {added !== null
                  ? t('summary.added', { count: added })
                  : plan.length === 0
                    ? t('summary.binderDone')
                    : t('summary.addToBinder', { count: plan.length })}
              </Button>
            ) : null}
            {canOpenAnother ? (
              <Button
                variant="primary"
                icon={<PackageOpen />}
                onClick={() => {
                  sfx('ui.open');
                  openProductWithStage(model.productId);
                }}
              >
                {t('summary.openAnother', { count: stockLeft })}
              </Button>
            ) : null}
            <Button variant="secondary" icon={<X />} onClick={onDone}>
              {t('summary.done')}
            </Button>
          </div>
        </aside>
        <section className="ffo-pulls" aria-label={t('summary.pulls')}>
          <div className="ffo-pulls__head">
            <h2>{t('summary.pulls')}</h2>
            <span className="ffo-label">{t('summary.tapToInspect')}</span>
          </div>
          {best ? (
            <button
              type="button"
              className="ffo-best"
              style={rarityStyle(best.rarity)}
              onClick={() => {
                const group = groups.find((entry) => entry.key === best.cardKey);
                if (group) onInspect(group);
              }}
            >
              <span className="ffo-best__card">
                <CardView card={best.def} finish={best.finish} width="100%" interactive={false} />
              </span>
              <span className="ffo-best__text">
                <span className="ffo-label">{t('summary.bestPull')}</span>
                <span className="ffo-zoom__name">{best.def.name}</span>
                <span className="ffo-best__rarity">
                  <RarityLabel rarity={best.rarity} />
                </span>
                <span className="ffo-cell__value">{formatMoney(best.valueCents)}</span>
              </span>
            </button>
          ) : null}
          <div className="ffo-grid">
            {groups.map((group, i) => (
              <Cell key={group.key} group={group} order={i} onInspect={() => onInspect(group)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Card Inspect, stage edition (docs/05 §5.8): a big card with tilt and foil. */
export function CardZoom({
  group,
  reduced,
  onClose,
}: {
  group: PullGroup;
  reduced: boolean;
  onClose(): void;
}) {
  const { t } = useTranslation('opening');
  const { card } = group;
  return (
    <div
      className="ffo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={card.def.name}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ffo-zoom" style={rarityStyle(card.rarity) as CSSProperties}>
        <div className="ffo-zoom__card">
          <CardView card={card.def} finish={card.finish} width="100%" interactive={!reduced} />
        </div>
        <div className="ffo-zoom__info">
          <span className="ffo-zoom__name">{card.def.name}</span>
          <span className="ffo-best__rarity">
            <RarityLabel rarity={card.rarity} size={22} />
          </span>
          <span className="ffo-label">{t('zoom.value')}</span>
          <span className="ffo-zoom__value">{formatMoney(card.valueCents)}</span>
          <span className="ffo-zoom__meta">
            {group.isNew ? <NewSticker /> : null}
            {group.count > 1 ? <span>{t('zoom.copies', { count: group.count })}</span> : null}
            {card.misprint ? <span>{t(`misprint.${card.misprint}`)}</span> : null}
          </span>
          <Button variant="secondary" icon={<X />} onClick={onClose} autoFocus>
            {t('zoom.back')}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { Download, FolderOpen, Save, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/core/money';
import { decodeSave, exportSave, MAX_IMPORT_CHARS, saveFileName } from '@/save/exportImport';
import { manualSlots, type SaveSlotId, saveSlotIds, toSaveFile } from '@/save/saveFile';
import type { SlotInfo } from '@/save/saveManager';
import { useGameStore } from '@/state/gameStore';
import { getSaveManager } from '@/state/persistence';
import { Button, Panel, useToasts } from '@/ui/components';

// Debug page: exempt from i18n (CLAUDE.md).

const SLOT_LABEL: Record<SaveSlotId, string> = {
  'slot-1': 'Slot 1',
  'slot-2': 'Slot 2',
  'slot-3': 'Slot 3',
  'auto-1': 'Autosave',
  'auto-2': 'Autosave −1',
  'auto-3': 'Autosave −2',
  'auto-weekly': 'Weekly (Mon)',
};

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function ago(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Save slots on a shop tablet: 3 manual slots, the autosave ring, the weekly autosave, and
 * `.ffsave` export/import (docs/06 §11). `revision` bumps whenever an autosave lands.
 */
export function SavesPanel({ revision }: { revision: number }) {
  const saves = getSaveManager();
  const hasGame = useGameStore((store) => store.game !== null);
  const loadGame = useGameStore((store) => store.loadGame);
  const push = useToasts((store) => store.push);
  const fileInput = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<ReadonlyMap<SaveSlotId, SlotInfo> | null>(null);

  const refresh = useCallback(() => {
    saves.list().then(
      (infos) => setSlots(new Map(infos.map((info) => [info.slot, info]))),
      (error: unknown) =>
        push({ title: 'Could not read saves', body: errorText(error), tone: 'warning' }),
    );
  }, [saves, push]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` is the refresh signal.
  useEffect(refresh, [refresh, revision]);

  const saveTo = async (slot: SaveSlotId) => {
    const game = useGameStore.getState().game;
    if (!game) return;
    try {
      await saves.save(game, slot, new Date().toISOString());
      push({ title: `Saved to ${SLOT_LABEL[slot]}`, tone: 'success', icon: '💾' });
      refresh();
    } catch (error) {
      push({ title: 'Save failed', body: errorText(error), tone: 'warning' });
    }
  };

  const loadFrom = async (slot: SaveSlotId) => {
    try {
      const file = await saves.load(slot);
      if (!file) return;
      loadGame(file.state);
      push({
        title: `Loaded ${file.summary.shopName}`,
        body: `Day ${file.summary.day}`,
        tone: 'info',
        icon: '📂',
      });
    } catch (error) {
      push({ title: 'Load failed', body: errorText(error), tone: 'warning' });
    }
  };

  const remove = async (slot: SaveSlotId) => {
    await saves.remove(slot);
    refresh();
  };

  const exportCurrent = () => {
    const game = useGameStore.getState().game;
    if (!game) return;
    const file = toSaveFile(game, 'slot-1', new Date().toISOString());
    downloadText(saveFileName(file), exportSave(file));
  };

  const importFile = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_CHARS) throw new Error('That file is too large to be a save.');
      const parsed = saves.parse(decodeSave(await file.text()));
      loadGame(parsed.state);
      push({
        title: 'Backup imported',
        body: `${parsed.summary.shopName}, day ${parsed.summary.day}`,
        tone: 'success',
        icon: '📥',
      });
    } catch (error) {
      push({ title: 'Import failed', body: errorText(error), tone: 'warning', icon: '⚠️' });
    }
  };

  return (
    <Panel theme="tablet" title="Saves">
      <ul className="divide-y divide-white/10">
        {saveSlotIds.map((slot) => {
          const info = slots?.get(slot);
          const manual = (manualSlots as readonly SaveSlotId[]).includes(slot);
          return (
            <li key={slot} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-28 font-display tracking-wide text-sun">{SLOT_LABEL[slot]}</span>
              <span className="min-w-0 flex-1 text-sm text-paper/80">
                {info ? (
                  <>
                    <span className="font-semibold text-paper">{info.summary.shopName}</span> · Day{' '}
                    {info.summary.day} · Lv {info.summary.level} ·{' '}
                    {formatMoney(info.summary.cashCents)}{' '}
                    <span className="text-paper/50">({ago(info.savedAt)})</span>
                  </>
                ) : (
                  <span className="text-paper/40">{slots ? 'Empty' : '…'}</span>
                )}
              </span>
              <span className="flex gap-1.5">
                {manual ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Save />}
                    disabled={!hasGame}
                    onClick={() => void saveTo(slot)}
                  >
                    Save
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  icon={<FolderOpen />}
                  disabled={!info}
                  onClick={() => void loadFrom(slot)}
                >
                  Load
                </Button>
                {manual && info ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${SLOT_LABEL[slot]}`}
                    onClick={() => void remove(slot)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Button
          variant="gold"
          size="sm"
          icon={<Download />}
          disabled={!hasGame}
          onClick={exportCurrent}
        >
          Export backup
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload />}
          onClick={() => fileInput.current?.click()}
        >
          Import backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".ffsave,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </div>
    </Panel>
  );
}

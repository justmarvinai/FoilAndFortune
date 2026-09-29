import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { SaveFile } from './saveFile';

/**
 * `.ffsave` backup files (docs/06 §11): a header line followed by base64 of deflated JSON.
 * Text-based so players can email, sync or paste them.
 */
const HEADER = 'FOIL-AND-FORTUNE-SAVE 1';
/** Refuse absurd inputs before decompressing (zip-bomb guard). */
export const MAX_IMPORT_CHARS = 8 * 1024 * 1024;
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;

export class SaveImportError extends Error {
  override name = 'SaveImportError';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function exportSave(file: SaveFile): string {
  const packed = deflateSync(strToU8(JSON.stringify(file)), { level: 9 });
  return `${HEADER}\n${bytesToBase64(packed)}\n`;
}

/** Returns the raw decoded object; pass it to `SaveManager.parse` to validate and migrate. */
export function decodeSave(text: string): unknown {
  if (text.length > MAX_IMPORT_CHARS)
    throw new SaveImportError('That file is too large to be a save.');
  const [header, body] = text.trim().split(/\r?\n/, 2);
  if (header !== HEADER || !body)
    throw new SaveImportError('That file is not a Foil & Fortune save.');
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(base64ToBytes(body.trim()));
  } catch {
    throw new SaveImportError('That save file is damaged.');
  }
  if (bytes.length > MAX_INFLATED_BYTES) throw new SaveImportError('That save file is too large.');
  try {
    return JSON.parse(strFromU8(bytes)) as unknown;
  } catch {
    throw new SaveImportError('That save file is damaged.');
  }
}

export function saveFileName(file: SaveFile): string {
  const safe = file.summary.shopName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${safe || 'shop'}-day-${file.summary.day}.ffsave`;
}

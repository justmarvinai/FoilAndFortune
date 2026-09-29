import type { ElementId } from '@/content/schema/common';

export interface ElementDef {
  id: ElementId;
  /** i18n key suffix; display names come from locales. */
  nameKey: string;
  /** Main color (docs/03 §3.2). */
  color: string;
  /** Light tint for card bodies. */
  tint: string;
  /** Dark shade for outlines and text on tint. */
  shade: string;
  /** Symbol id rendered by the element icon component. */
  symbol:
    | 'flame'
    | 'wave'
    | 'sprout'
    | 'bolt'
    | 'stones'
    | 'eye-star'
    | 'crescent'
    | 'snowflake'
    | 'ring-star';
}

export const elements: Record<ElementId, ElementDef> = {
  ember: {
    id: 'ember',
    nameKey: 'ember',
    color: '#FF6B35',
    tint: '#FFE3D3',
    shade: '#9A2E0B',
    symbol: 'flame',
  },
  tide: {
    id: 'tide',
    nameKey: 'tide',
    color: '#2EA7E0',
    tint: '#D8F1FB',
    shade: '#0D5A80',
    symbol: 'wave',
  },
  bloom: {
    id: 'bloom',
    nameKey: 'bloom',
    color: '#4CB944',
    tint: '#DDF3D8',
    shade: '#23661E',
    symbol: 'sprout',
  },
  volt: {
    id: 'volt',
    nameKey: 'volt',
    color: '#FFD23F',
    tint: '#FFF4CC',
    shade: '#8A6A00',
    symbol: 'bolt',
  },
  terra: {
    id: 'terra',
    nameKey: 'terra',
    color: '#B5835A',
    tint: '#F1E4D6',
    shade: '#5E3F23',
    symbol: 'stones',
  },
  mystic: {
    id: 'mystic',
    nameKey: 'mystic',
    color: '#B15EFF',
    tint: '#EFE0FF',
    shade: '#5B1FA0',
    symbol: 'eye-star',
  },
  shade: {
    id: 'shade',
    nameKey: 'shade',
    color: '#3D3B8E',
    tint: '#DEDDF3',
    shade: '#1D1B52',
    symbol: 'crescent',
  },
  frost: {
    id: 'frost',
    nameKey: 'frost',
    color: '#7FDBFF',
    tint: '#E3F8FF',
    shade: '#1F6E8C',
    symbol: 'snowflake',
  },
  neutral: {
    id: 'neutral',
    nameKey: 'neutral',
    color: '#C9C3B6',
    tint: '#F4F2EC',
    shade: '#5F594D',
    symbol: 'ring-star',
  },
};

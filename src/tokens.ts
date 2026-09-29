import type { Category } from './types.ts';

export type Theme = 'light' | 'dark';

export interface MapTokens {
  land: string;
  water: string;
  park: string;
  building: string;
  roadMinor: string;
  roadMajor: string;
  roadCasing: string;
  highway: string;
  highwayCasing: string;
  rail: string;
  boundary: string;
  label: string;
  labelMinor: string;
  labelHalo: string;
  labelWater: string;
  ink: string;
  accent: string;
  /** Dark dashes laid over active roadwork lines. */
  hazard: string;
  category: Record<Category | 'complete', string>;
  categorySelected: Record<Category | 'complete', string>;
}

// Mirrors docs/style-guide.md §3. The CSS custom properties in styles.css carry the same values.
export const TOKENS: Record<Theme, MapTokens> = {
  light: {
    land: '#F1EEE7',
    water: '#C8D5DE',
    park: '#DCE3CF',
    building: '#E4E0D6',
    roadMinor: '#FFFFFF',
    roadMajor: '#FFFFFF',
    roadCasing: '#DAD5CA',
    highway: '#E9E3D6',
    highwayCasing: '#CFC7B8',
    rail: '#B9B3A6',
    boundary: '#B9B3A6',
    label: '#4F545C',
    labelMinor: '#6B7280',
    labelHalo: '#F1EEE7',
    labelWater: '#3A566B',
    ink: '#1B1F24',
    accent: '#F26B1D',
    hazard: '#1B1F24',
    category: {
      residential: '#3A6FD0',
      commercial: '#C2379F',
      civic: '#735A12',
      transport: '#E35A0B',
      trails: '#17935C',
      complete: '#A6A5A0',
    },
    categorySelected: {
      residential: '#2F5FB8',
      commercial: '#A92E8A',
      civic: '#5A460E',
      transport: '#B8480C',
      trails: '#0F7A4B',
      complete: '#5C5B57',
    },
  },
  dark: {
    land: '#0E1B2E',
    water: '#081424',
    park: '#0F2A2A',
    building: '#152640',
    roadMinor: '#1A2D47',
    roadMajor: '#22395A',
    roadCasing: '#0E1B2E',
    highway: '#2C4870',
    highwayCasing: '#0E1B2E',
    rail: '#3A5478',
    boundary: '#3A5478',
    label: '#9FB2CC',
    labelMinor: '#8393AB',
    labelHalo: '#0E1B2E',
    labelWater: '#7F9CC0',
    ink: '#E8EDF5',
    accent: '#FF7A33',
    hazard: '#0E1B2E',
    category: {
      residential: '#5C8BF7',
      commercial: '#F59CCB',
      civic: '#F2D25A',
      transport: '#F07430',
      trails: '#2EBD78',
      complete: '#5F6A72',
    },
    categorySelected: {
      residential: '#9DB9FA',
      commercial: '#F8BADB',
      civic: '#F6E08C',
      transport: '#F59E6E',
      trails: '#6DD1A1',
      complete: '#8F979C',
    },
  },
};

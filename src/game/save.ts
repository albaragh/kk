import type { Lang, Panel, Quality } from "./types";
import type { QuestProgress } from "./logic";

export type SaveData = {
  version: 1;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  energy: number;
  level: number;
  xp: number;
  points: number;
  motes: number;
  weapon: string;
  armor: string;
  inv: Record<string, number>;
  skills: Record<string, number>;
  quests: Record<string, QuestProgress>;
  dead: string[];
  used: string[];
  discovered: string[];
  flags: Record<string, number>;
  mirrors: number[];
  gears: number[];
  mirrorSolved: boolean;
  gearSolved: boolean;
  spawnX: number;
  spawnZ: number;
  time: number;
  kills: number;
  deaths: number;
  parries: number;
  play: number;
  hasGlider: boolean;
  ending?: "none" | "seal" | "share";
};

export type Settings = {
  lang: Lang;
  quality: Quality;
  music: number;
  sfx: number;
  sens: number;
  shake: boolean;
  touch: boolean;
};

const SAVE_KEY = "kot-save-v1";
const SET_KEY = "kot-settings-v1";

export const DEFAULT_SETTINGS: Settings = {
  lang: "ar",
  quality: "med",
  music: 0.55,
  sfx: 0.8,
  sens: 0.0024,
  shake: true,
  touch: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SET_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s: Settings): void {
  localStorage.setItem(SET_KEY, JSON.stringify(s));
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1 || typeof data.x !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export type PhaseName = "title" | "cinematic" | "play" | "dead" | "ending";
export type PanelName = Panel;

export type Lang = "ar" | "en";
export type Quality = "low" | "med" | "high";
export type Phase = "title" | "cinematic" | "play" | "dead" | "ending";
export type Panel = "none" | "pause" | "map" | "inv" | "skills" | "quests" | "shop" | "craft" | "settings";

export type MatId =
  | "sandstone"
  | "plaster"
  | "wood"
  | "copper"
  | "cloth"
  | "stone"
  | "ice"
  | "ash"
  | "metal"
  | "glow"
  | "leaf"
  | "moon";

export type Block = {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rot: number;
  base: number;
  mat: MatId;
  shape: "box" | "dome" | "cyl" | "arch" | "cone";
  climb?: boolean;
  solid?: boolean;
};

export type PropKind = "palm" | "rock" | "tree" | "pine" | "crystal" | "pillar" | "dead" | "reed";

export type PropInst = {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  s: number;
  r: number;
};

export type Archetype =
  | "raider"
  | "guard"
  | "archer"
  | "mage"
  | "brute"
  | "captain"
  | "beast"
  | "auto"
  | "thief"
  | "trainer"
  | "boss_bloom"
  | "boss_frost"
  | "boss_ash"
  | "boss_lost"
  | "boss_moon";

export type ItemKind = "weapon" | "armor" | "consume" | "mat" | "quest";

export type ItemDef = {
  id: string;
  ar: string;
  en: string;
  kind: ItemKind;
  power: number;
  armor: number;
  heal: number;
  buff: number;
  arDesc: string;
  enDesc: string;
};

export type Objective =
  | { type: "reach"; x: number; z: number; r: number; minY?: number; ar: string; en: string }
  | { type: "defeat"; tag: string; count: number; ar: string; en: string }
  | { type: "talk"; npc: string; ar: string; en: string }
  | { type: "interact"; tag: string; count: number; ar: string; en: string }
  | { type: "have"; item: string; ar: string; en: string }
  | { type: "puzzle"; id: string; ar: string; en: string }
  | { type: "parry"; count: number; ar: string; en: string }
  | { type: "discover"; count: number; ar: string; en: string };

export type QuestDef = {
  id: string;
  kind: "main" | "side" | "secret";
  ar: string;
  en: string;
  arSum: string;
  enSum: string;
  giver: string;
  objectives: Objective[];
  xp: number;
  motes: number;
  items?: string[];
  next?: string;
  hidden?: boolean;
};

export type Choice = { ar: string; en: string; next?: string; act?: string };

export type DNode = { ar: string; en: string; choices: Choice[] };

export type NpcDef = {
  id: string;
  ar: string;
  en: string;
  x: number;
  z: number;
  robe: string;
  dialogue: string;
};

export type EnemyDef = {
  id: string;
  arch: Archetype;
  tag: string;
  x: number;
  z: number;
  home?: { x: number; z: number }[];
};

export type InteractDef = {
  id: string;
  tag: string;
  x: number;
  z: number;
  r: number;
  ar: string;
  en: string;
  kind:
    | "talk"
    | "puzzle"
    | "once"
    | "shop"
    | "craft"
    | "travel"
    | "pickup"
    | "well"
    | "spring"
    | "note";
  npc?: string;
  item?: string;
  ref?: string;
};

export type Recipe = {
  id: string;
  ar: string;
  en: string;
  inputs: Record<string, number>;
  output: string;
  count: number;
  station: "bench" | "forge";
};

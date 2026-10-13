import { QUESTS, itemDef } from "./content.ts";
import type { Objective, QuestDef } from "./types";

export type QuestProgress = { status: "locked" | "active" | "done"; step: number; counts: Record<string, number> };

export type GameEvent =
  | { type: "talk"; npc: string }
  | { type: "defeat"; tag: string; id?: string }
  | { type: "interact"; tag: string; id: string }
  | { type: "puzzle"; id: string }
  | { type: "parry" }
  | { type: "discover"; kingdom: string }
  | { type: "inv" };

export function blankQuests(): Record<string, QuestProgress> {
  const q: Record<string, QuestProgress> = {};
  for (const def of QUESTS) {
    q[def.id] = {
      status: def.id === "q_awaken" ? "active" : "locked",
      step: 0,
      counts: {},
    };
  }
  return q;
}

export function objectiveKey(obj: Objective): string {
  if (obj.type === "defeat" || obj.type === "interact") return `${obj.type}:${obj.tag}`;
  if (obj.type === "discover") return "discover";
  if (obj.type === "parry") return "parry";
  if (obj.type === "have") return `have:${obj.item}`;
  if (obj.type === "talk") return `talk:${obj.npc}`;
  if (obj.type === "puzzle") return `puzzle:${obj.id}`;
  return `reach:${obj.x}:${obj.z}`;
}

function stepDone(obj: Objective, counts: Record<string, number>, inv: Record<string, number>): boolean {
  if (obj.type === "have") return (inv[obj.item] ?? 0) > 0;
  if (obj.type === "defeat" || obj.type === "interact" || obj.type === "parry" || obj.type === "discover") {
    return (counts[objectiveKey(obj)] ?? 0) >= obj.count;
  }
  if (obj.type === "talk" || obj.type === "puzzle" || obj.type === "reach") return (counts[objectiveKey(obj)] ?? 0) >= 1;
  return false;
}

export type QuestAdvance = { completed: string[]; started: string[]; advanced: string[] };

export function startQuest(quests: Record<string, QuestProgress>, id: string): boolean {
  const q = quests[id];
  if (!q || q.status === "done" || q.status === "active") return false;
  q.status = "active";
  q.step = 0;
  return true;
}

function questById(id: string): QuestDef | undefined {
  return QUESTS.find((d) => d.id === id);
}

export function applyEvent(
  quests: Record<string, QuestProgress>,
  event: GameEvent,
  inv: Record<string, number>,
  discovered: string[],
): QuestAdvance {
  const out: QuestAdvance = { completed: [], started: [], advanced: [] };
  for (const def of QUESTS) {
    const q = quests[def.id];
    if (!q || q.status !== "active") continue;
    let guard = 0;
    while (q.status === "active" && guard++ < 6) {
      const obj = def.objectives[q.step];
      if (!obj) break;
      if (event.type === "defeat" && obj.type === "defeat" && obj.tag === event.tag) {
        const k = objectiveKey(obj);
        if (event.id) {
          const idKey = `${k}:${event.id}`;
          if (!q.counts[idKey]) {
            q.counts[idKey] = 1;
            q.counts[k] = (q.counts[k] ?? 0) + 1;
          }
        } else q.counts[k] = (q.counts[k] ?? 0) + 1;
      } else if (event.type === "interact" && obj.type === "interact" && obj.tag === event.tag) {
        const k = objectiveKey(obj);
        const idKey = `${k}:${event.id}`;
        if (!q.counts[idKey]) {
          q.counts[idKey] = 1;
          q.counts[k] = (q.counts[k] ?? 0) + 1;
        }
      } else if (event.type === "talk" && obj.type === "talk" && obj.npc === event.npc) {
        q.counts[objectiveKey(obj)] = 1;
      } else if (event.type === "puzzle" && obj.type === "puzzle" && obj.id === event.id) {
        q.counts[objectiveKey(obj)] = 1;
      } else if (event.type === "parry" && obj.type === "parry") {
        q.counts.parry = (q.counts.parry ?? 0) + 1;
      } else if (obj.type === "discover") {
        q.counts.discover = discovered.length;
      }
      if (!stepDone(obj, q.counts, inv)) break;
      q.step += 1;
      out.advanced.push(def.id);
      if (q.step >= def.objectives.length) {
        q.status = "done";
        out.completed.push(def.id);
        if (def.next) {
          const n = questById(def.next);
          if (n && startQuest(quests, n.id)) out.started.push(n.id);
        }
      }
    }
  }
  return out;
}

export function markReach(
  quests: Record<string, QuestProgress>,
  x: number,
  y: number,
  z: number,
  inv: Record<string, number>,
  discovered: string[],
): QuestAdvance {
  const out: QuestAdvance = { completed: [], started: [], advanced: [] };
  for (const def of QUESTS) {
    const q = quests[def.id];
    if (!q || q.status !== "active") continue;
    const obj = def.objectives[q.step];
    if (!obj || obj.type !== "reach") continue;
    if (Math.hypot(x - obj.x, z - obj.z) > obj.r) continue;
    if (obj.minY != null && y < obj.minY) continue;
    q.counts[objectiveKey(obj)] = 1;
    q.step += 1;
    out.advanced.push(def.id);
    if (q.step >= def.objectives.length) {
      q.status = "done";
      out.completed.push(def.id);
      if (def.next && startQuest(quests, def.next)) out.started.push(def.next);
    }
  }
  if (out.advanced.length) {
    const more = applyEvent(quests, { type: "inv" }, inv, discovered);
    out.completed.push(...more.completed);
    out.started.push(...more.started);
    out.advanced.push(...more.advanced);
  }
  return out;
}

export function syncHave(
  quests: Record<string, QuestProgress>,
  inv: Record<string, number>,
): QuestAdvance {
  return applyEvent(quests, { type: "inv" }, inv, []);
}

export function fixQuestBy(defId: string): QuestDef | undefined {
  return QUESTS.find((d) => d.id === defId);
}

export function strikeDamage(opts: {
  kind: "light" | "heavy" | "sand" | "bolt" | "wind" | "bomb";
  combo: number;
  weaponPower: number;
  skill: number;
  edge: number;
  buff: boolean;
}): number {
  const base = { light: 14, heavy: 28, sand: 22, bolt: 18, wind: 16, bomb: 26 }[opts.kind];
  const comboMul = opts.kind === "light" ? 1 + Math.min(2, opts.combo) * 0.18 : 1;
  const buff = opts.buff ? 1.15 : 1;
  return Math.max(1, Math.round(base * opts.weaponPower * comboMul * (1 + opts.skill * 0.12) * (1 + opts.edge * 0.08) * buff));
}

export function xpToNext(level: number): number {
  return 36 + level * 28;
}

export function armorMitigation(armor: number): number {
  return armor / (armor + 40);
}

export function canPay(motes: number, price: number): boolean {
  return motes >= price && price >= 0;
}

export function recipeReady(inv: Record<string, number>, inputs: Record<string, number>): boolean {
  return Object.entries(inputs).every(([id, n]) => (inv[id] ?? 0) >= n);
}

export function weaponPower(id: string): number {
  const it = itemDef(id);
  return it.kind === "weapon" ? it.power : 1;
}

export function inArc(px: number, pz: number, yaw: number, ex: number, ez: number, range: number, arc: number): boolean {
  const dx = ex - px;
  const dz = ez - pz;
  const dist = Math.hypot(dx, dz);
  if (dist > range || dist < 0.001) return false;
  const ang = Math.atan2(-dx, -dz);
  const diff = Math.atan2(Math.sin(ang - yaw), Math.cos(ang - yaw));
  return Math.abs(diff) < arc;
}

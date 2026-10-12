import { hash2, hypot2 } from "./math";
import type { Gate, RaceKind, Surface } from "./types";

export type Pt = { x: number; y: number; z: number };

export type Road = {
  id: string;
  pts: Pt[];
  width: number;
  surface: "asphalt" | "sand";
  barrier: boolean;
  closed: boolean;
};

export type Seg = {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  width: number;
  surface: "asphalt" | "sand";
  barrier: boolean;
};

export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: "tower" | "stone" | "industrial" | "neon";
  base: number;
};

export type Prop = {
  kind: "palm" | "lamp" | "dune" | "rock" | "sign" | "pillar" | "barrier" | "tunnel";
  x: number;
  y: number;
  z: number;
  rot: number;
  s: number;
  text?: string;
};

export type RaceDef = {
  id: string;
  nameAr: string;
  nameEn: string;
  kind: RaceKind;
  laps: number;
  wrap: boolean;
  reward: number;
  par: number;
  skill: number;
  rivals: number;
  duration: number;
  higherBetter: boolean;
  gates: Gate[];
  path: Pt[];
  blurbAr: string;
  blurbEn: string;
  zone?: { x: number; z: number; r: number };
};

export type District = {
  id: string;
  nameAr: string;
  nameEn: string;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
};

const CELL = 90;

export const FREE_SPAWN = { x: 0, z: 118, yaw: 0 };
export const GARAGE_SPOT = { x: 28, z: 122, yaw: Math.PI * 0.5 };

export const DISTRICTS: District[] = [
  { id: "downtown", nameAr: "وسط المدينة", nameEn: "Downtown", x: 0, z: 0, w: 380, d: 380, color: "#9aa3ad" },
  { id: "coast", nameAr: "الحي الساحلي", nameEn: "Coast", x: -300, z: 80, w: 280, d: 320, color: "#2ec4b6" },
  { id: "desert", nameAr: "الطريق الصحراوي", nameEn: "Desert highway", x: 40, z: 360, w: 980, d: 180, color: "#c4a574" },
  { id: "industrial", nameAr: "المنطقة الصناعية", nameEn: "Industrial", x: 360, z: 250, w: 320, d: 280, color: "#8d9390" },
  { id: "mountain", nameAr: "المنعطفات الجبلية", nameEn: "Mountain pass", x: 10, z: -360, w: 280, d: 340, color: "#6e6258" },
  { id: "neon", nameAr: "المدينة الليلية", nameEn: "Neon quarter", x: 360, z: -80, w: 340, d: 220, color: "#2ec4b6" },
];

function pt(x: number, z: number, y = 0): Pt {
  return { x, y, z };
}

function straight(id: string, x1: number, z1: number, x2: number, z2: number, width: number, y1 = 0, y2 = 0, barrier = false, surface: "asphalt" | "sand" = "asphalt"): Road {
  return { id, pts: [pt(x1, z1, y1), pt(x2, z2, y2)], width, surface, barrier, closed: false };
}

const ROADS: Road[] = [
  straight("z0", -180, 0, 180, 0, 16),
  straight("z-70", -180, -70, 500, -70, 16),
  straight("z70", -180, 70, 180, 70, 14),
  straight("z140", -180, 140, 500, 140, 14),
  straight("z-140", -180, -140, 480, -140, 14),
  straight("z220", 180, 220, 500, 220, 14),
  straight("x0", 0, -180, 0, 320, 16),
  straight("x140", 140, -180, 140, 180, 14),
  straight("x-140", -140, -180, -140, 180, 14),
  straight("x70", 70, -180, 70, 180, 12),
  straight("x-70", -70, -180, -70, 180, 12),
  straight("n260", 260, -170, 260, 30, 14),
  straight("n420", 420, -170, 420, 30, 14),
  straight("i300", 300, 140, 300, 420, 14),
  straight("i420", 420, 140, 420, 420, 14),
  straight("hwy", -500, 300, 540, 300, 20),
  {
    id: "coast",
    width: 12,
    surface: "asphalt",
    barrier: false,
    closed: false,
    pts: [pt(-180, 0), pt(-250, -16), pt(-310, 8), pt(-345, 70), pt(-330, 140), pt(-270, 200), pt(-190, 220), pt(-150, 170)],
  },
  {
    id: "bridge",
    width: 11,
    surface: "asphalt",
    barrier: true,
    closed: false,
    pts: [pt(-330, 70, 0), pt(-390, 48, 6), pt(-460, 48, 8.5), pt(-470, 110, 8), pt(-400, 155, 4), pt(-330, 150, 0)],
  },
  {
    id: "mountain",
    width: 11,
    surface: "asphalt",
    barrier: true,
    closed: false,
    pts: [pt(0, -180, 0), pt(-48, -240, 4), pt(42, -300, 8), pt(-36, -360, 12), pt(24, -430, 16), pt(-18, -500, 18)],
  },
];

function oval(cx: number, cz: number, rx: number, rz: number, n: number, width: number): Road {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(pt(cx + Math.cos(a) * rx, cz + Math.sin(a) * rz));
  }
  return { id: "oval", pts, width, surface: "asphalt", barrier: true, closed: true };
}

ROADS.push(oval(400, 400, 52, 36, 20, 12));
ROADS.push(straight("oval-spur", 400, 300, 400, 364, 12));

function segsOf(road: Road): Seg[] {
  const out: Seg[] = [];
  const pts = road.closed ? [...road.pts, road.pts[0]!] : road.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    out.push({
      ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z,
      width: road.width, surface: road.surface, barrier: road.barrier,
    });
  }
  return out;
}

export const SEGMENTS: Seg[] = ROADS.flatMap(segsOf);

const segCells = new Map<string, number[]>();
function keyOf(x: number, z: number) {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
}
function touchCells(ax: number, az: number, bx: number, bz: number, fn: (k: string) => void) {
  const steps = Math.max(1, Math.ceil(hypot2(bx - ax, bz - az) / (CELL * 0.5)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fn(keyOf(ax + (bx - ax) * t, az + (bz - az) * t));
  }
}
SEGMENTS.forEach((s, i) => {
  touchCells(s.ax, s.az, s.bx, s.bz, (k) => {
    const arr = segCells.get(k);
    if (arr) arr.push(i);
    else segCells.set(k, [i]);
  });
});

function nearbySegs(x: number, z: number): Seg[] {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const seen = new Set<number>();
  const out: Seg[] = [];
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const arr = segCells.get(`${cx + ix},${cz + iz}`);
      if (!arr) continue;
      for (const i of arr) {
        if (seen.has(i)) continue;
        seen.add(i);
        out.push(SEGMENTS[i]!);
      }
    }
  }
  return out;
}

export function projectSeg(x: number, z: number, s: Seg) {
  const abx = s.bx - s.ax;
  const abz = s.bz - s.az;
  const len2 = abx * abx + abz * abz || 1;
  let t = ((x - s.ax) * abx + (z - s.az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = s.ax + abx * t;
  const cz = s.az + abz * t;
  const cy = s.ay + (s.by - s.ay) * t;
  return { d: hypot2(x - cx, z - cz), t, cx, cz, cy };
}

export type Ground = { y: number; surface: Surface; onRoad: boolean };

export function inWater(x: number, z: number) {
  return x < -358 && z > -80 && z < 230;
}

export function districtSurface(x: number, z: number): Surface {
  if (z > 250) return "sand";
  if (z < -190) return "dirt";
  if (x > 210 && z > 130 && z < 430) return "concrete";
  return "concrete";
}

let rainFlag = false;
export function setRain(v: boolean) {
  rainFlag = v;
}

export function sampleGround(x: number, z: number): Ground {
  let best = 1e9;
  let y = 0;
  let onRoad = false;
  let roadSurf: "asphalt" | "sand" = "asphalt";
  for (const s of nearbySegs(x, z)) {
    const hit = projectSeg(x, z, s);
    if (hit.d < best) best = hit.d;
    if (hit.d < s.width * 0.5 + 1.2) {
      onRoad = true;
      y = hit.cy;
      roadSurf = s.surface;
    }
  }
  if (onRoad) {
    const surface: Surface = rainFlag && roadSurf === "asphalt" ? "wet" : roadSurf;
    return { y, surface, onRoad: true };
  }
  if (inWater(x, z)) return { y: -0.35, surface: "water", onRoad: false };
  return { y: 0, surface: districtSurface(x, z), onRoad: false };
}

function nearRoad(x: number, z: number, pad: number) {
  let best = 1e9;
  for (const s of nearbySegs(x, z)) {
    const d = projectSeg(x, z, s).d;
    if (d < best) best = d;
    if (d < s.width * 0.5 + pad) return true;
  }
  return best < pad;
}

function keepout(x: number, z: number) {
  return x > 10 && x < 48 && z > 96 && z < 148;
}

function pushBuildings() {
  const list: Building[] = [];
  const add = (x: number, z: number, w: number, d: number, h: number, style: Building["style"]) => {
    if (nearRoad(x, z, 11) || keepout(x, z)) return;
    if (inWater(x, z)) return;
    list.push({ x, z, w, d, h, style, base: 0 });
  };
  for (let x = -160; x <= 160; x += 34) {
    for (let z = -160; z <= 160; z += 34) {
      const hsh = hash2(x, z);
      const core = hypot2(x, z) < 90;
      const h = (core ? 34 : 12) + (hsh % 28) + (core ? (hsh % 40) : 0);
      const style = core || hsh % 5 > 2 ? "tower" : "stone";
      const w = style === "stone" ? 16 + (hsh % 6) : 12 + (hsh % 8);
      add(x, z, w, w * (0.7 + (hsh % 5) * 0.06), h, style);
    }
  }
  for (let x = 230; x <= 480; x += 32) {
    for (let z = -155; z <= 20; z += 32) {
      const hsh = hash2(x + 3, z);
      const h = 16 + (hsh % 36);
      add(x, z, 14 + (hsh % 8), 12 + (hsh % 7), h, "neon");
    }
  }
  for (let x = 230; x <= 490; x += 42) {
    for (let z = 165; z <= 400; z += 42) {
      const hsh = hash2(x, z + 9);
      add(x, z, 22 + (hsh % 10), 16 + (hsh % 8), 8 + (hsh % 10), "industrial");
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = -230 - (i % 5) * 8;
    const z = -20 + i * 16;
    add(x, z, 14, 12, 8 + (i % 4) * 2, "stone");
  }
  for (let i = 0; i < 10; i++) {
    const x = -420 + (i * 97) % 700;
    const z = 350 + ((i * 53) % 90);
    if (Math.abs(z - 300) < 24) continue;
    add(x, z, 10, 8, 5 + (i % 3), "stone");
  }
  return list;
}

export const BUILDINGS: Building[] = pushBuildings();

const bCells = new Map<string, number[]>();
BUILDINGS.forEach((b, i) => {
  const k = keyOf(b.x, b.z);
  const arr = bCells.get(k);
  if (arr) arr.push(i);
  else bCells.set(k, [i]);
});

export type CircleObs = { x: number; z: number; r: number };
export const CIRCLES: CircleObs[] = [];

function pushProps() {
  const props: Prop[] = [];
  const lampEvery = (road: Road, step: number) => {
    const pts = road.closed ? [...road.pts, road.pts[0]!] : road.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const rx = -dz / len;
      const rz = dx / len;
      const yaw = Math.atan2(dx, dz);
      const n = Math.floor(len / step);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const side = k % 2 === 0 ? 1 : -1;
        const x = a.x + dx * t + rx * side * (road.width * 0.5 + 1.6);
        const z = a.z + dz * t + rz * side * (road.width * 0.5 + 1.6);
        const y = a.y + (b.y - a.y) * t;
        props.push({ kind: "lamp", x, y, z, rot: yaw, s: 1 });
        if (road.barrier && k % 2 === 0) {
          props.push({
            kind: "barrier",
            x: a.x + dx * t + rx * (road.width * 0.5 + 0.4),
            y,
            z: a.z + dz * t + rz * (road.width * 0.5 + 0.4),
            rot: yaw,
            s: 1,
          });
        }
        if (road.barrier && y > 1 && k % 2 === 1) {
          props.push({ kind: "pillar", x: a.x + dx * t + rx * road.width * 0.42, y: 0, z: a.z + dz * t + rz * road.width * 0.42, rot: 0, s: y });
          props.push({ kind: "pillar", x: a.x + dx * t - rx * road.width * 0.42, y: 0, z: a.z + dz * t - rz * road.width * 0.42, rot: 0, s: y });
        }
      }
    }
  };
  for (const road of ROADS) {
    if (road.id === "oval") continue;
    lampEvery(road, road.barrier ? 16 : 28);
  }
  const coast = ROADS.find((r) => r.id === "coast")!;
  for (let i = 0; i < coast.pts.length - 1; i++) {
    const a = coast.pts[i]!;
    const b = coast.pts[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const rx = -dz / len;
    const rz = dx / len;
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      props.push({
        kind: "palm",
        x: a.x + dx * t + rx * -10,
        y: 0,
        z: a.z + dz * t + rz * -10,
        rot: k,
        s: 0.85 + (k % 3) * 0.15,
      });
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = -180 + ((i * 83) % 620);
    const z = 340 + ((i * 37) % 110);
    if (nearRoad(x, z, 16)) continue;
    const r = 7 + (i % 5) * 2;
    CIRCLES.push({ x, z, r: r * 0.55 });
    props.push({ kind: "dune", x, y: 0, z, rot: i, s: r });
  }
  const mountain = ROADS.find((r) => r.id === "mountain")!;
  for (let i = 0; i < mountain.pts.length; i++) {
    const p = mountain.pts[i]!;
    props.push({ kind: "rock", x: p.x + 18, y: 0, z: p.z + 6, rot: i, s: 6 + (i % 3) });
    props.push({ kind: "rock", x: p.x - 16, y: 0, z: p.z - 8, rot: i + 1, s: 5 + (i % 4) });
    if (!nearRoad(p.x + 18, p.z + 6, 2)) CIRCLES.push({ x: p.x + 18, z: p.z + 6, r: 4 });
  }
  const signs: { x: number; z: number; rot: number; text: string }[] = [
    { x: 40, z: -40, rot: 0.4, text: "أفق" },
    { x: 300, z: -90, rot: 1.2, text: "نيون" },
    { x: -260, z: 40, rot: -0.6, text: "الساحل" },
    { x: 80, z: 280, rot: 0.2, text: "رمل" },
    { x: 330, z: 180, rot: 1.5, text: "الورش" },
    { x: 20, z: -220, rot: 0, text: "الجبل" },
    { x: 26, z: 108, rot: Math.PI, text: "كراج الأفق" },
  ];
  for (const s of signs) props.push({ kind: "sign", x: s.x, y: 0, z: s.z, rot: s.rot, s: 1, text: s.text });
  for (let x = 190; x <= 250; x += 15) {
    props.push({ kind: "tunnel", x, y: 0, z: 140, rot: Math.PI / 2, s: 1 });
  }
  return props;
}

export const PROPS: Prop[] = pushProps();

export const SIGNALS = [
  { x: 0, z: 0, phase: 0 },
  { x: 140, z: 0, phase: 2.2 },
  { x: -140, z: 140, phase: 4.1 },
  { x: 0, z: -140, phase: 6 },
  { x: 260, z: -70, phase: 1.3 },
];

export function signalRed(x: number, z: number, time: number) {
  let best = 1e9;
  let red = false;
  for (const s of SIGNALS) {
    const d = hypot2(x - s.x, z - s.z);
    if (d < best) {
      best = d;
      red = Math.floor(time * 0.35 + s.phase) % 8 < 3;
    }
  }
  return best < 16 && red;
}

function yawToward(ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  return Math.atan2(-dx / len, -dz / len);
}

function gatesFrom(pts: Pt[], half: number, closed: boolean): Gate[] {
  const list = closed ? pts : pts;
  const n = list.length;
  const count = closed ? n : n;
  const gates: Gate[] = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = list[i]!;
    const b = list[(i + 1) % n]!;
    gates.push({ x: a.x, z: a.z, yaw: yawToward(a.x, a.z, b.x, b.z), halfWidth: half });
  }
  if (!closed) {
    const a = list[n - 2]!;
    const b = list[n - 1]!;
    gates.push({ x: b.x, z: b.z, yaw: yawToward(a.x, a.z, b.x, b.z), halfWidth: half });
  }
  return gates;
}

function densify(pts: Pt[], step: number, closed: boolean): Pt[] {
  const src = closed ? [...pts, pts[0]!] : pts;
  const out: Pt[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i]!;
    const b = src[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }
  if (!closed) out.push(src[src.length - 1]!);
  return out;
}

const downtownLoop: Pt[] = [
  pt(0, 140), pt(-140, 140), pt(-140, 0), pt(-140, -140),
  pt(0, -140), pt(140, -140), pt(140, 0), pt(140, 140),
];

const coastLoop: Pt[] = [
  pt(-180, 0), pt(-250, -16), pt(-330, 70), pt(-460, 48, 8.5),
  pt(-470, 110, 8), pt(-330, 150), pt(-190, 220), pt(-140, 140), pt(-140, 0),
];

const desertLine: Pt[] = [pt(-440, 300), pt(-250, 300), pt(-60, 300), pt(140, 300), pt(320, 300), pt(480, 300)];

const mountainLine: Pt[] = ROADS.find((r) => r.id === "mountain")!.pts;

const neonLoop: Pt[] = [pt(260, -70), pt(420, -70), pt(420, -140), pt(260, -140)];

const ovalPts = ROADS.find((r) => r.id === "oval")!.pts;

export const RACES: RaceDef[] = [
  {
    id: "downtown-gp",
    nameAr: "حلقة الأفق",
    nameEn: "Afaq Loop",
    kind: "street",
    laps: 2,
    wrap: true,
    reward: 2600,
    par: 98,
    skill: 0.7,
    rivals: 3,
    duration: 0,
    higherBetter: false,
    gates: gatesFrom(downtownLoop, 18, true),
    path: densify(downtownLoop, 12, true),
    blurbAr: "لفتان في وسط المدينة ضد ثلاثة منافسين.",
    blurbEn: "Two downtown laps against three rivals.",
  },
  {
    id: "coast-time",
    nameAr: "زمن الساحل",
    nameEn: "Coast Time",
    kind: "time",
    laps: 1,
    wrap: true,
    reward: 2200,
    par: 78,
    skill: 0.62,
    rivals: 0,
    duration: 0,
    higherBetter: false,
    gates: gatesFrom(coastLoop, 16, true),
    path: densify(coastLoop, 12, true),
    blurbAr: "لفة واحدة على الكورنيش والجسر البحري.",
    blurbEn: "One lap along the corniche and sea bridge.",
  },
  {
    id: "desert-sprint",
    nameAr: "انطلاقة الرمل",
    nameEn: "Sand Sprint",
    kind: "highway",
    laps: 1,
    wrap: false,
    reward: 3200,
    par: 28,
    skill: 0.74,
    rivals: 2,
    duration: 0,
    higherBetter: false,
    gates: gatesFrom(desertLine, 16, false),
    path: densify(desertLine, 14, false),
    blurbAr: "سباق نقطة لنقطة على الطريق الصحراوي.",
    blurbEn: "Point-to-point down the desert highway.",
  },
  {
    id: "drift-yard",
    nameAr: "حلبة الورش",
    nameEn: "Yard Drift",
    kind: "drift",
    laps: 1,
    wrap: true,
    reward: 2400,
    par: 4000,
    skill: 0.5,
    rivals: 0,
    duration: 50,
    higherBetter: true,
    gates: gatesFrom(ovalPts, 14, true),
    path: densify(ovalPts, 8, true),
    blurbAr: "اجمع نقاط الانزلاق خلال ٥٠ ثانية داخل الحلبة.",
    blurbEn: "Bank drift points for 50 seconds inside the oval.",
    zone: { x: 400, z: 400, r: 78 },
  },
  {
    id: "mountain-pass",
    nameAr: "ممر الجبل",
    nameEn: "Mountain Pass",
    kind: "time",
    laps: 1,
    wrap: false,
    reward: 3600,
    par: 52,
    skill: 0.66,
    rivals: 1,
    duration: 0,
    higherBetter: false,
    gates: gatesFrom(mountainLine, 12, false),
    path: densify(mountainLine, 10, false),
    blurbAr: "صعود المنعطفات حتى القمة. لا تخرج عن الحواجز.",
    blurbEn: "Climb the switchbacks. Stay inside the rails.",
  },
  {
    id: "neon-night",
    nameAr: "ليل النيون",
    nameEn: "Neon Night",
    kind: "street",
    laps: 2,
    wrap: true,
    reward: 4400,
    par: 70,
    skill: 0.8,
    rivals: 3,
    duration: 0,
    higherBetter: false,
    gates: gatesFrom(neonLoop, 16, true),
    path: densify(neonLoop, 12, true),
    blurbAr: "لفتان في الحي المضاء. المنافسون أسرع.",
    blurbEn: "Two laps in the lit quarter. Rivals are quicker.",
  },
  {
    id: "police-heat",
    nameAr: "مطاردة الأفق",
    nameEn: "Horizon Heat",
    kind: "police",
    laps: 1,
    wrap: false,
    reward: 4000,
    par: 0,
    skill: 0.78,
    rivals: 2,
    duration: 90,
    higherBetter: false,
    gates: [],
    path: densify(downtownLoop, 12, true),
    blurbAr: "أفلت من الدورية. ابتعد ثماني ثوانٍ أو يُحتسب الإمساك.",
    blurbEn: "Lose the patrol. Stay clear for eight seconds.",
  },
];

export const CHAMPIONSHIP = ["downtown-gp", "neon-night", "desert-sprint", "mountain-pass"];

export function getRace(id: string) {
  return RACES.find((r) => r.id === id) ?? RACES[0]!;
}

export function raceSpawn(race: RaceDef, index: number, count: number) {
  if (race.kind === "police") {
    const base = FREE_SPAWN;
    return { x: base.x + index * 3.2, z: base.z + 8 + index * 4, yaw: base.yaw };
  }
  if (race.kind === "drift") {
    return { x: 400 + index * 3, z: 400 - 36, yaw: 0 };
  }
  const g = race.gates[0];
  if (!g) return { ...FREE_SPAWN };
  const fx = -Math.sin(g.yaw);
  const fz = -Math.cos(g.yaw);
  const rx = Math.cos(g.yaw);
  const rz = -Math.sin(g.yaw);
  const lat = (index - (count - 1) / 2) * 2.6;
  return {
    x: g.x - fx * 8 + rx * lat,
    z: g.z - fz * 8 + rz * lat,
    yaw: g.yaw,
  };
}

export type HitBody = { x: number; z: number; vx: number; vz: number };

export function collideWorld(body: HitBody): number {
  let impact = 0;
  const r = 1.55;
  const cx = Math.floor(body.x / CELL);
  const cz = Math.floor(body.z / CELL);
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const arr = bCells.get(`${cx + ix},${cz + iz}`);
      if (!arr) continue;
      for (const i of arr) {
        const b = BUILDINGS[i]!;
        const minX = b.x - b.w / 2 - r;
        const maxX = b.x + b.w / 2 + r;
        const minZ = b.z - b.d / 2 - r;
        const maxZ = b.z + b.d / 2 + r;
        if (body.x < minX || body.x > maxX || body.z < minZ || body.z > maxZ) continue;
        const penL = body.x - minX;
        const penR = maxX - body.x;
        const penN = body.z - minZ;
        const penS = maxZ - body.z;
        const m = Math.min(penL, penR, penN, penS);
        if (m === penL) {
          body.x = minX;
          if (body.vx > 0) body.vx = 0;
        } else if (m === penR) {
          body.x = maxX;
          if (body.vx < 0) body.vx = 0;
        } else if (m === penN) {
          body.z = minZ;
          if (body.vz > 0) body.vz = 0;
        } else {
          body.z = maxZ;
          if (body.vz < 0) body.vz = 0;
        }
        impact = Math.max(impact, 6);
      }
    }
  }
  for (const c of CIRCLES) {
    const dx = body.x - c.x;
    const dz = body.z - c.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const min = c.r + 1.3;
    if (d < min) {
      const nx = dx / d;
      const nz = dz / d;
      body.x = c.x + nx * min;
      body.z = c.z + nz * min;
      const vn = body.vx * nx + body.vz * nz;
      if (vn < 0) {
        body.vx -= vn * nx;
        body.vz -= vn * nz;
      }
      impact = Math.max(impact, 4);
    }
  }
  const g = sampleGround(body.x, body.z);
  if (!g.onRoad && inWater(body.x, body.z)) {
    body.x = -352;
    body.vx *= 0.4;
    body.vz *= 0.4;
    impact = Math.max(impact, 5);
  }
  for (const s of nearbySegs(body.x, body.z)) {
    if (!s.barrier) continue;
    const hit = projectSeg(body.x, body.z, s);
    if (hit.t <= 0.02 || hit.t >= 0.98) continue;
    const half = s.width / 2;
    if (hit.d > half - 0.15 && hit.d < half + 2.2) {
      const nx = (body.x - hit.cx) / (hit.d || 1);
      const nz = (body.z - hit.cz) / (hit.d || 1);
      const keep = half - 0.7;
      body.x = hit.cx + nx * keep;
      body.z = hit.cz + nz * keep;
      const vn = body.vx * nx + body.vz * nz;
      if (vn > 0) {
        body.vx -= vn * nx;
        body.vz -= vn * nz;
      }
      impact = Math.max(impact, 3);
    }
  }
  if (body.x < -530) {
    body.x = -530;
    body.vx = Math.max(0, body.vx);
  }
  if (body.x > 560) {
    body.x = 560;
    body.vx = Math.min(0, body.vx);
  }
  if (body.z < -540) {
    body.z = -540;
    body.vz = Math.max(0, body.vz);
  }
  if (body.z > 490) {
    body.z = 490;
    body.vz = Math.min(0, body.vz);
  }
  return impact;
}

export function crossedGate(x0: number, z0: number, x1: number, z1: number, gate: Gate) {
  const fx = -Math.sin(gate.yaw);
  const fz = -Math.cos(gate.yaw);
  const side0 = (x0 - gate.x) * fx + (z0 - gate.z) * fz;
  const side1 = (x1 - gate.x) * fx + (z1 - gate.z) * fz;
  if (!(side0 < 0 && side1 >= 0)) return false;
  const t = side0 / (side0 - side1 || 1);
  const px = x0 + (x1 - x0) * t;
  const pz = z0 + (z1 - z0) * t;
  const rx = Math.cos(gate.yaw);
  const rz = -Math.sin(gate.yaw);
  const lat = Math.abs((px - gate.x) * rx + (pz - gate.z) * rz);
  return lat <= gate.halfWidth;
}

export function angleTo(yaw: number, x: number, z: number, tx: number, tz: number) {
  const dx = tx - x;
  const dz = tz - z;
  const dist = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const lng = (dx / dist) * fx + (dz / dist) * fz;
  const lat = (dx / dist) * rx + (dz / dist) * rz;
  return { dist, ang: Math.atan2(lat, lng) };
}

export const TRAFFIC_PATHS: Pt[][] = [
  densify(downtownLoop, 16, true),
  densify([pt(-420, 300), pt(460, 300)], 20, false),
  densify(neonLoop, 16, true),
  densify(coastLoop, 18, true),
];

export function trafficPaths() {
  return TRAFFIC_PATHS;
}

export { ROADS };

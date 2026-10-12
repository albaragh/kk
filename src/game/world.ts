import { clamp, fbm, noise2, smoothstep, distPointSeg } from "./math.ts";
import type { Block, MatId, PropInst } from "./types";

export type KingdomId = "sand" | "life" | "frost" | "ash" | "lost" | "twilight";

export const KINGDOMS: {
  id: KingdomId;
  ar: string;
  en: string;
  x: number;
  z: number;
  r: number;
  color: string;
}[] = [
  { id: "sand", ar: "مدينة الرمال", en: "City of Sands", x: 0, z: 0, r: 100, color: "#e0b15a" },
  { id: "life", ar: "وادي الحياة", en: "Valley of Life", x: 0, z: 230, r: 88, color: "#3e9a62" },
  { id: "frost", ar: "جبال الصقيع", en: "Frost Peaks", x: 250, z: 24, r: 92, color: "#b9d4e8" },
  { id: "ash", ar: "أرض الرماد", en: "Ashlands", x: 16, z: -240, r: 92, color: "#c4492c" },
  { id: "lost", ar: "المدينة المفقودة", en: "The Lost City", x: -250, z: 8, r: 82, color: "#6ec8c2" },
  { id: "twilight", ar: "مملكة الشفق", en: "Kingdom of Twilight", x: 230, z: 230, r: 78, color: "#b98cff" },
];

type Road = { pts: [number, number][]; hs: number[]; width: number };

const ROAD_SRC: [number, number][][] = [
  [
    [0, 42],
    [0, 120],
    [0, 190],
  ],
  [
    [42, 8],
    [120, 14],
    [190, 20],
  ],
  [
    [0, -48],
    [8, -140],
    [16, -185],
  ],
  [
    [-42, 2],
    [-130, 4],
    [-185, 6],
  ],
  [
    [48, 220],
    [130, 226],
    [175, 214],
  ],
  [
    [248, 90],
    [246, 150],
    [220, 185],
  ],
];

function biomeRaw(x: number, z: number): number {
  const sandDune =
    1.4 +
    Math.sin(x * 0.045) * Math.cos(z * 0.038) * 2.4 +
    fbm(x * 0.02, z * 0.02) * 6.5;
  const life =
    0.7 + fbm(x * 0.035 + 4, z * 0.035) * 2.8 + Math.sin(x * 0.08) * 0.4;
  const frostN = fbm(x * 0.018 + 9, z * 0.018);
  const frost = 10 + Math.pow(frostN, 1.35) * 26 + noise2(x * 0.08, z * 0.08) * 2.2;
  const ashCone =
    5 +
    Math.max(0, 8 - Math.hypot(x - 30, z + 260) * 0.35) +
    Math.max(0, 6 - Math.hypot(x + 10, z + 220) * 0.4) +
    fbm(x * 0.03 + 2, z * 0.03) * 2;
  const lost = -2.4 + fbm(x * 0.05, z * 0.05) * 0.45;
  const twilight = 7 + fbm(x * 0.03 + 3, z * 0.03) * 3.5;

  const weights = KINGDOMS.map((k) => {
    const d = Math.hypot(x - k.x, z - k.z);
    return clamp(1 - d / (k.r * 1.15), 0, 1) ** 1.35;
  });
  const heights = [sandDune, life, frost, ashCone, lost, twilight];
  let wSum = 0.18;
  let h = sandDune * 0.18;
  for (let i = 0; i < weights.length; i++) {
    wSum += weights[i];
    h += heights[i] * weights[i];
  }
  return h / wSum;
}

function carve(x: number, z: number, h: number): number {
  const lake = Math.hypot(x, z - 230);
  if (lake < 18) h = Math.min(h, lerpH(0.2, h, smoothstep(10, 18, lake)));
  const oasis = Math.hypot(x + 24, z - 8);
  if (oasis < 8) h = Math.min(h, lerpH(0.25, h, smoothstep(4.5, 8, oasis)));
  const lava = Math.hypot(x - 18, z + 256);
  if (lava < 15) h = Math.min(h, lerpH(3.05, h, smoothstep(8, 15, lava)));
  return h;
}

function lerpH(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const ROADS: Road[] = ROAD_SRC.map((pts) => ({
  pts,
  hs: pts.map(([x, z]) => carve(x, z, biomeRaw(x, z))),
  width: 12,
}));

export function terrainHeight(x: number, z: number): number {
  let h = carve(x, z, biomeRaw(x, z));
  let bestD = 1e9;
  let bestH = h;
  for (const road of ROADS) {
    for (let i = 0; i < road.pts.length - 1; i++) {
      const a = road.pts[i];
      const b = road.pts[i + 1];
      const proj = distPointSeg(x, z, a[0], a[1], b[0], b[1]);
      if (proj.d < bestD) {
        bestD = proj.d;
        bestH = road.hs[i] + (road.hs[i + 1] - road.hs[i]) * proj.t;
      }
    }
  }
  if (bestD < ROADS[0].width) {
    const t = smoothstep(ROADS[0].width, 2.4, bestD);
    h = h * (1 - t) + bestH * t;
  }
  return h;
}

export function kingdomAt(x: number, z: number): KingdomId {
  let best: KingdomId = "sand";
  let bestD = 1e9;
  for (const k of KINGDOMS) {
    const d = Math.hypot(x - k.x, z - k.z);
    if (d < bestD) {
      bestD = d;
      best = k.id;
    }
  }
  return best;
}

export function kingdomInfo(id: KingdomId) {
  return KINGDOMS.find((k) => k.id === id) ?? KINGDOMS[0];
}

export const WATERS = [
  { id: "lake", x: 0, z: 230, r: 15.5, y: 0.72, kind: "water" as const },
  { id: "oasis", x: -24, z: 8, r: 6.4, y: 0.48, kind: "water" as const },
  { id: "lava", x: 18, z: -256, r: 11.5, y: 3.35, kind: "lava" as const },
];

export const SEAL = { x: 186, z: 206, w: 16, d: 3.2 };

function pushBox(
  out: Block[],
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: MatId,
  shape: Block["shape"] = "box",
  rot = 0,
  extra: Partial<Block> = {},
): void {
  out.push({
    x,
    z,
    w,
    h,
    d,
    rot,
    base: terrainHeight(x, z),
    mat,
    shape,
    solid: true,
    ...extra,
  });
}

function buildSand(out: Block[]): void {
  for (let i = -4; i <= 4; i++) {
    if (i !== 0) pushBox(out, i * 8, 24, 7.4, 6.5, 2.1, "sandstone");
    pushBox(out, i * 8, -42, 7.4, 5.8, 2.1, "sandstone");
  }
  for (let i = -3; i <= 2; i++) {
    pushBox(out, -36, i * 8 - 4, 2.1, 5.6, 7.2, "sandstone");
    pushBox(out, 36, i * 8 - 4, 2.1, 5.6, 7.2, "sandstone");
  }
  pushBox(out, 42, 30, 4.2, 16, 4.2, "sandstone", "cyl", 0, { climb: true });
  pushBox(out, 42, 30, 5.4, 1.3, 5.4, "copper", "dome", 0, {
    solid: true,
    base: terrainHeight(42, 30) + 16,
  });
  pushBox(out, -40, 28, 3.4, 12, 3.4, "sandstone", "cyl", 0, { climb: true });
  pushBox(out, 40, -46, 3.2, 11, 3.2, "sandstone", "cyl");
  pushBox(out, -38, -44, 3.2, 10, 3.2, "sandstone", "cyl");

  pushBox(out, 0, -34, 16, 7, 12, "plaster");
  pushBox(out, 0, -34, 9, 5.5, 9, "copper", "dome", 0, {
    base: terrainHeight(0, -34) + 7,
  });
  pushBox(out, -8, -30, 2.2, 9, 2.2, "sandstone", "cyl");
  pushBox(out, 8, -30, 2.2, 9, 2.2, "sandstone", "cyl");

  const stalls: [number, number][] = [
    [-14, -6],
    [-14, -16],
    [-14, -26],
    [14, -6],
    [14, -16],
    [14, -26],
  ];
  for (const [x, z] of stalls) {
    pushBox(out, x, z, 5.5, 2.6, 3.2, "wood");
    pushBox(out, x, z - 1.6, 6.2, 0.25, 3.6, "cloth", "box", 0, {
      base: terrainHeight(x, z) + 2.7,
      solid: false,
    });
  }
  for (let i = -1; i <= 1; i++) {
    pushBox(out, i * 10, 6, 6, 4.2, 5, i === 0 ? "plaster" : "sandstone");
    pushBox(out, i * 10, 6, 3.2, 2.2, 3.2, "copper", "dome", 0, {
      base: terrainHeight(i * 10, 6) + 4.2,
    });
  }
  pushBox(out, 0, -16, 3.2, 1.1, 3.2, "stone", "cyl");
  pushBox(out, -22, 10, 5, 3.5, 5, "plaster");
  pushBox(out, 22, 12, 5, 3.4, 4.5, "sandstone");
  pushBox(out, -24, -18, 4.5, 3.2, 4.5, "plaster");
  pushBox(out, 24, -18, 4.5, 3.6, 4, "sandstone");
}

function buildLife(out: Block[]): void {
  const spots: [number, number][] = [
    [-18, 214],
    [-10, 246],
    [16, 214],
    [22, 248],
    [-28, 236],
    [8, 262],
  ];
  for (const [x, z] of spots) {
    pushBox(out, x, z, 1.1, 6.5, 1.1, "wood", "cyl");
    pushBox(out, x, z, 4.8, 2.4, 4.8, "leaf", "dome", 0, {
      base: terrainHeight(x, z) + 5.2,
      solid: false,
    });
  }
  pushBox(out, -16, 198, 7, 3.2, 5, "wood");
  pushBox(out, -16, 198, 8, 0.3, 6, "leaf", "box", 0, {
    base: terrainHeight(-16, 198) + 3.2,
    solid: false,
  });
  pushBox(out, 14, 200, 4, 2.4, 4, "stone", "cyl");
  pushBox(out, 0, 236, 2.4, 3.5, 2.4, "glow", "cyl", 0, { solid: false });
}

function buildFrost(out: Block[]): void {
  pushBox(out, 214, 18, 3, 8, 8, "ice");
  pushBox(out, 236, 8, 10, 6, 3, "stone");
  pushBox(out, 268, 36, 4, 10, 4, "ice", "cyl");
  pushBox(out, 232, 62, 14, 8, 10, "stone");
  pushBox(out, 232, 62, 8, 4, 8, "ice", "dome", 0, { base: terrainHeight(232, 62) + 8 });
  pushBox(out, 250, 78, 6, 7, 6, "stone", "cyl");
  pushBox(out, 206, 46, 3, 5, 3, "stone", "cyl");
  pushBox(out, 274, 58, 5, 6, 5, "ice");
  pushBox(out, 168, 20, 2.2, 5, 6, "wood");
  pushBox(out, 176, 24, 2.2, 4.5, 5, "wood");
}

function buildAsh(out: Block[]): void {
  pushBox(out, 16, -200, 18, 6, 8, "ash");
  pushBox(out, 16, -200, 4, 9, 4, "metal", "cyl", 0, { base: terrainHeight(16, -200) + 4 });
  pushBox(out, -8, -214, 6, 5, 6, "metal");
  pushBox(out, 36, -188, 5, 4, 7, "ash");
  pushBox(out, 4, -228, 7, 4.5, 5, "metal");
  pushBox(out, 28, -230, 3, 8, 3, "ash", "cyl");
  pushBox(out, 0, -248, 8, 3, 8, "ash", "cyl", 0, { solid: false });
  pushBox(out, -14, -186, 6, 3.4, 4, "ash");
}

function buildLost(out: Block[]): void {
  for (let i = -2; i <= 2; i++) {
    pushBox(out, -250 + i * 12, -12, 3.2, 7, 3.2, "metal", "cyl");
    pushBox(out, -250 + i * 14, 30, 8, 5, 3, "stone");
  }
  pushBox(out, -250, 18, 12, 6, 12, "metal");
  pushBox(out, -250, 18, 6, 3.5, 6, "glow", "dome", 0, {
    base: terrainHeight(-250, 18) + 6,
    solid: false,
  });
  pushBox(out, -220, 4, 5, 4, 5, "metal");
  pushBox(out, -278, 6, 5, 4.5, 5.5, "stone");
  pushBox(out, -236, -8, 2.2, 5, 2.2, "copper", "cyl");
  pushBox(out, -264, 22, 4, 3, 4, "metal", "cyl");
  pushBox(out, -250, 8, 46, 1.2, 46, "stone", "box", 0, {
    base: 11.2,
    solid: true,
  });
}

function buildTwilight(out: Block[]): void {
  const plats: [number, number, number, number][] = [
    [198, 208, 12, 3],
    [214, 224, 14, 7],
    [230, 242, 16, 11],
    [246, 228, 11, 9],
    [220, 252, 9, 13],
  ];
  const tops: { x: number; z: number; top: number }[] = [];
  for (const [x, z, s, lift] of plats) {
    const base = terrainHeight(x, z) + lift;
    out.push({
      x, z, w: s, h: 1.3, d: s * 0.78, rot: 0, base, mat: "moon", shape: "box", solid: true,
    });
    tops.push({ x, z, top: base + 1.3 });
    if (s > 11) {
      out.push({
        x, z: z + 0.4, w: 1.6, h: 3.2, d: 1.6, rot: 0, base: base + 1.3, mat: "glow", shape: "cyl", solid: false,
      });
    }
  }
  const throne = tops[2];
  out.push({
    x: throne.x, z: throne.z, w: 6, h: 4.5, d: 6, rot: 0, base: throne.top, mat: "copper", shape: "dome", solid: false,
  });
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i];
    const b = tops[i + 1];
    const steps = 5;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = a.top + (b.top - a.top) * t - 1.1;
      out.push({
        x, z, w: 3.4, h: 0.7, d: 3.4, rot: 0, base: y, mat: "moon", shape: "box", solid: true,
      });
    }
  }
}

export const BLOCKS: Block[] = [];
buildSand(BLOCKS);
buildLife(BLOCKS);
buildFrost(BLOCKS);
buildAsh(BLOCKS);
buildLost(BLOCKS);
buildTwilight(BLOCKS);

export const GRAPPLES: { x: number; y: number; z: number }[] = [
  { x: 42, y: terrainHeight(42, 30) + 15, z: 30 },
  { x: -40, y: terrainHeight(-40, 28) + 11, z: 28 },
  { x: 0, y: terrainHeight(0, -34) + 12, z: -34 },
  { x: 214, y: 12, z: 228 },
  { x: 230, y: 20, z: 246 },
  { x: 248, y: 24, z: 232 },
  { x: 268, y: terrainHeight(268, 36) + 9, z: 36 },
  { x: -250, y: 8, z: 18 },
];

function blocked(x: number, z: number): boolean {
  for (const b of BLOCKS) {
    if (b.solid === false) continue;
    if (Math.abs(x - b.x) < b.w * 0.5 + 1.2 && Math.abs(z - b.z) < b.d * 0.5 + 1.2) return true;
  }
  return false;
}

export const PROPS: PropInst[] = [];
function scatter(kind: PropInst["kind"], cx: number, cz: number, rad: number, n: number, s0: number, s1: number): void {
  for (let i = 0; i < n; i++) {
    const a = hashAngle(kind, i);
    const d = rad * (0.25 + 0.75 * hashAngle(kind, i + 99));
    const x = cx + Math.cos(a * 6.28) * d;
    const z = cz + Math.sin(a * 4.17 + i) * d;
    if (blocked(x, z)) continue;
    if (Math.hypot(x, z - 38) < 8) continue;
    PROPS.push({
      kind,
      x,
      z,
      y: terrainHeight(x, z),
      s: s0 + hashAngle(kind, i + 3) * (s1 - s0),
      r: hashAngle(kind, i + 7) * 6.28,
    });
  }
}
function hashAngle(kind: string, i: number): number {
  const n = Math.sin(i * 12.9898 + kind.length * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

scatter("palm", 0, 0, 90, 26, 0.8, 1.5);
scatter("rock", 0, 10, 110, 22, 0.5, 1.8);
scatter("pillar", 10, -10, 70, 10, 0.8, 1.3);
scatter("tree", 0, 230, 78, 18, 0.9, 1.6);
scatter("reed", 6, 220, 40, 10, 0.7, 1.2);
scatter("pine", 250, 24, 80, 16, 0.8, 1.5);
scatter("rock", 250, 30, 85, 14, 0.6, 2);
scatter("dead", 16, -240, 80, 12, 0.8, 1.5);
scatter("rock", 20, -230, 70, 10, 0.5, 1.6);
scatter("crystal", -250, 8, 60, 12, 0.5, 1.3);
scatter("pillar", -250, 8, 55, 8, 0.7, 1.2);
scatter("crystal", 230, 230, 50, 8, 0.6, 1.4);
scatter("rock", 40, 60, 40, 6, 0.4, 1.2);

export function insideBlock(x: number, z: number, b: Block, pad: number): boolean {
  let dx = x - b.x;
  let dz = z - b.z;
  if (Math.abs(Math.sin(b.rot)) > 0.7) {
    const t = dx;
    dx = dz;
    dz = t;
  }
  const hw = b.w * 0.5 + pad;
  const hd = b.d * 0.5 + pad;
  if (b.shape === "cyl" || b.shape === "dome" || b.shape === "cone") {
    const r = Math.max(b.w, b.d) * 0.5 + pad;
    return dx * dx + dz * dz <= r * r;
  }
  return Math.abs(dx) < hw && Math.abs(dz) < hd;
}

export function sampleBiomeColor(x: number, z: number, h: number): [number, number, number] {
  const k = kingdomAt(x, z);
  const n = noise2(x * 0.12, z * 0.12);
  const slope = Math.abs(terrainHeight(x + 1.2, z) - h) + Math.abs(terrainHeight(x, z + 1.2) - h);
  const rock = clamp(slope * 0.35, 0, 1);
  const table: Record<KingdomId, [number, number, number]> = {
    sand: [0.78 + n * 0.08, 0.62, 0.36],
    life: [0.32 + n * 0.08, 0.55, 0.3],
    frost: [0.75, 0.8, 0.84 + n * 0.05],
    ash: [0.42 + n * 0.06, 0.24, 0.18],
    lost: [0.32, 0.4, 0.42],
    twilight: [0.42, 0.34, 0.55],
  };
  const c = table[k];
  return [
    c[0] * (1 - rock) + 0.45 * rock,
    c[1] * (1 - rock) + 0.4 * rock,
    c[2] * (1 - rock) + 0.36 * rock,
  ];
}

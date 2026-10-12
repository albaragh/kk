export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** yaw 0 faces world −Z. +yaw turns the nose left on a chase camera. */
export function cameraBasis(camYaw: number): { fx: number; fz: number; rx: number; rz: number } {
  return {
    fx: -Math.sin(camYaw),
    fz: -Math.cos(camYaw),
    rx: Math.cos(camYaw),
    rz: -Math.sin(camYaw),
  };
}

/** moveX +1 is D / screen-right. moveZ +1 is W / forward. */
export function wishDir(camYaw: number, moveX: number, moveZ: number): { x: number; z: number } {
  const b = cameraBasis(camYaw);
  let x = b.rx * moveX + b.fx * moveZ;
  let z = b.rz * moveX + b.fz * moveZ;
  const m = Math.hypot(x, z);
  if (m < 1e-5) return { x: 0, z: 0 };
  return { x: x / m, z: z / m };
}

export function yawFromDir(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

export function hash2(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function noise2(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number): number {
  let n = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    n += a * noise2(x * f, z * f);
    f *= 2.02;
    a *= 0.5;
  }
  return n;
}

export function distPointSeg(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { d: number; t: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz || 1;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / len2, 0, 1);
  const x = ax + abx * t;
  const z = az + abz * t;
  return { d: Math.hypot(px - x, pz - z), t };
}

import { clamp } from "./math";
import type { DriveType, Surface } from "./types";

export type VehicleStats = {
  mass: number;
  power: number;
  top: number;
  brake: number;
  grip: number;
  steer: number;
  drive: DriveType;
  wheelR: number;
  nitroMax: number;
  nitroPower: number;
};

export type VehicleInput = {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  nitro: boolean;
};

export type VehicleState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  vLat: number;
  wheelSpin: number;
  steerVisual: number;
  pitch: number;
  roll: number;
  rpm: number;
  gear: number;
  nitro: number;
  drifting: boolean;
  braking: boolean;
  throttle: number;
  px: number;
  pz: number;
  surface: Surface;
};

const GRIP: Record<Surface, number> = {
  asphalt: 1,
  wet: 0.72,
  sand: 0.5,
  dirt: 0.64,
  concrete: 0.84,
  water: 0.28,
};

const SURF_DRAG: Record<Surface, number> = {
  asphalt: 0,
  wet: 0.15,
  sand: 0.85,
  dirt: 0.4,
  concrete: 0.18,
  water: 2.4,
};

export function createVehicleState(x: number, z: number, yaw: number): VehicleState {
  return {
    x,
    y: 0.4,
    z,
    yaw,
    vx: 0,
    vz: 0,
    speed: 0,
    vLat: 0,
    wheelSpin: 0,
    steerVisual: 0,
    pitch: 0,
    roll: 0,
    rpm: 0.2,
    gear: 1,
    nitro: 0,
    drifting: false,
    braking: false,
    throttle: 0,
    px: x,
    pz: z,
    surface: "asphalt",
  };
}

export function stepVehicle(
  body: VehicleState,
  input: VehicleInput,
  stats: VehicleStats,
  dt: number,
  surface: Surface,
  assist: number,
  groundY: number,
  ride: number,
) {
  body.px = body.x;
  body.pz = body.z;
  body.surface = surface;
  body.throttle = input.throttle;
  body.braking = input.brake > 0.2 && body.speed > 1;

  const fx = -Math.sin(body.yaw);
  const fz = -Math.cos(body.yaw);
  const rx = Math.cos(body.yaw);
  const rz = -Math.sin(body.yaw);

  let vLong = body.vx * fx + body.vz * fz;
  let vLat = body.vx * rx + body.vz * rz;
  const prevLong = vLong;

  body.steerVisual += (input.steer - body.steerVisual) * Math.min(1, dt * 8);

  let driveMul = 1;
  if (stats.drive === "RWD" && input.throttle > 0.5) driveMul = 0.78;
  if (stats.drive === "FWD") driveMul = 1.12;
  if (stats.drive === "AWD") driveMul = 1.16;

  const boosting = input.nitro && body.nitro > 0 && input.throttle > 0.15 && stats.nitroMax > 0;
  if (boosting) body.nitro = Math.max(0, body.nitro - dt);
  const massMul = clamp(1480 / Math.max(800, stats.mass), 0.62, 1.18);
  const power = stats.power * (boosting ? stats.nitroPower : 1) * massMul;
  const drag = (stats.power * (boosting ? stats.nitroPower : 1)) / (stats.top * stats.top);

  if (input.brake > 0.05 && vLong > 0.5) {
    vLong -= input.brake * stats.brake * massMul * dt;
    if (vLong < 0) vLong = 0;
  } else if (input.throttle > 0.05) {
    vLong += input.throttle * power * dt;
  } else if (input.brake > 0.05 && !input.handbrake) {
    vLong -= input.brake * stats.brake * 0.42 * massMul * dt;
  }

  vLong -= vLong * Math.abs(vLong) * drag * dt;
  vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), 2.1 * dt);
  const surfDrag = SURF_DRAG[surface];
  if (surfDrag) vLong -= vLong * surfDrag * dt;

  const reverseCap = 12;
  const top = stats.top * (boosting ? 1.08 : 1);
  vLong = clamp(vLong, -reverseCap, top);

  let gripK = stats.grip * GRIP[surface] * driveMul * (input.handbrake ? 0.32 : 1);
  if (!input.handbrake && assist > 0) gripK *= 1 + assist * 0.45;
  const kill = 1 - Math.exp(-gripK * 7 * dt);
  vLat *= 1 - kill;

  const speedFactor = clamp(Math.abs(vLong) / 9, 0.2, 1);
  const reverse = vLong >= -0.35 ? 1 : -1;
  const steerRate = stats.steer * (stats.drive === "FWD" ? 0.92 : 1);
  body.yaw += body.steerVisual * steerRate * speedFactor * reverse * dt;
  if (input.handbrake && Math.abs(vLong) > 7) {
    body.yaw += body.steerVisual * steerRate * 0.65 * dt;
  }
  if (Math.abs(vLat) > 2) {
    body.yaw += -Math.sign(vLat) * Math.min(Math.abs(vLat), 10) * 0.035 * dt;
  }

  body.vx = fx * vLong + rx * vLat;
  body.vz = fz * vLong + rz * vLat;

  const sub = Math.abs(vLong) > 46 ? 2 : 1;
  const h = dt / sub;
  for (let i = 0; i < sub; i++) {
    body.x += body.vx * h;
    body.z += body.vz * h;
  }

  body.speed = vLong;
  body.vLat = vLat;
  body.wheelSpin += (vLong / Math.max(0.28, stats.wheelR)) * dt;
  body.drifting = Math.abs(vLat) > 3.2 && Math.abs(vLong) > 8;
  if (body.drifting && stats.nitroMax > 0) {
    body.nitro = Math.min(stats.nitroMax, body.nitro + dt * 0.4);
  }

  const longG = (vLong - prevLong) / Math.max(dt, 0.001);
  const pitchT = clamp(-longG * 0.012, -0.07, 0.07);
  const rollT = clamp(vLat * 0.012, -0.09, 0.09);
  body.pitch += (pitchT - body.pitch) * Math.min(1, dt * 6);
  body.roll += (rollT - body.roll) * Math.min(1, dt * 6);

  const bands = [0, 0.16, 0.33, 0.5, 0.66, 0.82, 1];
  const sp = Math.abs(vLong) / Math.max(8, stats.top);
  let gear = 1;
  for (let i = 1; i < bands.length; i++) if (sp + 0.001 >= bands[i - 1]!) gear = i;
  const lo = bands[gear - 1] ?? 0;
  const hi = bands[gear] ?? 1;
  const local = hi > lo ? (sp - lo) / (hi - lo) : 0;
  const rpmT = clamp(0.26 + local * 0.64 + (input.throttle > 0.2 ? 0.05 : 0), 0.16, 1);
  body.rpm += (rpmT - body.rpm) * Math.min(1, dt * 10);
  body.gear = vLong < -1 ? 0 : gear;

  const targetY = groundY + stats.wheelR + ride;
  body.y += (targetY - body.y) * Math.min(1, dt * 10);
}

export function forwardOf(yaw: number) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function rightOf(yaw: number) {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

import { clamp } from "./math";

export function steerFromCodes(codes: Iterable<string>): number {
  let steer = 0;
  for (const code of codes) {
    if (code === "KeyA" || code === "ArrowLeft") steer += 1;
    if (code === "KeyD" || code === "ArrowRight") steer -= 1;
  }
  return clamp(steer, -1, 1);
}

export function throttleFromCodes(codes: Iterable<string>): number {
  for (const code of codes) {
    if (code === "KeyW" || code === "ArrowUp") return 1;
  }
  return 0;
}

export function brakeFromCodes(codes: Iterable<string>): number {
  for (const code of codes) {
    if (code === "KeyS" || code === "ArrowDown") return 1;
  }
  return 0;
}

export function deadzone(v: number, z = 0.12) {
  if (Math.abs(v) < z) return 0;
  return Math.sign(v) * ((Math.abs(v) - z) / (1 - z));
}

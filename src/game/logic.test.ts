import assert from "node:assert/strict";
import test from "node:test";
import { effectiveStats, getCar } from "./cars.ts";
import { steerFromCodes } from "./input.ts";
import { createVehicleState, stepVehicle } from "./physics.ts";
import { defaultUpgrades } from "./cars.ts";
import {
  collideWorld,
  crossedGate,
  FREE_SPAWN,
  raceSpawn,
  RACES,
  sampleGround,
} from "./world.ts";

test("A steers positive yaw and D steers negative", () => {
  assert.equal(steerFromCodes(["KeyA"]), 1);
  assert.equal(steerFromCodes(["KeyD"]), -1);
  assert.equal(steerFromCodes(["ArrowLeft"]), 1);
  assert.equal(steerFromCodes(["ArrowRight"]), -1);
  const body = createVehicleState(0, 0, 0);
  body.speed = 20;
  body.vx = 0;
  body.vz = -20;
  const car = getCar("afaq-sedan");
  const stats = effectiveStats(car, defaultUpgrades());
  stepVehicle(body, { steer: steerFromCodes(["KeyA", "KeyW"]), throttle: 1, brake: 0, handbrake: false, nitro: false }, stats, 0.3, "asphalt", 0, 0, 0);
  assert.ok(body.yaw > 0.05, `A should increase yaw, got ${body.yaw}`);
});

test("throttle builds speed and car stays on the ground", () => {
  const body = createVehicleState(FREE_SPAWN.x, FREE_SPAWN.z, FREE_SPAWN.yaw);
  const stats = effectiveStats(getCar("barq"), defaultUpgrades());
  for (let i = 0; i < 90; i++) {
    const g = sampleGround(body.x, body.z);
    stepVehicle(body, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false }, stats, 1 / 60, g.surface, 0, g.y, 0);
    collideWorld(body);
  }
  assert.ok(body.speed > 8, `expected speed, got ${body.speed}`);
  assert.ok(Number.isFinite(body.y) && body.y > -1 && body.y < 30);
});

test("checkpoint crossing is one-way and ordered", () => {
  const gate = { x: 0, z: 0, yaw: 0, halfWidth: 8 };
  assert.equal(crossedGate(0, 8, 0, -2, gate), true);
  assert.equal(crossedGate(0, -2, 0, 8, gate), false);
  assert.equal(crossedGate(30, 8, 30, -2, gate), false);
});

test("race spawns sit on roads and outside buildings", () => {
  const free = sampleGround(FREE_SPAWN.x, FREE_SPAWN.z);
  assert.equal(free.onRoad, true);
  const hit = { x: FREE_SPAWN.x, z: FREE_SPAWN.z, vx: 0, vz: 0 };
  const before = hit.x;
  collideWorld(hit);
  assert.ok(Math.abs(hit.x - before) < 0.2);
  for (const race of RACES) {
    if (race.kind === "police") continue;
    const spawn = raceSpawn(race, 0, 1 + race.rivals);
    const g = sampleGround(spawn.x, spawn.z);
    assert.equal(g.onRoad, true, `${race.id} spawn off road ${spawn.x},${spawn.z}`);
    assert.ok(Number.isFinite(spawn.yaw));
  }
});

test("engine upgrade increases power", () => {
  const car = getCar("afaq-sedan");
  const base = effectiveStats(car, defaultUpgrades());
  const tuned = effectiveStats(car, { ...defaultUpgrades(), engine: 3, turbo: 2 });
  assert.ok(tuned.power > base.power);
  assert.ok(tuned.top > base.top);
  assert.ok(tuned.nitroMax > 0);
});

test("a street race leaves the grid after the countdown and can finish", async () => {
  const mem = new Map<string, string>();
  Object.assign(globalThis, {
    document: { documentElement: { lang: "ar", dir: "rtl" } },
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, String(v)),
      removeItem: (k: string) => mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    },
  });
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: false }),
    localStorage: (globalThis as { localStorage?: unknown }).localStorage,
  };
  const { useGame } = await import("./store.ts");
  const { advance, sim } = await import("./sim.ts");
  const { angNorm } = await import("./math.ts");
  useGame.getState().hydrate();
  useGame.getState().startRace("downtown-gp");
  const p = sim.bodies.player!;
  const x0 = p.x;
  const z0 = p.z;
  let finished = false;
  for (let i = 0; i < 60 * 150; i++) {
    const race = sim.race;
    if (!race) break;
    if (race.phase === "live" && !p.finished && race.def.gates.length) {
      const gate = race.def.gates[Math.min(p.cp, race.def.gates.length - 1)]!;
      const desired = Math.atan2(-(gate.x - p.x), -(gate.z - p.z));
      sim.qaSteer = Math.max(-1, Math.min(1, angNorm(desired - p.yaw) * 2.4));
      sim.qaKeys = new Set(["KeyW"]);
    } else if (race.phase === "countdown") {
      sim.qaKeys = new Set(["KeyW"]);
    }
    advance(1 / 60);
    if (race.reported) {
      finished = true;
      break;
    }
  }
  assert.equal(sim.race?.phase === "countdown", false);
  assert.ok(Math.hypot(p.x - x0, p.z - z0) > 12, `car stayed near the grid at ${p.x},${p.z}`);
  assert.ok(p.speed > 5 || p.finished, `expected speed after GO, got ${p.speed}`);
  assert.equal(finished, true, `race did not resolve (cp ${p.cp} lap ${p.lap})`);
  assert.equal(useGame.getState().screen, "results");
  assert.ok((useGame.getState().lastResult?.reward ?? 0) > 0);
  assert.ok(useGame.getState().credits > 1200);
});

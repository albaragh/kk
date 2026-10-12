import { audio } from "./audio";
import { bridge } from "./bridge";
import { effectiveStats, getCar } from "./cars";
import { angNorm, clamp } from "./math";
import { brakeFromCodes, steerFromCodes, throttleFromCodes, deadzone } from "./input";
import {
  createVehicleState,
  forwardOf,
  rightOf,
  stepVehicle,
  type VehicleInput,
  type VehicleState,
} from "./physics";
import type { RaceResult } from "./types";
import {
  angleTo,
  CHAMPIONSHIP,
  collideWorld,
  crossedGate,
  FREE_SPAWN,
  GARAGE_SPOT,
  getRace,
  raceSpawn,
  sampleGround,
  setRain,
  signalRed,
  trafficPaths,
  type RaceDef,
} from "./world";

export type Body = VehicleState & {
  id: string;
  active: boolean;
  kind: "player" | "racer" | "traffic" | "police";
  carId: string;
  paint: string;
  accent: string;
  nameAr: string;
  nameEn: string;
  path: { x: number; z: number }[] | null;
  pathIndex: number;
  skill: number;
  lap: number;
  cp: number;
  progress: number;
  finished: boolean;
  finishTime: number;
  stuck: number;
  bust: number;
  respawnX: number;
  respawnZ: number;
  respawnYaw: number;
  ride: number;
  glow: string;
  wheels: number;
  spoiler: boolean;
  bumper: number;
};

export type RaceRun = {
  def: RaceDef;
  phase: "countdown" | "live" | "done";
  countdown: number;
  elapsed: number;
  beep: number;
  resolved: boolean;
  reported: boolean;
  place: number;
  score: number;
  championship: boolean;
  escaped: boolean;
  busted: boolean;
};

type Mode = "title" | "garage" | "drive" | "pause" | "results";

const IDS = ["player", "r0", "r1", "r2", "r3", "t0", "t1", "t2", "t3", "t4"];

const RIVAL_CARS = ["barq", "shihab", "saker", "najm", "wamda", "lahab"];
const RIVAL_NAMES = [
  ["ناصر", "Nasser"],
  ["ليان", "Layan"],
  ["فهد", "Fahd"],
  ["مشعل", "Mishaal"],
];

function blank(id: string): Body {
  const base = createVehicleState(0, 0, 0);
  return {
    ...base,
    id,
    active: false,
    kind: "traffic",
    carId: "afaq-sedan",
    paint: "#d9d3c7",
    accent: "#e8a317",
    nameAr: id,
    nameEn: id,
    path: null,
    pathIndex: 0,
    skill: 0.6,
    lap: 0,
    cp: 0,
    progress: 0,
    finished: false,
    finishTime: 0,
    stuck: 0,
    bust: 0,
    respawnX: 0,
    respawnZ: 0,
    respawnYaw: 0,
    ride: 0,
    glow: "#2ec4b6",
    wheels: 1,
    spoiler: false,
    bumper: 0,
  };
}

function createSim() {
  return {
  bodies: Object.fromEntries(IDS.map((id) => [id, blank(id)])) as Record<string, Body>,
  ids: IDS,
  mode: "title" as Mode,
  acc: 0,
  time: 0,
  timeOfDay: 0.03,
  rain: false,
  cycle: false,
  quality: "high" as "low" | "med" | "high",
  assist: 0.25,
  volume: 0.7,
  camera: "chase" as "chase" | "hood" | "bumper",
  keys: new Set<string>(),
  qaKeys: null as Set<string> | null,
  qaSteer: null as number | null,
  tiltSteer: 0,
  touch: { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false },
  pad: { steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false },
  race: null as RaceRun | null,
  shake: 0,
  driftCombo: 0,
  driftBank: 0,
  cinematic: 0,
  snapCam: true,
  wrongWay: false,
  arrow: 0,
  arrowDist: 0,
  distancePending: 0,
  escape: 0,
  heat: 0,
  reduce: false,
  booted: false,
  };
}

type Sim = ReturnType<typeof createSim>;
const host = globalThis as typeof globalThis & { __MIDNIGHT_RUSH_SIM__?: Sim };
export const sim: Sim = host.__MIDNIGHT_RUSH_SIM__ ?? (host.__MIDNIGHT_RUSH_SIM__ = createSim());
if (sim.driftBank == null) sim.driftBank = 0;

function player() {
  return sim.bodies.player!;
}

function placeAt(body: Body, x: number, z: number, yaw: number, snapY = true) {
  body.x = x;
  body.z = z;
  body.yaw = yaw;
  body.vx = 0;
  body.vz = 0;
  body.speed = 0;
  body.vLat = 0;
  body.px = x;
  body.pz = z;
  body.respawnX = x;
  body.respawnZ = z;
  body.respawnYaw = yaw;
  const g = sampleGround(x, z);
  body.surface = g.surface;
  if (snapY) body.y = g.y + getCar(body.carId).wheel + body.ride;
}

function stylePlayer() {
  const setup = bridge.getSetup();
  const car = getCar(setup.carId);
  const p = player();
  p.carId = car.id;
  p.paint = setup.visual.paint;
  p.accent = car.accent;
  p.glow = setup.visual.glow;
  p.wheels = setup.visual.wheels;
  p.spoiler = setup.visual.spoiler || car.spoiler > 0.25;
  p.bumper = setup.visual.bumper;
  p.ride = setup.visual.ride;
  p.nameAr = "أنت";
  p.nameEn = "You";
  p.kind = "player";
  sim.assist = setup.settings.assist;
  sim.quality = setup.settings.quality;
  sim.volume = setup.settings.volume;
  sim.camera = setup.settings.camera;
  sim.rain = setup.settings.rain;
  sim.cycle = setup.settings.cycle;
  setRain(sim.rain);
  audio.setVolume(setup.settings.volume);
  if (!sim.cycle) {
    sim.timeOfDay =
      setup.settings.time === "day" ? 0.5 : setup.settings.time === "dusk" ? 0.74 : setup.settings.time === "dawn" ? 0.28 : 0.03;
  }
}

export function refreshPlayer() {
  if (!sim.booted) return;
  const p = player();
  const x = p.x;
  const z = p.z;
  const yaw = p.yaw;
  stylePlayer();
  const g = sampleGround(x, z);
  p.y = g.y + getCar(p.carId).wheel + p.ride;
  p.x = x;
  p.z = z;
  p.yaw = yaw;
}

function parkTraffic() {
  const paths = trafficPaths();
  ["t0", "t1", "t2", "t3", "t4"].forEach((id, i) => {
    const b = sim.bodies[id]!;
    const path = paths[i % paths.length]!;
    const cars = ["najd-cruise", "darb", "waha", "nakheel", "muzn"];
    const car = getCar(cars[i] ?? "darb");
    b.active = true;
    b.kind = "traffic";
    b.carId = car.id;
    b.paint = car.paint;
    b.accent = car.accent;
    b.spoiler = car.spoiler > 0.2;
    b.path = path;
    b.pathIndex = Math.floor((i * path.length) / 5) % path.length;
    b.skill = 0.45;
    const q = path[b.pathIndex]!;
    const n = path[(b.pathIndex + 1) % path.length]!;
    const yaw = Math.atan2(-(n.x - q.x), -(n.z - q.z));
    placeAt(b, q.x, q.z, yaw);
    b.nameAr = "مرور";
    b.nameEn = "Traffic";
  });
}

function clearRacers() {
  for (const id of ["r0", "r1", "r2", "r3"]) sim.bodies[id]!.active = false;
}

export function boot() {
  if (sim.booted) return;
  stylePlayer();
  const p = player();
  p.active = true;
  placeAt(p, FREE_SPAWN.x, FREE_SPAWN.z, FREE_SPAWN.yaw);
  parkTraffic();
  clearRacers();
  sim.mode = "title";
  sim.booted = true;
  sim.snapCam = true;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sim.reduce = true;
  }
}

export function enterTitle() {
  boot();
  sim.mode = "title";
  sim.race = null;
  clearRacers();
  parkTraffic();
  const p = player();
  p.active = true;
  placeAt(p, GARAGE_SPOT.x, GARAGE_SPOT.z, GARAGE_SPOT.yaw);
  stylePlayer();
  sim.snapCam = true;
}

export function enterGarage() {
  boot();
  sim.mode = "garage";
  sim.race = null;
  const p = player();
  p.active = true;
  placeAt(p, GARAGE_SPOT.x, GARAGE_SPOT.z, GARAGE_SPOT.yaw);
  stylePlayer();
  p.vx = 0;
  p.vz = 0;
  p.speed = 0;
  sim.snapCam = true;
}

export function enterDrive() {
  boot();
  sim.mode = "drive";
  sim.race = null;
  sim.driftCombo = 0;
  sim.driftBank = 0;
  sim.cinematic = 0;
  sim.wrongWay = false;
  clearRacers();
  parkTraffic();
  stylePlayer();
  const p = player();
  p.active = true;
  p.lap = 0;
  p.cp = 0;
  p.progress = 0;
  p.finished = false;
  p.nitro = 0;
  placeAt(p, FREE_SPAWN.x, FREE_SPAWN.z, FREE_SPAWN.yaw);
  sim.snapCam = true;
}

export function enterRace(raceId: string, championship = false) {
  boot();
  const def = getRace(raceId);
  sim.mode = "drive";
  sim.driftCombo = 0;
  sim.driftBank = 0;
  sim.cinematic = 0;
  sim.escape = 0;
  sim.heat = 0;
  sim.wrongWay = false;
  const skill = clamp(def.skill + (championship ? 0.08 : 0), 0.4, 0.92);
  sim.race = {
    def,
    phase: "countdown",
    countdown: 3.2,
    elapsed: 0,
    beep: 4,
    resolved: false,
    reported: false,
    place: 1,
    score: 0,
    championship,
    escaped: false,
    busted: false,
  };
  stylePlayer();
  const total = 1 + (def.kind === "police" ? def.rivals : def.rivals);
  const p = player();
  p.active = true;
  p.kind = "player";
  p.lap = 0;
  p.cp = 0;
  p.progress = 0;
  p.finished = false;
  p.bust = 0;
  p.nitro = effectiveStats(getCar(p.carId), bridge.getSetup().upgrades).nitroMax;
  const spawn = raceSpawn(def, 0, total);
  placeAt(p, spawn.x, spawn.z, spawn.yaw);
  clearRacers();
  if (def.kind === "police") {
    for (let i = 0; i < def.rivals; i++) {
      const b = sim.bodies[`r${i}`]!;
      const car = getCar("hisn");
      b.active = true;
      b.kind = "police";
      b.carId = car.id;
      b.paint = i === 0 ? "#f4f6f7" : "#1a1d22";
      b.accent = "#1a1d22";
      b.spoiler = false;
      b.skill = skill;
      b.path = null;
      b.nameAr = "دورية";
      b.nameEn = "Patrol";
      b.lap = 0;
      b.cp = 0;
      b.finished = false;
      b.progress = 0;
      const fx = -Math.sin(spawn.yaw);
      const fz = -Math.cos(spawn.yaw);
      placeAt(b, spawn.x - fx * (16 + i * 7), spawn.z - fz * (16 + i * 7), spawn.yaw);
    }
  } else {
    for (let i = 0; i < def.rivals; i++) {
      const b = sim.bodies[`r${i}`]!;
      const car = getCar(RIVAL_CARS[i % RIVAL_CARS.length]!);
      const names = RIVAL_NAMES[i % RIVAL_NAMES.length]!;
      b.active = true;
      b.kind = "racer";
      b.carId = car.id;
      b.paint = car.paint;
      b.accent = car.accent;
      b.spoiler = car.spoiler > 0.2;
      b.skill = skill - i * 0.04;
      b.path = def.path;
      b.pathIndex = 2;
      b.nameAr = names[0]!;
      b.nameEn = names[1]!;
      b.lap = 0;
      b.cp = 0;
      b.finished = false;
      b.progress = 0;
      const s = raceSpawn(def, i + 1, total);
      placeAt(b, s.x, s.z, s.yaw);
    }
  }
  parkTraffic();
  const racing = def.kind !== "drift";
  ["t0", "t1", "t2", "t3", "t4"].forEach((id, i) => {
    const b = sim.bodies[id]!;
    if (racing && i > 2) b.active = false;
    if (b.active && Math.hypot(b.x - p.x, b.z - p.z) < 18) b.active = false;
  });
  sim.snapCam = true;
  bridge.bump();
}

export function respawn() {
  const p = player();
  if (!p.active) return;
  placeAt(p, p.respawnX, p.respawnZ, p.respawnYaw);
  sim.snapCam = true;
}

function inputFor(body: Body, dt: number): VehicleInput {
  if (body.kind === "player") return playerInput();
  return aiInput(body, dt);
}

function playerInput(): VehicleInput {
  pollPad();
  const codes = sim.qaKeys ?? sim.keys;
  let steer = steerFromCodes(codes);
  if (sim.qaSteer != null && sim.qaKeys) steer = sim.qaSteer;
  let throttle = throttleFromCodes(codes);
  let brake = brakeFromCodes(codes);
  let handbrake = false;
  let nitro = false;
  for (const code of codes) {
    if (code === "Space") handbrake = true;
    if (code === "ShiftLeft" || code === "ShiftRight") nitro = true;
  }
  if (!sim.qaKeys) {
    steer = clamp(steer + sim.pad.steer + sim.touch.steer + sim.tiltSteer, -1, 1);
    throttle = Math.max(throttle, sim.pad.throttle, sim.touch.throttle);
    brake = Math.max(brake, sim.pad.brake, sim.touch.brake);
    handbrake = handbrake || sim.pad.handbrake || sim.touch.handbrake;
    nitro = nitro || sim.pad.nitro || sim.touch.nitro;
  }
  const race = sim.race;
  if (race && race.phase === "countdown") {
    return { steer: 0, throttle: 0, brake: 1, handbrake: true, nitro: false };
  }
  return { steer, throttle, brake, handbrake, nitro };
}

function pollPad() {
  sim.pad.steer = 0;
  sim.pad.throttle = 0;
  sim.pad.brake = 0;
  sim.pad.handbrake = false;
  sim.pad.nitro = false;
  if (sim.qaKeys || typeof navigator === "undefined" || !navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    sim.pad.steer = clamp(-deadzone(pad.axes[0] ?? 0), -1, 1);
    const lt = pad.buttons[6]?.value ?? 0;
    const rt = pad.buttons[7]?.value ?? 0;
    sim.pad.throttle = rt > 0.08 ? rt : pad.buttons[0]?.pressed ? 1 : 0;
    sim.pad.brake = lt > 0.08 ? lt : pad.buttons[1]?.pressed && !(pad.buttons[7]?.pressed) ? 1 : 0;
    sim.pad.handbrake = !!(pad.buttons[1]?.pressed || pad.buttons[5]?.pressed);
    sim.pad.nitro = !!(pad.buttons[0]?.pressed && (pad.buttons[7]?.pressed));
    break;
  }
}

function aiInput(body: Body, dt: number): VehicleInput {
  const race = sim.race;
  if (race && race.phase === "countdown") {
    return { steer: 0, throttle: 0, brake: 1, handbrake: true, nitro: false };
  }
  let tx = body.x;
  let tz = body.z;
  if (body.kind === "police") {
    const p = player();
    const f = forwardOf(p.yaw);
    tx = p.x + f.x * 8;
    tz = p.z + f.z * 8;
  } else if (body.path && body.path.length > 1) {
    const path = body.path;
    let idx = body.pathIndex % path.length;
    let guard = 0;
    while (guard++ < path.length) {
      const q = path[idx]!;
      if (Math.hypot(q.x - body.x, q.z - body.z) < 8) idx = (idx + 1) % path.length;
      else break;
    }
    body.pathIndex = idx;
    const look = Math.min(path.length - 1, 2 + Math.floor(Math.abs(body.speed) / 18));
    const aim = path[(idx + look) % path.length]!;
    tx = aim.x;
    tz = aim.z;
    if (body.kind === "traffic" && signalRed(body.x, body.z, sim.time)) {
      return { steer: 0, throttle: 0, brake: 1, handbrake: false, nitro: false };
    }
  }
  const dx = tx - body.x;
  const dz = tz - body.z;
  const desired = Math.atan2(-dx, -dz);
  const diff = angNorm(desired - body.yaw);
  let steer = clamp(diff * 2.5, -1, 1);
  const car = getCar(body.carId);
  let target = car.top * (0.62 + body.skill * 0.28) * (1 - clamp(Math.abs(diff), 0, 1) * 0.5);
  if (body.kind === "traffic") target = Math.min(target, body.path && body.path.length < 8 ? 22 : 16);
  if (body.kind === "police") target = Math.min(car.top * 0.92, Math.abs(player().speed) + 3 + body.skill * 8);
  if (body.kind === "racer" && sim.race) {
    const gap = player().progress - body.progress;
    target *= 1 + clamp(gap * 0.05, -0.06, 0.05);
  }
  const f = forwardOf(body.yaw);
  const r = rightOf(body.yaw);
  for (const id of sim.ids) {
    if (id === body.id) continue;
    const o = sim.bodies[id]!;
    if (!o.active) continue;
    const ox = o.x - body.x;
    const oz = o.z - body.z;
    const ahead = ox * f.x + oz * f.z;
    const lat = ox * r.x + oz * r.z;
    if (ahead > 0 && ahead < 14 && Math.abs(lat) < 3.1) {
      steer += lat > 0 ? 0.85 : -0.85;
      target *= 0.82;
    }
  }
  steer = clamp(steer, -1, 1);
  const throttle = body.speed < target ? 1 : 0.25;
  const brake = body.speed > target + 4 ? 0.7 : 0;
  if (throttle > 0.4 && Math.abs(body.speed) < 1.2) body.stuck += dt;
  else body.stuck = Math.max(0, body.stuck - dt);
  if (body.stuck > 1.7 && body.path && body.path.length) {
    const q = body.path[body.pathIndex % body.path.length]!;
    placeAt(body, q.x, q.z, body.yaw);
    body.stuck = 0;
  }
  return { steer, throttle, brake, handbrake: false, nitro: false };
}

function updateProgress(body: Body, def: RaceDef) {
  if (def.kind === "drift" || def.kind === "police" || def.gates.length === 0) {
    body.progress = body.finished ? 1 : 0;
    return;
  }
  const n = def.gates.length;
  const next = def.gates[Math.min(body.cp, n - 1)]!;
  const dist = Math.hypot(next.x - body.x, next.z - body.z);
  const frac = clamp(1 - dist / 80, 0, 0.99);
  body.progress = body.finished ? def.laps * n + 2 : body.lap * n + body.cp + frac;
}

function checkGates(body: Body, def: RaceDef) {
  if (body.finished || def.gates.length === 0) return;
  const gate = def.gates[body.cp];
  if (!gate) return;
  if (!crossedGate(body.px, body.pz, body.x, body.z, gate)) return;
  body.respawnX = gate.x;
  body.respawnZ = gate.z;
  body.respawnYaw = gate.yaw;
  body.cp += 1;
  if (body.cp >= def.gates.length) {
    if (def.wrap) {
      body.cp = 0;
      body.lap += 1;
      if (body.lap >= def.laps) finishBody(body);
    } else finishBody(body);
  }
}

function finishBody(body: Body) {
  if (body.finished) return;
  body.finished = true;
  body.finishTime = sim.race?.elapsed ?? 0;
}

function standingsLive() {
  const race = sim.race;
  if (!race) return [];
  const list = sim.ids
    .map((id) => sim.bodies[id]!)
    .filter((b) => b.active && (b.kind === "player" || b.kind === "racer"));
  list.sort((a, b) => b.progress - a.progress || a.finishTime - b.finishTime);
  return list;
}

function resolveRace(dt: number) {
  const race = sim.race;
  if (!race || race.resolved) return;
  const p = player();
  if (race.def.kind === "drift") {
    if (race.elapsed >= race.def.duration) {
      p.finished = true;
      race.score = sim.driftBank;
      race.place = 1;
      race.resolved = true;
      sim.cinematic = sim.reduce ? 0.2 : 1.3;
    }
    return;
  }
  if (race.def.kind === "police") {
    let near = 1e9;
    for (const id of ["r0", "r1", "r2", "r3"]) {
      const b = sim.bodies[id]!;
      if (!b.active || b.kind !== "police") continue;
      near = Math.min(near, Math.hypot(b.x - p.x, b.z - p.z));
    }
    sim.heat = clamp((90 - near) / 18, 0, 5);
    if (near < 5) p.bust += dt;
    else p.bust = Math.max(0, p.bust - dt * 0.35);
    if (near > 88) sim.escape += dt;
    else sim.escape = 0;
    if (p.bust > 2.6) {
      race.busted = true;
      race.place = race.def.rivals + 1;
      race.resolved = true;
      sim.cinematic = sim.reduce ? 0.2 : 1.2;
    } else if (sim.escape > 8 || race.elapsed > race.def.duration) {
      race.escaped = sim.escape > 8 || near > 70;
      race.busted = !race.escaped;
      race.place = race.escaped ? 1 : race.def.rivals + 1;
      race.resolved = true;
      sim.cinematic = sim.reduce ? 0.2 : 1.3;
    }
    return;
  }
  if (p.finished) {
    const board = standingsLive();
    race.place = Math.max(1, board.findIndex((b) => b.id === "player") + 1);
    race.resolved = true;
    sim.cinematic = sim.reduce ? 0.2 : 1.45;
  }
}

function reportRace() {
  const race = sim.race;
  if (!race || !race.resolved || race.reported || sim.cinematic > 0) return;
  race.reported = true;
  const p = player();
  const total = 1 + race.def.rivals;
  let reward = 0;
  if (race.def.kind === "drift") {
    reward = Math.round(race.def.reward * 0.35 + race.score * 0.45);
  } else if (race.def.kind === "police") {
    reward = race.escaped ? race.def.reward + Math.round(sim.heat * 350) : -1500;
  } else {
    const posFactor = (total - race.place + 1) / total;
    reward = Math.round(race.def.reward * (0.42 + posFactor * 0.75));
    if (race.elapsed > 0 && race.elapsed < race.def.par) reward = Math.round(reward * 1.15);
    if (race.place === 1) reward += 400;
  }
  if (race.championship && race.place <= 3 && race.def.kind !== "police") reward = Math.round(reward * 1.4);
  const higher = race.def.higherBetter;
  const result: RaceResult = {
    raceId: race.def.id,
    place: race.place,
    total,
    time: race.elapsed,
    score: race.def.kind === "drift" ? race.score : race.elapsed,
    reward,
    higherBetter: higher,
    championship: race.championship,
    escaped: race.escaped,
    busted: race.busted,
    record: false,
  };
  sim.mode = "results";
  bridge.finish(result);
}

function tick(dt: number) {
  sim.time += dt;
  if (sim.cycle && sim.mode === "drive" && !sim.race) sim.timeOfDay = (sim.timeOfDay + dt / 420) % 1;
  sim.shake = Math.max(0, sim.shake - dt);
  const movingKinds = sim.mode === "title" || sim.mode === "garage" ? ["traffic"] : ["player", "racer", "traffic", "police"];
  for (const id of sim.ids) {
    const body = sim.bodies[id]!;
    if (!body.active || !movingKinds.includes(body.kind)) continue;
    if ((sim.mode === "title" || sim.mode === "garage") && body.kind !== "traffic") continue;
    const setup = body.kind === "player" ? bridge.getSetup() : null;
    const stats = effectiveStats(getCar(body.carId), setup ? setup.upgrades : { engine: 0, brakes: 0, suspension: 0, gearbox: 0, turbo: 0 });
    const ride = body.kind === "player" && setup ? setup.visual.ride : 0;
    const g0 = sampleGround(body.x, body.z);
    const input = inputFor(body, dt);
    stepVehicle(body, input, stats, dt, g0.surface, body.kind === "player" ? sim.assist : 0, g0.y, ride);
    const impact = collideWorld(body);
    if (body.kind === "player" && impact > 4) sim.shake = Math.min(0.45, sim.shake + impact * 0.02);
    const f = forwardOf(body.yaw);
    const rgt = rightOf(body.yaw);
    body.speed = body.vx * f.x + body.vz * f.z;
    body.vLat = body.vx * rgt.x + body.vz * rgt.z;
    const g1 = sampleGround(body.x, body.z);
    body.surface = g1.surface;
    const targetY = g1.y + stats.wheelR + ride;
    body.y += (targetY - body.y) * Math.min(1, dt * 12);
    if (body.kind === "player") {
      sim.distancePending += Math.abs(body.speed) * dt;
      if (body.drifting) {
        const pts = Math.abs(body.vLat) * Math.abs(body.speed) * dt * 0.55;
        sim.driftCombo += pts;
        sim.driftBank += pts;
      } else sim.driftCombo = Math.max(0, sim.driftCombo - dt * 30);
      audio.engine(body.rpm, input.throttle, body.drifting);
    }
  }
  separateCars();
  const race = sim.race;
  if (race && sim.mode === "drive") {
    if (race.phase === "countdown") {
      const before = Math.ceil(race.countdown);
      race.countdown -= dt;
      const after = Math.ceil(Math.max(0, race.countdown));
      if (after < before && after > 0) audio.beep(520 + (3 - after) * 80, 0.1);
      if (race.countdown <= 0) {
        race.phase = "live";
        audio.beep(880, 0.18);
      }
    } else if (race.phase === "live" && !race.resolved) {
      race.elapsed += dt;
      for (const id of sim.ids) {
        const b = sim.bodies[id]!;
        if (!b.active) continue;
        if (b.kind === "player" || b.kind === "racer") {
          checkGates(b, race.def);
          updateProgress(b, race.def);
        }
      }
      const p = player();
      if (race.def.gates.length && !p.finished) {
        const gate = race.def.gates[Math.min(p.cp, race.def.gates.length - 1)]!;
        const aim = angleTo(p.yaw, p.x, p.z, gate.x, gate.z);
        sim.arrow = aim.ang;
        sim.arrowDist = aim.dist;
        const f = forwardOf(p.yaw);
        const dx = gate.x - p.x;
        const dz = gate.z - p.z;
        const dot = dx * f.x + dz * f.z;
        sim.wrongWay = dot < -8 && p.speed > 8 && aim.dist > 20;
      } else {
        sim.wrongWay = false;
        if (race.def.zone) {
          sim.arrow = angleTo(p.yaw, p.x, p.z, race.def.zone.x, race.def.zone.z).ang;
          sim.arrowDist = Math.hypot(race.def.zone.x - p.x, race.def.zone.z - p.z);
        }
      }
      if (race.def.kind === "drift" && race.def.zone) {
        const d = Math.hypot(p.x - race.def.zone.x, p.z - race.def.zone.z);
        if (d > race.def.zone.r) sim.driftCombo = Math.max(0, sim.driftCombo - dt * 80);
      }
      resolveRace(dt);
    }
    if (race.resolved) {
      sim.cinematic = Math.max(0, sim.cinematic - dt);
      reportRace();
    }
  }
  if (sim.distancePending > 40) {
    bridge.addDistance(sim.distancePending);
    sim.distancePending = 0;
  }
}

function separateCars() {
  const active = sim.ids.map((id) => sim.bodies[id]!).filter((b) => b.active);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      const min = 2.35;
      if (d >= min) continue;
      const nx = dx / d;
      const nz = dz / d;
      const push = (min - d) * 0.5;
      a.x += nx * push;
      a.z += nz * push;
      b.x -= nx * push;
      b.z -= nz * push;
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rel < 0) {
        a.vx -= rel * nx * 0.6;
        a.vz -= rel * nz * 0.6;
        b.vx += rel * nx * 0.6;
        b.vz += rel * nz * 0.6;
        if ((a.kind === "player" || b.kind === "player") && -rel > 6) sim.shake = Math.min(0.4, sim.shake + 0.12);
      }
    }
  }
}

export function advance(dt: number) {
  if (!sim.booted) return;
  if (sim.mode === "pause" || sim.mode === "results") return;
  let acc = sim.acc + Math.min(Math.max(0, dt), 0.2);
  let steps = 0;
  const step = 1 / 60;
  while (acc >= step && steps < 12) {
    tick(step);
    acc -= step;
    steps++;
  }
  if (steps >= 12) acc = 0;
  sim.acc = acc;
}

export function standings() {
  return standingsLive();
}

export function installProbe() {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => player().yaw,
    getSpeed: () => player().speed,
    setKeys: (codes: string[]) => {
      sim.qaKeys = new Set(codes);
    },
    setSteer: (v: number) => {
      sim.qaSteer = v;
    },
  };
  window.__midnight = {
    pos: () => {
      const p = player();
      const race = sim.race;
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        speed: p.speed,
        mode: sim.mode,
        cp: p.cp,
        lap: p.lap,
        phase: race?.phase ?? "none",
        countdown: race?.countdown ?? 0,
        booted: sim.booted,
      };
    },
    clearQa: () => {
      sim.qaKeys = null;
      sim.qaSteer = null;
    },
  };
}

export function championshipIndexOk(round: number, raceId: string) {
  return CHAMPIONSHIP[round] === raceId;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    __midnight?: {
      pos: () => {
        x: number;
        y: number;
        z: number;
        yaw: number;
        speed: number;
        mode: string;
        cp: number;
        lap: number;
        phase: string;
        countdown: number;
        booted: boolean;
      };
      clearQa: () => void;
    };
  }
}

if (typeof window !== "undefined") installProbe();

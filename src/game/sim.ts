import { AudioBus } from "./audio";
import {
  CINEMATIC_LINES,
  DIALOGUES,
  ENEMIES,
  INTERACTS,
  NOTES,
  QUESTS,
  RECIPES,
  SHOP,
  itemDef,
  questDef,
} from "./content";
import {
  applyEvent,
  armorMitigation,
  blankQuests,
  canPay,
  inArc,
  markReach,
  recipeReady,
  startQuest,
  strikeDamage,
  syncHave,
  weaponPower,
  xpToNext,
  type QuestAdvance,
  type QuestProgress,
} from "./logic";
import { clamp, dampAngle, wishDir, yawFromDir } from "./math";
import { loadSave, loadSettings, writeSave, writeSettings, type SaveData, type Settings } from "./save";
import type { Archetype, Lang, Panel, Phase } from "./types";
import { BLOCKS, GRAPPLES, WATERS, insideBlock, kingdomAt, terrainHeight } from "./world";

type ArchStat = {
  hp: number;
  speed: number;
  dmg: number;
  range: number;
  aggro: number;
  cd: number;
  r: number;
  windup: number;
  xp: number;
  motes: number;
  shield?: boolean;
  hover?: boolean;
  boss?: boolean;
  leash: number;
};

const ARCH: Record<Archetype, ArchStat> = {
  raider: { hp: 52, speed: 5.4, dmg: 8, range: 1.75, aggro: 13, cd: 1.25, r: 0.42, windup: 0.36, xp: 14, motes: 4, leash: 22 },
  guard: { hp: 96, speed: 3.2, dmg: 12, range: 1.9, aggro: 12, cd: 1.55, r: 0.55, windup: 0.5, xp: 18, motes: 6, shield: true, leash: 18 },
  archer: { hp: 40, speed: 4.1, dmg: 8, range: 12, aggro: 16, cd: 1.7, r: 0.4, windup: 0.42, xp: 15, motes: 5, leash: 22 },
  mage: { hp: 46, speed: 3.3, dmg: 10, range: 11, aggro: 15, cd: 1.9, r: 0.42, windup: 0.5, xp: 16, motes: 6, hover: true, leash: 18 },
  brute: { hp: 150, speed: 2.7, dmg: 18, range: 2.35, aggro: 12, cd: 1.9, r: 0.75, windup: 0.68, xp: 26, motes: 8, leash: 16 },
  captain: { hp: 180, speed: 4.3, dmg: 14, range: 2.15, aggro: 14, cd: 1.2, r: 0.55, windup: 0.4, xp: 48, motes: 16, leash: 24 },
  beast: { hp: 58, speed: 6.5, dmg: 9, range: 1.65, aggro: 14, cd: 0.95, r: 0.5, windup: 0.26, xp: 14, motes: 3, leash: 26 },
  auto: { hp: 88, speed: 3.5, dmg: 12, range: 2.05, aggro: 13, cd: 1.45, r: 0.55, windup: 0.46, xp: 22, motes: 7, shield: true, leash: 18 },
  thief: { hp: 28, speed: 8.4, dmg: 0, range: 1.2, aggro: 0, cd: 9, r: 0.38, windup: 9, xp: 24, motes: 18, leash: 80 },
  trainer: { hp: 400, speed: 1.2, dmg: 3, range: 1.85, aggro: 5.5, cd: 1.35, r: 0.5, windup: 0.58, xp: 0, motes: 0, leash: 7 },
  boss_bloom: { hp: 340, speed: 4.1, dmg: 16, range: 2.7, aggro: 18, cd: 1.25, r: 1.05, windup: 0.52, xp: 90, motes: 30, boss: true, leash: 32 },
  boss_frost: { hp: 380, speed: 3.5, dmg: 18, range: 2.8, aggro: 16, cd: 1.4, r: 1.1, windup: 0.58, xp: 100, motes: 32, boss: true, shield: true, leash: 28 },
  boss_ash: { hp: 420, speed: 3.2, dmg: 20, range: 3, aggro: 17, cd: 1.45, r: 1.2, windup: 0.62, xp: 110, motes: 36, boss: true, leash: 30 },
  boss_lost: { hp: 440, speed: 3.7, dmg: 18, range: 2.7, aggro: 16, cd: 1.3, r: 1.15, windup: 0.5, xp: 120, motes: 40, boss: true, leash: 26 },
  boss_moon: { hp: 620, speed: 4.5, dmg: 22, range: 3.3, aggro: 24, cd: 1.05, r: 1.3, windup: 0.46, xp: 220, motes: 80, boss: true, leash: 40 },
};

export type RuntimeEnemy = {
  id: string;
  arch: Archetype;
  tag: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  ai: string;
  hx: number;
  hz: number;
  tx: number;
  tz: number;
  cd: number;
  wind: number;
  stagger: number;
  phase: number;
  slam: boolean;
  flash: number;
  swing: number;
  path: { x: number; z: number }[];
  pathI: number;
  atkN: number;
};

type Shot = { x: number; y: number; z: number; vx: number; vz: number; vy: number; life: number; dmg: number; team: "p" | "e"; r: number };

type Obj = {
  id: string;
  tag: string;
  x: number;
  z: number;
  y: number;
  r: number;
  ar: string;
  en: string;
  kind: string;
  npc?: string;
  item?: string;
  ref?: string;
  used: boolean;
};

export type Toast = { ar: string; en: string; life: number };
export type FloatNote = { x: number; y: number; z: number; text: string; life: number };

const GRAV = 20;

export class GameSim {
  phase: Phase = "title";
  panel: Panel = "none";
  settings: Settings = loadSettings();
  player = this.freshPlayer();
  camYaw = 0;
  camPitch = 0.28;
  cam = { x: 18, y: 12, z: 46, lx: 0, ly: 3, lz: 0, shake: 0, fov: 52 };
  enemies: RuntimeEnemy[] = [];
  objects: Obj[] = [];
  shots: Shot[] = [];
  notes: FloatNote[] = [];
  toasts: Toast[] = [];
  quests: Record<string, QuestProgress> = blankQuests();
  inv: Record<string, number> = { salve: 2, cloth: 1, scimitar: 1 };
  weapon = "scimitar";
  armor = "cloth";
  skills: Record<string, number> = {};
  points = 0;
  motes = 18;
  level = 1;
  xp = 0;
  discovered = new Set<string>(["sand"]);
  flags: Record<string, number> = {};
  mirrorOrder: number[] = [];
  mirrorSolved = false;
  gears = [0, 0, 0];
  gearSolved = false;
  dialogue: { npc: string; node: string } | null = null;
  note: { ar: string; en: string } | null = null;
  ending: "none" | "seal" | "share" = "none";
  endingOffer = false;
  spawn = { x: 0, z: 36 };
  time = 17.6;
  kills = 0;
  deaths = 0;
  parries = 0;
  play = 0;
  hasGlider = false;
  buffT = 0;
  shrine = 0;
  nearId: string | null = null;
  hintAr = "";
  hintEn = "";
  fps = 60;
  frameMs = 16;
  qualityAuto = true;
  keys = new Set<string>();
  probeOn = false;
  probeKeys = new Set<string>();
  stick = { x: 0, y: 0 };
  lookDx = 0;
  lookDy = 0;
  holdJump = false;
  pulses = { jump: false, attack: false, heavy: false, dodge: false, parry: false, sand: false, bolt: false, wind: false, interact: false, grapple: false, bomb: false };
  cinematicT = 0;
  line = "";
  lineEn = "";
  deadT = 0;
  saveFlash = 0;
  private acc = 0;
  private uiAcc = 0;
  private prev = new Set<string>();
  private lookIdle = 1;
  private foot = 0;
  private ver = 0;
  private listeners = new Set<() => void>();
  private sealWarned = 0;
  audio = new AudioBus();
  attract = 0;

  constructor() {
    const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    if (coarse) this.settings.quality = this.settings.quality === "high" ? "med" : this.settings.quality;
    if (coarse) this.settings.touch = true;
    this.bootstrapWorld(false);
  }

  freshPlayer() {
    return {
      x: 0, y: 2, z: 36, vx: 0, vy: 0, vz: 0, yaw: 0,
      hp: 100, maxHp: 100, energy: 100, maxEnergy: 100,
      grounded: true, climbing: false, swimming: false, gliding: false,
      iFrame: 0, dodgeCd: 0, attackT: 0, attackKind: "none" as "none" | "light" | "heavy",
      combo: 0, comboT: 0, swing: 0, parryT: 0, hurtT: 0, anim: 0, speed: 0,
      cds: { sand: 0, bolt: 0, wind: 0, grapple: 0 },
      grapple: null as { x: number; y: number; z: number } | null,
      climbId: -1,
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.ver;
  poke(force = false): void {
    if (!force && this.uiAcc < 0.1) return;
    this.uiAcc = 0;
    this.ver++;
    for (const l of this.listeners) l();
  }

  private bootstrapWorld(keepPlayer: boolean): void {
    this.enemies = ENEMIES.map((e) => this.makeEnemy(e.id, e.arch, e.tag, e.x, e.z, e.home));
    this.objects = INTERACTS.map((o) => ({ ...o, used: false, y: terrainHeight(o.x, o.z) }));
    if (!keepPlayer) {
      const p = this.freshPlayer();
      p.y = terrainHeight(p.x, p.z);
      this.player = p;
    }
  }

  private makeEnemy(id: string, arch: Archetype, tag: string, x: number, z: number, home?: { x: number; z: number }[]): RuntimeEnemy {
    const a = ARCH[arch];
    const y = terrainHeight(x, z) + (a.hover ? 1.3 : 0);
    return {
      id, arch, tag, x, y, z, yaw: 0, hp: a.hp, maxHp: a.hp, alive: true, ai: "wander",
      hx: x, hz: z, tx: x, tz: z, cd: 0.6 + Math.random(), wind: 0, stagger: 0, phase: 1,
      slam: false, flash: 0, swing: 0, path: home ?? [], pathI: 0, atkN: 0,
    };
  }

  setProbeKeys(codes: string[]): void {
    if (!codes.length) {
      this.probeOn = false;
      this.probeKeys.clear();
      return;
    }
    this.probeOn = true;
    this.probeKeys = new Set(codes);
  }

  tap(name: keyof GameSim["pulses"]): void {
    this.pulses[name] = true;
    this.audio.unlock();
    if (this.phase === "cinematic") this.skipCinematic();
  }

  addLook(dx: number, dy: number): void {
    this.lookDx += dx;
    this.lookDy += dy;
    this.lookIdle = 0;
  }

  lang(): Lang {
    return this.settings.lang;
  }

  t(ar: string, en: string): string {
    return this.settings.lang === "ar" ? ar : en;
  }

  crystalCount(): number {
    return ["shard_sand", "shard_life", "shard_frost", "shard_ash", "shard_lost"].filter((id) => (this.inv[id] ?? 0) > 0).length;
  }

  newGame(): void {
    this.audio.unlock();
    this.quests = blankQuests();
    this.inv = { salve: 2, cloth: 1, scimitar: 1 };
    this.weapon = "scimitar";
    this.armor = "cloth";
    this.skills = {};
    this.points = 0;
    this.motes = 18;
    this.level = 1;
    this.xp = 0;
    this.discovered = new Set(["sand"]);
    this.flags = {};
    this.mirrorOrder = [];
    this.mirrorSolved = false;
    this.gears = [0, 0, 0];
    this.gearSolved = false;
    this.kills = 0;
    this.deaths = 0;
    this.parries = 0;
    this.play = 0;
    this.hasGlider = false;
    this.buffT = 0;
    this.shrine = 0;
    this.ending = "none";
    this.endingOffer = false;
    this.spawn = { x: 0, z: 36 };
    this.time = 17.6;
    this.dialogue = null;
    this.note = null;
    this.panel = "none";
    this.shots = [];
    this.bootstrapWorld(false);
    this.recompute();
    this.player.hp = this.player.maxHp;
    this.player.energy = this.player.maxEnergy;
    const qa = typeof location !== "undefined" && new URLSearchParams(location.search).has("qa");
    if (qa) {
      this.phase = "play";
      this.cinematicT = 99;
    } else {
      this.phase = "cinematic";
      this.cinematicT = 0;
    }
    this.poke(true);
  }

  continueGame(): void {
    const data = loadSave();
    if (!data) return;
    this.audio.unlock();
    this.newGame();
    this.applySave(data);
    this.phase = "play";
    this.panel = "none";
    this.poke(true);
  }

  private applySave(d: SaveData): void {
    this.bootstrapWorld(false);
    this.player.x = d.x;
    this.player.y = d.y;
    this.player.z = d.z;
    this.player.yaw = d.yaw;
    this.camYaw = d.yaw;
    this.inv = { ...d.inv };
    this.weapon = d.weapon;
    this.armor = d.armor;
    this.skills = { ...d.skills };
    this.points = d.points;
    this.motes = d.motes;
    this.level = d.level;
    this.xp = d.xp;
    this.quests = d.quests;
    this.discovered = new Set(d.discovered);
    this.flags = { ...d.flags };
    this.mirrorOrder = [...d.mirrors];
    this.gears = [...d.gears];
    this.mirrorSolved = d.mirrorSolved;
    this.gearSolved = d.gearSolved;
    this.spawn = { x: d.spawnX, z: d.spawnZ };
    this.time = d.time;
    this.kills = d.kills;
    this.deaths = d.deaths;
    this.parries = d.parries;
    this.play = d.play;
    this.hasGlider = d.hasGlider;
    this.shrine = d.flags.shrine ?? 0;
    for (const id of d.dead) {
      const e = this.enemies.find((x) => x.id === id);
      if (e) e.alive = false;
    }
    for (const id of d.used) {
      const o = this.objects.find((x) => x.id === id);
      if (o) o.used = true;
    }
    this.recompute();
    this.player.hp = clamp(d.hp, 1, this.player.maxHp);
    this.player.energy = clamp(d.energy, 0, this.player.maxEnergy);
  }

  toSave(): SaveData {
    return {
      version: 1,
      x: this.player.x, y: this.player.y, z: this.player.z, yaw: this.player.yaw,
      hp: this.player.hp, energy: this.player.energy, level: this.level, xp: this.xp,
      points: this.points, motes: this.motes, weapon: this.weapon, armor: this.armor,
      inv: { ...this.inv }, skills: { ...this.skills }, quests: JSON.parse(JSON.stringify(this.quests)) as Record<string, QuestProgress>,
      dead: this.enemies.filter((e) => !e.alive).map((e) => e.id),
      used: this.objects.filter((o) => o.used).map((o) => o.id),
      discovered: [...this.discovered], flags: { ...this.flags, shrine: this.shrine },
      mirrors: [...this.mirrorOrder], gears: [...this.gears], mirrorSolved: this.mirrorSolved, gearSolved: this.gearSolved,
      spawnX: this.spawn.x, spawnZ: this.spawn.z, time: this.time, kills: this.kills, deaths: this.deaths,
      parries: this.parries, play: this.play, hasGlider: this.hasGlider,
    };
  }

  toast(ar: string, en: string): void {
    this.toasts.push({ ar, en, life: 2.6 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  save(): void {
    writeSave(this.toSave());
    this.saveFlash = 1.4;
    this.toast("حُفظ التقدّم", "Progress saved");
    this.poke(true);
  }

  saveSettings(): void {
    writeSettings(this.settings);
    this.audio.setMusic(this.settings.music);
    this.audio.setSfx(this.settings.sfx);
    this.poke(true);
  }

  tick(realDt: number): void {
    const dt = Math.min(realDt, 0.05);
    this.frameMs = dt * 1000;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.05;
    this.acc += dt;
    let n = 0;
    while (this.acc >= 1 / 60 && n < 4) {
      this.step(1 / 60);
      this.acc -= 1 / 60;
      n++;
    }
    this.uiAcc += dt;
    this.poke(false);
  }

  private down(code: string): boolean {
    return (this.probeOn ? this.probeKeys : this.keys).has(code);
  }

  private step(dt: number): void {
    this.attract += dt;
    this.time = (this.time + dt * (24 / 480)) % 24;
    if (this.phase === "title") {
      this.orbitTitle();
      this.consumeEdges();
      return;
    }
    if (this.phase === "cinematic") {
      this.stepCinema(dt);
      this.consumeEdges();
      return;
    }
    if (this.phase === "dead") {
      this.deadT -= dt;
      if (this.deadT <= 0) this.respawn();
      this.consumeEdges();
      return;
    }
    if (this.phase === "ending") {
      this.followCam(dt, true);
      this.consumeEdges();
      return;
    }
    const paused = this.panel !== "none" || !!this.dialogue || !!this.note;
    if (paused) {
      if (this.pressed("Escape")) {
        if (this.note) this.note = null;
        else if (this.dialogue) this.dialogue = null;
        else this.panel = "none";
        this.poke(true);
      }
      this.player.vx = 0;
      this.player.vz = 0;
      this.followCam(dt, true);
    } else {
      this.play += dt;
      this.stepPlay(dt);
    }
    if (this.saveFlash > 0) this.saveFlash -= dt;
    for (const toast of this.toasts) toast.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    for (const n of this.notes) n.life -= dt;
    this.notes = this.notes.filter((n) => n.life > 0);
    this.audio.tick(kingdomAt(this.player.x, this.player.z), this.time);
    this.consumeEdges();
  }

  private consumeEdges(): void {
    const src = this.probeOn ? this.probeKeys : this.keys;
    this.prev = new Set(src);
    for (const k of Object.keys(this.pulses) as (keyof GameSim["pulses"])[]) this.pulses[k] = false;
  }

  private pressed(code: string): boolean {
    return this.down(code) && !this.prev.has(code);
  }

  private orbitTitle(): void {
    const a = this.attract * 0.15;
    this.cam.x = Math.sin(a) * 34;
    this.cam.z = Math.cos(a) * 34 + 8;
    this.cam.y = 11 + Math.sin(a * 0.7) * 1.5;
    this.cam.lx = 0;
    this.cam.ly = 3;
    this.cam.lz = -6;
    this.cam.shake = 0;
  }

  private stepCinema(dt: number): void {
    this.cinematicT += dt;
    const keys = [
      { t: 0, x: 36, y: 16, z: 62, lx: 0, ly: 4, lz: 0 },
      { t: 4.2, x: 10, y: 6.5, z: 42, lx: 0, ly: 2.4, lz: 8 },
      { t: 8.4, x: -6, y: 4.2, z: 30, lx: 0, ly: 2, lz: 12 },
      { t: 12.6, x: 2, y: 3.4, z: 40, lx: 0, ly: 1.7, lz: 18 },
    ];
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (this.cinematicT >= keys[i].t && this.cinematicT <= keys[i + 1].t) {
        a = keys[i];
        b = keys[i + 1];
      }
    }
    const u = clamp((this.cinematicT - a.t) / (b.t - a.t || 1), 0, 1);
    const s = u * u * (3 - 2 * u);
    this.cam.x = a.x + (b.x - a.x) * s;
    this.cam.y = a.y + (b.y - a.y) * s;
    this.cam.z = a.z + (b.z - a.z) * s;
    this.cam.lx = a.lx + (b.lx - a.lx) * s;
    this.cam.ly = a.ly + (b.ly - a.ly) * s;
    this.cam.lz = a.lz + (b.lz - a.lz) * s;
    const line = [...CINEMATIC_LINES].reverse().find((l) => this.cinematicT >= l.t);
    this.line = line?.ar ?? "";
    this.lineEn = line?.en ?? "";
    if (this.cinematicT > 13.4 || this.pressed("Escape") || this.pressed("Space") || this.pressed("Enter")) this.skipCinematic();
  }

  skipCinematic(): void {
    if (this.phase !== "cinematic") return;
    this.phase = "play";
    this.camYaw = 0;
    this.player.yaw = 0;
    this.line = "";
    this.toast("تقدّم نحو البوابة", "Walk to the gate");
    this.poke(true);
  }

  private stepPlay(dt: number): void {
    const p = this.player;
    if (this.pressed("Escape")) {
      this.panel = "pause";
      this.poke(true);
      return;
    }
    if (this.pressed("KeyM")) this.panel = this.panel === "map" ? "none" : "map";
    if (this.pressed("KeyI")) this.panel = this.panel === "inv" ? "none" : "inv";
    if (this.pressed("KeyU")) this.panel = this.panel === "skills" ? "none" : "skills";
    if (this.pressed("KeyL")) this.panel = this.panel === "quests" ? "none" : "quests";
    if (this.panel !== "none") {
      this.poke(true);
      return;
    }

    let mx = 0;
    let mz = 0;
    if (this.down("KeyD") || this.down("ArrowRight")) mx += 1;
    if (this.down("KeyA") || this.down("ArrowLeft")) mx -= 1;
    if (this.down("KeyW") || this.down("ArrowUp")) mz += 1;
    if (this.down("KeyS") || this.down("ArrowDown")) mz -= 1;
    mx = clamp(mx + this.stick.x, -1, 1);
    mz = clamp(mz + this.stick.y, -1, 1);

    const sens = this.settings.sens;
    this.camYaw -= this.lookDx * sens;
    this.camPitch = clamp(this.camPitch - this.lookDy * sens, -0.85, 0.55);
    this.lookDx = 0;
    this.lookDy = 0;
    if (this.down("KeyQ")) this.camYaw += dt * 1.5;
    if (this.down("KeyR")) this.camYaw -= dt * 1.5;
    this.lookIdle += dt;

    const wish = wishDir(this.camYaw, mx, mz);
    const moving = Math.hypot(wish.x, wish.z) > 0.1 && (Math.abs(mx) + Math.abs(mz) > 0.08);
    const sprint = (this.down("ShiftLeft") || this.down("ShiftRight")) && p.energy > 4 && moving;
    const speed = sprint ? 11 : moving ? 7.1 : 0;
    p.speed = speed;

    if (moving && this.lookIdle > 0.45) this.camYaw = dampAngle(this.camYaw, p.yaw, 1.15, dt);

    const jumpEdge = this.pressed("Space") || this.pulses.jump;
    const jumpHold = this.down("Space") || this.holdJump || this.pulses.jump;
    const dodge = this.pressed("KeyC") || this.pressed("ControlLeft") || this.pulses.dodge;
    const light = this.pressed("KeyJ") || this.pulses.attack;
    const heavy = this.pressed("KeyK") || this.pulses.heavy;
    const parry = this.pressed("KeyF") || this.pulses.parry;
    const inter = this.pressed("KeyE") === false && (this.pressed("KeyF") ? false : this.pressed("KeyR"));
    // interact is E, but E also yaws camera if held. Edge on KeyE is interact; yaw uses hold. Conflict.
    // Use only the edge for interact and remove E from yaw. Yaw is Q and mouse.
    const interact = this.pressed("KeyE") || this.pulses.interact;
    void inter;

    if (moving && p.attackT <= 0 && !p.grapple) {
      p.yaw = dampAngle(p.yaw, yawFromDir(wish.x, wish.z), 12, dt);
    }

    p.iFrame = Math.max(0, p.iFrame - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.comboT = Math.max(0, p.comboT - dt);
    p.parryT = Math.max(0, p.parryT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.cds.sand = Math.max(0, p.cds.sand - dt);
    p.cds.bolt = Math.max(0, p.cds.bolt - dt);
    p.cds.wind = Math.max(0, p.cds.wind - dt);
    p.cds.grapple = Math.max(0, p.cds.grapple - dt);
    if (this.buffT > 0) this.buffT -= dt;
    if (p.comboT === 0) p.combo = 0;

    const regen = 14 + (this.skills.breath ?? 0) * 6;
    if (!sprint && p.attackT <= 0) p.energy = Math.min(p.maxEnergy, p.energy + regen * dt);
    if (sprint) p.energy = Math.max(0, p.energy - 12 * dt);

    if (parry && p.energy > 8) {
      p.parryT = 0.16 + (this.skills.guard ?? 0) * 0.045;
      p.energy -= 8;
      p.attackT = Math.max(p.attackT, 0.18);
    }
    if (light && p.attackT <= 0) this.swing("light");
    if (heavy && p.attackT <= 0) this.swing("heavy");
    if ((this.pressed("Digit1") || this.pulses.sand) && p.cds.sand <= 0) this.cast("sand");
    if ((this.pressed("Digit2") || this.pulses.bolt) && p.cds.bolt <= 0) this.cast("bolt");
    if ((this.pressed("Digit3") || this.pulses.wind) && p.cds.wind <= 0) this.cast("wind");
    if ((this.pressed("Digit4") || this.pulses.bomb) && (this.inv.bomb ?? 0) > 0) this.useBomb();
    if (this.pressed("KeyG") || this.pulses.grapple) this.tryGrapple();
    if (interact) this.tryInteract();

    if (dodge && p.dodgeCd <= 0 && p.energy > 16 && p.attackT <= 0.05) {
      const dx = moving ? wish.x : -Math.sin(p.yaw);
      const dz = moving ? wish.z : -Math.cos(p.yaw);
      p.vx = dx * 16;
      p.vz = dz * 16;
      p.iFrame = 0.38;
      p.dodgeCd = 0.62;
      p.energy -= 16;
      p.climbing = false;
      p.grapple = null;
      this.audio.swing();
    }

    const water = WATERS.find((w) => Math.hypot(p.x - w.x, p.z - w.z) < w.r && terrainHeight(p.x, p.z) < w.y + 0.2);
    p.swimming = !!water && water.kind === "water" && p.y < water.y + 0.15 && !p.climbing;
    if (water && water.kind === "lava" && p.y < water.y + 0.4) this.hurt(16 * dt * 8, true);

    if (p.grapple) {
      const g = p.grapple;
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      const dz = g.z - p.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      p.vx = (dx / d) * 22;
      p.vy = (dy / d) * 22;
      p.vz = (dz / d) * 22;
      p.grounded = false;
      if (d < 1.6) {
        p.grapple = null;
        p.vy = 6;
      }
    } else if (p.climbing) {
      const up = mz;
      p.vy = up * 4.2;
      p.vx *= 0.8;
      p.vz *= 0.8;
      p.energy = Math.max(0, p.energy - 6 * dt);
      if (jumpEdge || p.energy <= 0) p.climbing = false;
    } else if (p.swimming && water) {
      p.vx = wish.x * 4.2;
      p.vz = wish.z * 4.2;
      p.y += (water.y - 0.55 - p.y) * Math.min(1, dt * 4);
      p.vy = 0;
      p.grounded = false;
      p.gliding = false;
      if (jumpEdge) p.vy = 6;
    } else {
      if (p.attackT > 0.08 && p.grounded) {
        p.vx *= 1 - Math.min(1, dt * 8);
        p.vz *= 1 - Math.min(1, dt * 8);
      } else if (p.grounded) {
        p.vx = wish.x * speed;
        p.vz = wish.z * speed;
        if (jumpEdge && p.attackT <= 0) {
          p.vy = 8.4;
          p.grounded = false;
          p.climbing = false;
        }
      } else {
        p.vx += (wish.x * speed - p.vx) * Math.min(1, dt * 3);
        p.vz += (wish.z * speed - p.vz) * Math.min(1, dt * 3);
        const glideDrain = 16 - (this.skills.wing ?? 0) * 5;
        if (jumpHold && this.hasGlider && p.vy < 0 && p.energy > 1) {
          p.gliding = true;
          p.vy = Math.max(p.vy, -2.3);
          p.energy -= glideDrain * dt;
        } else p.gliding = false;
        p.vy -= (kingdomAt(p.x, p.z) === "twilight" ? 12 : GRAV) * dt;
      }
    }

    if (p.attackT > 0.12 && p.attackT < 0.22) this.meleeTick();

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    this.solveWalls();
    p.y += p.vy * dt;
    this.solveGround();
    this.sealGate();

    if (moving && p.grounded) {
      this.foot -= dt;
      if (this.foot <= 0) {
        this.foot = sprint ? 0.28 : 0.42;
        this.audio.foot();
      }
    }
    p.anim += dt * (p.speed > 1 ? p.speed : 1.2);

    this.stepEnemies(dt);
    this.stepShots(dt);
    this.scanNear();
    this.scanReach();
    this.scanDiscover();
    if (p.hp <= 0) this.die();
    this.followCam(dt, false);
    if (Math.floor(this.play) % 45 === 0 && this.play - dt < Math.floor(this.play) && this.play > 2) this.save();
  }

  private solveWalls(): void {
    const p = this.player;
    const foot = p.y;
    const head = p.y + 1.65;
    for (const b of BLOCKS) {
      if (b.solid === false) continue;
      const top = b.base + b.h;
      if (head < b.base + 0.2 || foot > top - 0.35) continue;
      if (!insideBlock(p.x, p.z, b, 0.36)) continue;
      if (b.climb && (this.down("KeyW") || this.down("ArrowUp") || this.stick.y > 0.4)) {
        p.climbing = true;
        return;
      }
      let dx = p.x - b.x;
      let dz = p.z - b.z;
      if (b.shape === "cyl" || b.shape === "dome") {
        const r = Math.max(b.w, b.d) * 0.5 + 0.36;
        const d = Math.hypot(dx, dz) || 0.001;
        if (d < r) {
          p.x = b.x + (dx / d) * r;
          p.z = b.z + (dz / d) * r;
        }
        continue;
      }
      const hw = b.w * 0.5 + 0.36;
      const hd = b.d * 0.5 + 0.36;
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) p.x += Math.sign(dx || 1) * px;
      else p.z += Math.sign(dz || 1) * pz;
    }
    p.x = clamp(p.x, -340, 340);
    p.z = clamp(p.z, -340, 340);
    if (p.x < -190 && p.z > -30 && p.z < 40 && p.y > 9.4) {
      p.y = 9.4;
      if (p.vy > 0) p.vy = 0;
    }
  }

  private solveGround(): void {
    const p = this.player;
    if (p.climbing || p.swimming || p.grapple) return;
    let ground = terrainHeight(p.x, p.z);
    for (const b of BLOCKS) {
      if (b.solid === false) continue;
      if (!insideBlock(p.x, p.z, b, -0.05)) continue;
      const top = b.base + b.h;
      if (p.vy <= 0.1 && p.y >= top - 0.7 && p.y <= top + 0.55 && top > ground) ground = top;
    }
    if (p.y <= ground) {
      if (p.vy < -16) this.hurt(Math.round((-p.vy - 16) * 2.2), true);
      p.y = ground;
      p.vy = 0;
      p.grounded = true;
      p.gliding = false;
    } else p.grounded = false;
  }

  private sealGate(): void {
    if (this.crystalCount() >= 5) return;
    const p = this.player;
    if (p.z > 210 && p.x > 150 && p.x < 300) {
      p.z = 206;
      p.vz = 0;
      this.sealWarned -= 1 / 60;
      if (this.sealWarned <= 0) {
        this.sealWarned = 4;
        this.toast("الختم يطلب خمس بلّورات", "The seal wants five crystals");
      }
    }
  }

  private followCam(dt: number, still: boolean): void {
    const p = this.player;
    const dist = p.gliding ? 8.2 : 6.4;
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const wishX = p.x - fx * dist;
    const wishZ = p.z - fz * dist;
    let y = p.y + 2.35 + this.camPitch * -2.2;
    const gy = terrainHeight(wishX, wishZ) + 1.2;
    if (y < gy) y = gy;
    const k = 1 - Math.exp(-dt * (still ? 6 : 8));
    this.cam.x += (wishX - this.cam.x) * k;
    this.cam.y += (y - this.cam.y) * k;
    this.cam.z += (wishZ - this.cam.z) * k;
    this.cam.lx = p.x;
    this.cam.ly = p.y + 1.35;
    this.cam.lz = p.z;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 2.5);
    if (this.cam.shake > 0 && this.settings.shake) {
      this.cam.x += (Math.random() - 0.5) * this.cam.shake;
      this.cam.y += (Math.random() - 0.5) * this.cam.shake * 0.6;
    }
  }

  private swing(kind: "light" | "heavy"): void {
    const p = this.player;
    if (p.comboT > 0 && kind === "light") p.combo = Math.min(2, p.combo + 1);
    else p.combo = 0;
    p.comboT = 0.7;
    p.attackKind = kind;
    p.attackT = kind === "light" ? 0.38 : 0.62;
    p.swing += 1;
    p.energy = Math.max(0, p.energy - (kind === "light" ? 4 : 10));
    this.audio.swing();
  }

  private meleeTick(): void {
    const p = this.player;
    const kind = p.attackKind === "heavy" ? "heavy" : "light";
    const range = kind === "heavy" ? 2.7 + (this.weapon === "spear" ? 0.7 : 0) : 2.25;
    const arc = kind === "heavy" ? 1.15 : 0.9;
    const skill = kind === "light" || kind === "heavy" ? 0 : 0;
    for (const e of this.enemies) {
      if (!e.alive || e.swing === p.swing) continue;
      if (!inArc(p.x, p.z, p.yaw, e.x, e.z, range, arc)) continue;
      const stat = ARCH[e.arch];
      let dmg = strikeDamage({
        kind,
        combo: p.combo,
        weaponPower: weaponPower(this.weapon) * (this.weapon === "hammer" && kind === "light" ? 0.85 : 1),
        skill,
        edge: this.skills.edge ?? 0,
        buff: this.buffT > 0,
      });
      if (this.weapon === "axe") e.stagger = Math.max(e.stagger, 0.15);
      if (stat.shield && kind === "light") {
        const facing = Math.atan2(-(p.x - e.x), -(p.z - e.z));
        const diff = Math.abs(Math.atan2(Math.sin(facing - e.yaw), Math.cos(facing - e.yaw)));
        if (diff < 1.1) dmg = Math.round(dmg * 0.28);
      }
      e.swing = p.swing;
      this.damageEnemy(e, dmg, kind === "heavy");
    }
  }

  private cast(kind: "sand" | "bolt" | "wind"): void {
    const p = this.player;
    const cost = kind === "sand" ? 28 : kind === "wind" ? 18 : 24;
    if (p.energy < cost) {
      this.toast("الطاقة لا تكفي", "Not enough energy");
      return;
    }
    p.energy -= cost;
    const skill = this.skills[kind] ?? 0;
    const dmg = strikeDamage({
      kind,
      combo: 0,
      weaponPower: weaponPower(this.weapon) * (this.weapon === "staff" ? 1.2 : 1),
      skill,
      edge: this.skills.edge ?? 0,
      buff: this.buffT > 0,
    });
    if (kind === "sand") {
      p.cds.sand = 3.1;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 4.6) this.damageEnemy(e, dmg, true);
      }
      this.cam.shake = Math.max(this.cam.shake, 0.28);
    } else if (kind === "bolt") {
      p.cds.bolt = 2.6;
      const dx = -Math.sin(p.yaw);
      const dz = -Math.cos(p.yaw);
      p.x += dx * 6.5;
      p.z += dz * 6.5;
      p.iFrame = Math.max(p.iFrame, 0.18);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const t = ((e.x - (p.x - dx * 6.5)) * dx + (e.z - (p.z - dz * 6.5)) * dz);
        const px = p.x - dx * 6.5 + dx * clamp(t, 0, 6.5);
        const pz = p.z - dz * 6.5 + dz * clamp(t, 0, 6.5);
        if (Math.hypot(e.x - px, e.z - pz) < 1.5) this.damageEnemy(e, dmg, true);
      }
    } else {
      p.cds.wind = 1.8;
      this.shots.push({
        x: p.x - Math.sin(p.yaw) * 0.8,
        y: p.y + 1.2,
        z: p.z - Math.cos(p.yaw) * 0.8,
        vx: -Math.sin(p.yaw) * 22,
        vz: -Math.cos(p.yaw) * 22,
        vy: 0,
        life: 1.2,
        dmg,
        team: "p",
        r: 0.45,
      });
    }
    this.audio.swing();
  }

  private useBomb(): void {
    this.inv.bomb = (this.inv.bomb ?? 0) - 1;
    const p = this.player;
    const dmg = strikeDamage({ kind: "bomb", combo: 0, weaponPower: 1, skill: this.skills.sand ?? 0, edge: 0, buff: false });
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 5) this.damageEnemy(e, dmg, true);
    }
    this.cam.shake = 0.4;
  }

  private damageEnemy(e: RuntimeEnemy, dmg: number, stagger: boolean): void {
    if (!e.alive) return;
    if (e.arch === "trainer") {
      e.hp = e.maxHp;
      e.flash = 0.15;
      e.stagger = 0.3;
      return;
    }
    e.hp -= dmg;
    e.flash = 0.18;
    if (stagger) e.stagger = Math.max(e.stagger, 0.35);
    this.cam.shake = Math.max(this.cam.shake, 0.12);
    this.notes.push({ x: e.x, y: e.y + 2, z: e.z, text: String(dmg), life: 0.7 });
    this.audio.hit();
    if (e.hp <= 0) {
      e.alive = false;
      e.ai = "dead";
      this.kills += 1;
      this.motes += ARCH[e.arch].motes;
      if (Math.random() < 0.35) this.inv.herb = (this.inv.herb ?? 0) + 1;
      if (Math.random() < 0.2) this.inv.dust = (this.inv.dust ?? 0) + 1;
      this.grantXp(ARCH[e.arch].xp);
      this.toast(e.arch.startsWith("boss") ? "سقط الحارس" : "أُسقط الخصم", e.arch.startsWith("boss") ? "The warden fell" : "Foe down");
      this.onAdvance(applyEvent(this.quests, { type: "defeat", tag: e.tag }, this.inv, [...this.discovered]));
    }
  }

  private tryGrapple(): void {
    const p = this.player;
    if (p.cds.grapple > 0 || p.energy < 14) return;
    const range = 22 + (this.skills.hook ?? 0) * 8;
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    let best: { x: number; y: number; z: number } | null = null;
    let bestD = range;
    for (const g of GRAPPLES) {
      const d = Math.hypot(g.x - p.x, g.z - p.z, (g.y - p.y) * 0.6);
      if (d > bestD) continue;
      const dot = (g.x - p.x) * fx + (g.z - p.z) * fz;
      if (dot < 0) continue;
      best = g;
      bestD = d;
    }
    if (!best) {
      this.toast("لا خطاف قريب", "No hook in reach");
      return;
    }
    p.grapple = best;
    p.cds.grapple = 1.4;
    p.energy -= 14;
    p.climbing = false;
  }

  private stepEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.cd = Math.max(0, e.cd - dt);
      e.stagger = Math.max(0, e.stagger - dt);
      const stat = ARCH[e.arch];
      const dist = Math.hypot(e.x - p.x, e.z - p.z);
      if (e.arch === "thief") {
        this.stepThief(e, dt);
        e.y = terrainHeight(e.x, e.z);
        continue;
      }
      if (e.arch === "trainer" && this.quests.s_parry?.status === "done") {
        e.ai = "idle";
        e.y = terrainHeight(e.x, e.z);
        continue;
      }
      if (stat.boss && e.phase === 1 && e.hp < e.maxHp * 0.5) {
        e.phase = 2;
        this.toast("تغيّر إيقاع المعركة", "The fight changes rhythm");
        this.cam.shake = 0.35;
      }
      if (e.stagger > 0) {
        e.ai = "stagger";
        e.wind = 0;
        continue;
      }
      const leash = Math.hypot(e.x - e.hx, e.z - e.hz);
      let see = dist < stat.aggro && Math.abs(e.y - p.y) < 8;
      if (e.arch === "boss_moon" && this.crystalCount() < 5) see = false;
      if (!see && e.ai !== "return" && leash > 2 && dist > stat.aggro * 1.3) e.ai = leash > stat.leash ? "return" : "wander";
      if (see && e.ai !== "attack") e.ai = dist < stat.range ? "attack" : "chase";
      if (e.hp < e.maxHp * 0.25 && !stat.boss && e.ai === "chase" && Math.random() < dt * 0.4) e.ai = "retreat";
      const cdMul = e.phase === 2 ? 0.72 : 1;
      if (e.ai === "wander") {
        if (Math.hypot(e.x - e.tx, e.z - e.tz) < 1.2 || Math.random() < dt * 0.3) {
          const ang = Math.random() * Math.PI * 2;
          e.tx = e.hx + Math.cos(ang) * 5;
          e.tz = e.hz + Math.sin(ang) * 5;
        }
        this.moveEnemy(e, e.tx, e.tz, stat.speed * 0.45, dt);
      } else if (e.ai === "return") {
        this.moveEnemy(e, e.hx, e.hz, stat.speed, dt);
        if (leash < 1.5) e.ai = "wander";
      } else if (e.ai === "retreat") {
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        this.moveEnemy(e, e.x + dx, e.z + dz, stat.speed, dt);
        if (dist > stat.aggro) e.ai = "return";
      } else if (e.ai === "chase") {
        const prefer = stat.range > 4 ? stat.range * 0.75 : stat.range * 0.85;
        if (dist > prefer) this.moveEnemy(e, p.x, p.z, stat.speed, dt);
        else e.ai = "attack";
      } else if (e.ai === "attack") {
        e.yaw = dampAngle(e.yaw, yawFromDir(p.x - e.x, p.z - e.z), 8, dt);
        if (dist > stat.range * 1.25) e.ai = "chase";
        else if (e.cd <= 0 && e.wind <= 0) {
          e.wind = stat.windup * (e.phase === 2 && e.atkN % 3 === 2 ? 1.35 : 1);
          e.slam = e.phase === 2 && e.atkN % 3 === 2;
          e.atkN += 1;
        }
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0) {
            e.cd = stat.cd * cdMul;
            this.enemyStrike(e, stat, dist);
          }
        }
      }
      const gy = terrainHeight(e.x, e.z) + (stat.hover ? 1.25 + Math.sin(this.play * 2 + e.hx) * 0.2 : 0);
      e.y += (gy - e.y) * Math.min(1, dt * 6);
      if (dist < stat.r + 0.45 && p.iFrame <= 0 && e.arch !== "trainer") {
        const push = stat.r + 0.5;
        const d = dist || 0.001;
        p.x += ((p.x - e.x) / d) * (push - d) * 0.5;
        p.z += ((p.z - e.z) / d) * (push - d) * 0.5;
      }
    }
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const need = ARCH[a.arch].r + ARCH[b.arch].r;
        if (d < need && d > 0.001) {
          const push = (need - d) * 0.5;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    }
  }

  private stepThief(e: RuntimeEnemy, dt: number): void {
    const path = e.path.length ? e.path : [{ x: e.hx, z: e.hz }];
    const target = path[e.pathI % path.length];
    this.moveEnemy(e, target.x, target.z, ARCH.thief.speed, dt);
    if (Math.hypot(e.x - target.x, e.z - target.z) < 1) e.pathI += 1;
  }

  private moveEnemy(e: RuntimeEnemy, tx: number, tz: number, speed: number, dt: number): void {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * speed * dt;
    e.z += (dz / d) * speed * dt;
    e.yaw = dampAngle(e.yaw, yawFromDir(dx, dz), 8, dt);
  }

  private enemyStrike(e: RuntimeEnemy, stat: ArchStat, dist: number): void {
    const p = this.player;
    if (stat.range > 4) {
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      this.shots.push({
        x: e.x, y: e.y + 1.3, z: e.z, vx: (dx / d) * (e.arch === "mage" ? 9 : 16), vz: (dz / d) * (e.arch === "mage" ? 9 : 16),
        vy: 0, life: 2.2, dmg: stat.dmg, team: "e", r: e.arch === "mage" ? 0.55 : 0.28,
      });
      return;
    }
    const rad = e.slam ? 4.4 : stat.range + 0.3;
    if (dist <= rad) {
      if (p.parryT > 0 && !e.slam) {
        e.stagger = 0.85;
        p.parryT = 0;
        p.energy = Math.min(p.maxEnergy, p.energy + 12);
        this.parries += 1;
        this.cam.shake = 0.22;
        this.audio.hit();
        this.onAdvance(applyEvent(this.quests, { type: "parry" }, this.inv, [...this.discovered]));
        this.toast("صدّ", "Parry");
        return;
      }
      if (p.iFrame > 0) return;
      const mit = armorMitigation(itemDef(this.armor).armor);
      const raw = e.slam ? stat.dmg * 1.45 : stat.dmg;
      this.hurt(raw * (1 - mit), false);
    }
  }

  private stepShots(dt: number): void {
    const p = this.player;
    for (const s of this.shots) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.y += s.vy * dt;
      if (s.team === "e" && s.life > 0 && Math.hypot(s.x - p.x, s.z - p.z) < 0.7 && Math.abs(s.y - (p.y + 1)) < 1.2) {
        s.life = 0;
        if (p.parryT > 0) {
          p.parryT = 0;
          this.parries += 1;
          this.toast("صدّ السهم", "Arrow parried");
          this.onAdvance(applyEvent(this.quests, { type: "parry" }, this.inv, [...this.discovered]));
        } else if (p.iFrame <= 0) {
          const mit = armorMitigation(itemDef(this.armor).armor);
          this.hurt(s.dmg * (1 - mit), false);
        }
      }
      if (s.team === "p") {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(s.x - e.x, s.z - e.z) < ARCH[e.arch].r + s.r) {
            s.life = 0;
            this.damageEnemy(e, s.dmg, false);
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private hurt(amount: number, ignoreI: boolean): void {
    const p = this.player;
    if (!ignoreI && p.iFrame > 0) return;
    const dmg = Math.max(1, Math.round(amount));
    p.hp -= dmg;
    p.hurtT = 0.35;
    if (!ignoreI) p.iFrame = 0.45;
    this.cam.shake = Math.max(this.cam.shake, 0.3);
    this.audio.hurt();
    this.notes.push({ x: p.x, y: p.y + 1.8, z: p.z, text: `-${dmg}`, life: 0.6 });
  }

  private die(): void {
    this.phase = "dead";
    this.deadT = 1.7;
    this.deaths += 1;
    this.panel = "none";
    this.dialogue = null;
    this.poke(true);
  }

  private respawn(): void {
    const p = this.player;
    p.x = this.spawn.x;
    p.z = this.spawn.z;
    p.y = terrainHeight(p.x, p.z) + 0.1;
    p.vx = p.vy = p.vz = 0;
    this.recompute();
    p.hp = Math.round(p.maxHp * 0.65);
    p.energy = p.maxEnergy;
    p.grapple = null;
    p.climbing = false;
    this.phase = "play";
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hp = e.maxHp;
      e.x = e.hx;
      e.z = e.hz;
      e.ai = "wander";
      e.phase = 1;
    }
    this.toast("عدت إلى آخر مسلة", "Returned to the last obelisk");
    this.poke(true);
  }

  private scanNear(): void {
    const p = this.player;
    let best: Obj | null = null;
    let bestD = 2.4;
    for (const o of this.objects) {
      if (o.used && o.kind !== "travel" && o.kind !== "shop" && o.kind !== "craft" && o.kind !== "puzzle" && o.kind !== "well" && o.kind !== "spring") continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    for (const n of this.npcSpots()) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { id: `npc:${n.id}`, tag: "npc", x: n.x, z: n.z, y: 0, r: 2, ar: n.ar, en: n.en, kind: "talk", npc: n.id, used: false };
      }
    }
    this.nearId = best?.id ?? null;
    this.hintAr = best ? `${best.ar} — E` : "";
    this.hintEn = best ? `${best.en} — E` : "";
  }

  npcSpots() {
    return [
      { id: "layla", ar: "ليلى", en: "Layla", x: 0, z: 16 },
      { id: "sakhr", ar: "صخر", en: "Sakhr", x: 14, z: -2 },
      { id: "cook", ar: "الطبّاخ", en: "Cook", x: -14, z: -2 },
      { id: "trainer", ar: "وقف", en: "Waqf", x: -22, z: 14 },
      { id: "nahr", ar: "نهر", en: "Nahr", x: -16, z: 204 },
      { id: "hermit", ar: "الناسك", en: "Hermit", x: 198, z: 16 },
      { id: "survivor", ar: "سنا", en: "Sana", x: -16, z: -190 },
      { id: "smith", ar: "جمر", en: "Jamr", x: 34, z: -194 },
      { id: "archivist", ar: "ترس", en: "Tirs", x: -230, z: -6 },
      { id: "echo", ar: "الصدى", en: "Echo", x: 176, z: 198 },
    ];
  }

  private tryInteract(): void {
    if (!this.nearId) return;
    if (this.nearId.startsWith("npc:")) {
      this.openDialogue(this.nearId.slice(4));
      return;
    }
    const o = this.objects.find((x) => x.id === this.nearId);
    if (!o || o.used && o.kind === "once") return;
    if (o.kind === "talk" && o.npc) this.openDialogue(o.npc);
    else if (o.kind === "travel") {
      this.panel = "map";
      this.poke(true);
    } else if (o.kind === "craft") {
      this.panel = "craft";
      this.poke(true);
    } else if (o.kind === "shop") {
      this.panel = "shop";
      this.poke(true);
    } else if (o.kind === "note" && o.ref && NOTES[o.ref]) {
      this.note = NOTES[o.ref];
      this.markOnce(o);
      this.poke(true);
    } else if (o.kind === "puzzle" && o.ref) this.touchPuzzle(o);
    else if (o.kind === "well") this.touchWell(o);
    else if (o.kind === "spring") this.touchSpring(o);
    else if (o.tag === "ending") this.offerEnding();
    else if (o.kind === "pickup") this.pickup(o);
    else if (o.kind === "once") this.markOnce(o);
    this.audio.blip();
  }

  private markOnce(o: Obj): void {
    if (o.used) return;
    o.used = true;
    if (o.tag === "echo") {
      if (this.quests.s_echoes?.status === "locked") startQuest(this.quests, "s_echoes");
    }
    this.onAdvance(applyEvent(this.quests, { type: "interact", tag: o.tag, id: o.id }, this.inv, [...this.discovered]));
    this.toast(o.ar, o.en);
  }

  private pickup(o: Obj): void {
    if (o.used) return;
    o.used = true;
    if (o.item) this.addItem(o.item, 1);
    if (o.tag === "bell") this.flags.bell = 1;
    this.onAdvance(applyEvent(this.quests, { type: "interact", tag: o.tag, id: o.id }, this.inv, [...this.discovered]));
    this.onAdvance(syncHave(this.quests, this.inv));
    this.toast(o.ar, o.en);
  }

  private touchPuzzle(o: Obj): void {
    const [kind, idxS] = (o.ref ?? "").split(":");
    const idx = Number(idxS);
    if (kind === "mirror") {
      if (this.mirrorSolved) {
        this.toast("المرايا هادئة", "The mirrors are still");
        return;
      }
      const expect = [0, 2, 1];
      const step = this.mirrorOrder.length;
      if (idx === expect[step]) {
        this.mirrorOrder.push(idx);
        this.toast("المرآة قبلت اللمس", "The mirror accepts");
        if (this.mirrorOrder.length === 3) {
          this.mirrorSolved = true;
          this.onAdvance(applyEvent(this.quests, { type: "puzzle", id: "mirrors" }, this.inv, [...this.discovered]));
          this.toast("انفتح البئر", "The well opens");
        }
      } else {
        this.mirrorOrder = [];
        this.toast("الترتيب انكسر", "The order breaks");
      }
    } else if (kind === "gear") {
      if (this.gearSolved) return;
      this.gears[idx] = (this.gears[idx] + 1) % 3;
      const names = ["قمر", "نار", "نخلة"];
      this.toast(names[this.gears[idx]] ?? "", ["Moon", "Fire", "Palm"][this.gears[idx]] ?? "");
      if (this.gears[0] === 2 && this.gears[1] === 0 && this.gears[2] === 1) {
        this.gearSolved = true;
        this.onAdvance(applyEvent(this.quests, { type: "puzzle", id: "gears" }, this.inv, [...this.discovered]));
        this.toast("التروس تذكّرت", "The gears remember");
      }
    }
    this.poke(true);
  }

  private touchWell(o: Obj): void {
    if (!this.mirrorSolved) {
      this.toast("البئر مقفل بالمرايا", "The well is locked by the mirrors");
      return;
    }
    if (!o.used) {
      o.used = true;
      this.onAdvance(applyEvent(this.quests, { type: "interact", tag: "well", id: o.id }, this.inv, [...this.discovered]));
    }
  }

  private offerEnding(): void {
    const boss = this.enemies.find((e) => e.id === "moon");
    if (boss?.alive) {
      this.toast("ذو القمرين لم يسقط بعد", "The Two-Mooned still stands");
      return;
    }
    this.endingOffer = true;
    this.poke(true);
  }

  private touchSpring(o: Obj): void {
    const boss = this.enemies.find((e) => e.id === "bloom");
    if (boss?.alive) {
      this.toast("الزهر ما زال يسدّ الماء", "The bloom still chokes the water");
      return;
    }
    if (!o.used) {
      o.used = true;
      this.onAdvance(applyEvent(this.quests, { type: "interact", tag: "spring", id: o.id }, this.inv, [...this.discovered]));
    }
  }

  openDialogue(id: string): void {
    if (!DIALOGUES[id]) return;
    this.dialogue = { npc: id, node: "start" };
    this.onAdvance(applyEvent(this.quests, { type: "talk", npc: id }, this.inv, [...this.discovered]));
    this.audio.blip();
    this.poke(true);
  }

  choose(index: number): void {
    if (!this.dialogue) return;
    const node = DIALOGUES[this.dialogue.npc]?.[this.dialogue.node];
    const choice = node?.choices[index];
    if (!choice) return;
    if (choice.act?.startsWith("quest:")) {
      const id = choice.act.slice(6);
      if (startQuest(this.quests, id)) {
        const def = questDef(id);
        this.toast(def.ar, def.en);
        if (id === "s_map") this.quests.s_map.counts.discover = this.discovered.size;
      }
    } else if (choice.act === "shop") {
      this.dialogue = null;
      this.panel = "shop";
    } else if (choice.act === "craft") {
      this.dialogue = null;
      this.panel = "craft";
    } else if (choice.act === "heal") {
      this.player.hp = this.player.maxHp;
      this.toast("النفس عاد", "Breath returns");
    } else if (choice.act === "travel") {
      this.dialogue = null;
      this.panel = "map";
    }
    this.onAdvance(syncHave(this.quests, this.inv));
    if (choice.next && DIALOGUES[this.dialogue?.npc ?? ""]?.[choice.next]) {
      if (this.dialogue) this.dialogue.node = choice.next;
    } else if (choice.act !== "shop" && choice.act !== "craft" && choice.act !== "travel") {
      this.dialogue = null;
    }
    this.poke(true);
  }

  closeNote(): void {
    this.note = null;
    this.poke(true);
  }

  private scanReach(): void {
    const p = this.player;
    this.onAdvance(markReach(this.quests, p.x, p.y, p.z, this.inv, [...this.discovered]));
  }

  private scanDiscover(): void {
    const id = kingdomAt(this.player.x, this.player.z);
    const infoDist = Math.hypot(this.player.x - (id === "sand" ? 0 : 0), 0);
    void infoDist;
    const centers: Record<string, [number, number, number]> = {
      sand: [0, 0, 70], life: [0, 230, 55], frost: [250, 24, 55], ash: [16, -240, 55], lost: [-250, 8, 50], twilight: [230, 230, 48],
    };
    const c = centers[id];
    if (!c) return;
    if (Math.hypot(this.player.x - c[0], this.player.z - c[1]) > c[2]) return;
    if (this.discovered.has(id)) return;
    this.discovered.add(id);
    if (this.discovered.size >= 2 && this.quests.s_map?.status === "locked") startQuest(this.quests, "s_map");
    if (this.quests.s_map?.status === "active") this.quests.s_map.counts.discover = this.discovered.size;
    const names: Record<string, [string, string]> = {
      sand: ["مدينة الرمال", "City of Sands"],
      life: ["وادي الحياة", "Valley of Life"],
      frost: ["جبال الصقيع", "Frost Peaks"],
      ash: ["أرض الرماد", "Ashlands"],
      lost: ["المدينة المفقودة", "Lost City"],
      twilight: ["مملكة الشفق", "Twilight Kingdom"],
    };
    this.toast(`بلغت ${names[id][0]}`, `Reached ${names[id][1]}`);
    this.spawn = { x: this.player.x, z: this.player.z };
    this.onAdvance(applyEvent(this.quests, { type: "discover", kingdom: id }, this.inv, [...this.discovered]));
  }

  private onAdvance(adv: QuestAdvance): void {
    for (const id of adv.completed) this.finishQuest(id);
    if (adv.completed.length || adv.started.length || adv.advanced.length) this.poke(true);
  }

  private finishQuest(id: string): void {
    const def = QUESTS.find((q) => q.id === id);
    if (!def) return;
    for (const item of def.items ?? []) this.addItem(item, 1);
    this.motes += def.motes;
    this.grantXp(def.xp);
    if (id === "s_glider") this.hasGlider = true;
    if (id === "s_shrines") this.shrine += 25;
    if (id === "s_cook") {
      this.inv.pepper = Math.max(0, (this.inv.pepper ?? 0) - 1);
      this.inv.fruit = Math.max(0, (this.inv.fruit ?? 0) - 1);
    }
    if (id === "s_survivor") this.inv.flask = Math.max(0, (this.inv.flask ?? 0) - 1);
    if (id === "q_twilight") {
      /* choice still required via objective; rewards fire when fully done */
    }
    this.recompute();
    this.toast(`أُنجزت: ${def.ar}`, `Done: ${def.en}`);
    if (id === "q_lost") this.toast("انفتح ختم الشفق", "The twilight seal opens");
    this.save();
  }

  addItem(id: string, n: number): void {
    this.inv[id] = (this.inv[id] ?? 0) + n;
    this.onAdvance(syncHave(this.quests, this.inv));
  }

  grantXp(n: number): void {
    this.xp += n;
    let leveled = false;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level += 1;
      this.points += 1;
      leveled = true;
    }
    if (leveled) {
      this.recompute();
      this.player.hp = this.player.maxHp;
      this.toast(`بلغت المستوى ${this.level}`, `Reached level ${this.level}`);
    }
  }

  recompute(): void {
    const vit = this.skills.vit ?? 0;
    const maxHp = 100 + (this.level - 1) * 8 + vit * 24;
    const maxEnergy = 100 + (this.skills.breath ?? 0) * 12 + this.shrine;
    this.player.maxHp = maxHp;
    this.player.maxEnergy = maxEnergy;
    this.player.hp = clamp(this.player.hp, 0, maxHp);
    this.player.energy = clamp(this.player.energy, 0, maxEnergy);
  }

  buySkill(id: string): void {
    const def = { vit: 3, sand: 3, bolt: 3, wind: 3, edge: 3, breath: 2, wing: 2, hook: 2, guard: 2 }[id];
    if (!def || this.points <= 0) return;
    const cur = this.skills[id] ?? 0;
    if (cur >= def) return;
    this.skills[id] = cur + 1;
    this.points -= 1;
    this.recompute();
    if (id === "vit") this.player.hp = this.player.maxHp;
    this.audio.blip();
    this.poke(true);
  }

  equip(id: string): void {
    const it = itemDef(id);
    if ((this.inv[id] ?? 0) <= 0) return;
    if (it.kind === "weapon") this.weapon = id;
    if (it.kind === "armor") this.armor = id;
    if (it.kind === "consume") {
      this.inv[id] -= 1;
      if (it.heal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + it.heal);
      if (it.buff) this.buffT = Math.max(this.buffT, it.buff);
      if (id === "bomb") this.useBomb();
    }
    this.audio.blip();
    this.poke(true);
  }

  buy(id: string): void {
    const offer = SHOP.find((s) => s.item === id);
    if (!offer || !canPay(this.motes, offer.price)) {
      this.toast("الشظايا لا تكفي", "Not enough motes");
      return;
    }
    this.motes -= offer.price;
    this.addItem(id, 1);
    this.audio.blip();
    this.poke(true);
  }

  craft(id: string): void {
    const rec = RECIPES.find((r) => r.id === id);
    if (!rec || !recipeReady(this.inv, rec.inputs)) {
      this.toast("المواد ناقصة", "Missing materials");
      return;
    }
    for (const [k, n] of Object.entries(rec.inputs)) this.inv[k] = (this.inv[k] ?? 0) - n;
    this.addItem(rec.output, rec.count);
    this.toast(rec.ar, rec.en);
    this.poke(true);
  }

  travelTo(id: string): void {
    if (!this.discovered.has(id)) return;
    const spots: Record<string, [number, number]> = {
      sand: [0, 34], life: [-8, 196], frost: [206, 18], ash: [16, -170], lost: [-190, 4], twilight: [176, 200],
    };
    const s = spots[id];
    if (!s) return;
    if (id === "twilight" && this.crystalCount() < 5) {
      this.toast("الختم ما زال مقفلًا", "The seal is still shut");
      return;
    }
    this.player.x = s[0];
    this.player.z = s[1];
    this.player.y = terrainHeight(s[0], s[1]) + 0.2;
    this.player.vx = this.player.vy = this.player.vz = 0;
    this.spawn = { x: s[0], z: s[1] };
    this.panel = "none";
    this.cam.x = s[0];
    this.cam.z = s[1] + 8;
    this.save();
    this.poke(true);
  }

  chooseEnding(kind: "seal" | "share"): void {
    const boss = this.enemies.find((e) => e.id === "moon");
    if (boss?.alive) {
      this.toast("ذو القمرين لم يسقط", "The Two-Mooned still stands");
      return;
    }
    this.ending = kind;
    this.endingOffer = false;
    const throne = this.objects.find((o) => o.id === "end1");
    if (throne && !throne.used) {
      throne.used = true;
      this.onAdvance(applyEvent(this.quests, { type: "interact", tag: "ending", id: throne.id }, this.inv, [...this.discovered]));
    }
    this.phase = "ending";
    this.panel = "none";
    this.dialogue = null;
    this.save();
    this.poke(true);
  }

  closePanel(): void {
    this.panel = "none";
    this.poke(true);
  }

  setLang(lang: Lang): void {
    this.settings.lang = lang;
    this.saveSettings();
  }

  activeQuestText(): { title: string; obj: string } | null {
    const main = QUESTS.find((q) => q.kind === "main" && this.quests[q.id]?.status === "active");
    const def = main ?? QUESTS.find((q) => this.quests[q.id]?.status === "active");
    if (!def) return null;
    const prog = this.quests[def.id];
    const obj = def.objectives[prog.step];
    if (!obj) return { title: this.t(def.ar, def.en), obj: "" };
    return { title: this.t(def.ar, def.en), obj: this.t(obj.ar, obj.en) };
  }

  weather(): "clear" | "sand" | "rain" | "snow" | "ash" {
    const k = kingdomAt(this.player.x, this.player.z);
    if (k === "frost") return "snow";
    if (k === "life") return Math.sin(this.time) > 0.2 ? "rain" : "clear";
    if (k === "ash") return "ash";
    if (k === "sand" && Math.sin(this.play * 0.05) > 0.65) return "sand";
    return "clear";
  }

  sunDir(): [number, number, number] {
    const ang = ((this.time - 6) / 24) * Math.PI * 2;
    const y = Math.sin(ang) * 0.85 + 0.08;
    const x = Math.cos(ang);
    return [x, Math.max(0.08, y), 0.35];
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
    __kot?: { sim: GameSim };
  }
}

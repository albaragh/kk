import { create } from "zustand";
import { bridge } from "./bridge";
import {
  CARS,
  defaultUpgrades,
  defaultVisual,
  getCar,
  UPGRADE_COST,
  type UpgradeKey,
} from "./cars";
import { enterDrive, enterGarage, enterRace, enterTitle, refreshPlayer, sim } from "./sim";
import type { Lang, RaceResult, Screen, Settings, Upgrades, Visual } from "./types";
import { CHAMPIONSHIP, RACES } from "./world";

const KEY = "midnight-rush-v1";

export type SaveData = {
  version: 1;
  lang: Lang;
  credits: number;
  owned: string[];
  selected: string;
  upgrades: Record<string, Upgrades>;
  visuals: Record<string, Visual>;
  best: Record<string, number>;
  wins: number;
  races: number;
  distance: number;
  championshipRound: number;
  settings: Settings;
};

function fresh(): SaveData {
  const selected = "afaq-sedan";
  const car = getCar(selected);
  return {
    version: 1,
    lang: "ar",
    credits: 1200,
    owned: [selected],
    selected,
    upgrades: { [selected]: defaultUpgrades() },
    visuals: { [selected]: defaultVisual(car) },
    best: {},
    wins: 0,
    races: 0,
    distance: 0,
    championshipRound: 0,
    settings: {
      quality: "high",
      volume: 0.65,
      assist: 0.28,
      camera: "chase",
      rain: false,
      time: "night",
      cycle: false,
      touch: false,
      tilt: false,
    },
  };
}

function persist(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

function num(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function level(v: unknown, max: number) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.min(max, Math.max(0, n));
}

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return fresh();
    const base = fresh();
    const known = new Set(CARS.map((c) => c.id));
    const ownedRaw = Array.isArray(parsed.owned)
      ? parsed.owned.filter((id): id is string => typeof id === "string" && known.has(id))
      : [];
    const owned = ownedRaw.length > 0 ? ownedRaw : [base.selected];
    const selected = typeof parsed.selected === "string" && owned.includes(parsed.selected) ? parsed.selected : owned[0]!;
    if (!owned.includes(base.selected)) owned.unshift(base.selected);
    const upgrades: Record<string, Upgrades> = {};
    const visuals: Record<string, Visual> = {};
    for (const id of owned) {
      const rawU = parsed.upgrades?.[id];
      upgrades[id] = {
        engine: level(rawU?.engine, UPGRADE_COST.engine.length),
        brakes: level(rawU?.brakes, UPGRADE_COST.brakes.length),
        suspension: level(rawU?.suspension, UPGRADE_COST.suspension.length),
        gearbox: level(rawU?.gearbox, UPGRADE_COST.gearbox.length),
        turbo: level(rawU?.turbo, UPGRADE_COST.turbo.length),
      };
      const car = getCar(id);
      const dv = defaultVisual(car);
      const vis = parsed.visuals?.[id];
      visuals[id] = {
        paint: typeof vis?.paint === "string" ? vis.paint : dv.paint,
        wheels: level(vis?.wheels, 2),
        spoiler: typeof vis?.spoiler === "boolean" ? vis.spoiler : dv.spoiler,
        ride: num(vis?.ride, 0, -0.08, 0.16),
        glow: typeof vis?.glow === "string" ? vis.glow : dv.glow,
        bumper: num(vis?.bumper, 0, 0, 1),
      };
    }
    const raceIds = new Set(RACES.map((r) => r.id));
    const best: Record<string, number> = {};
    if (parsed.best && typeof parsed.best === "object") {
      for (const [id, value] of Object.entries(parsed.best)) {
        if (raceIds.has(id) && typeof value === "number" && Number.isFinite(value) && value > 0) best[id] = value;
      }
    }
    const incoming: Partial<Settings> = parsed.settings ?? {};
    const settings: Settings = {
      ...base.settings,
      quality: incoming.quality === "low" || incoming.quality === "med" || incoming.quality === "high" ? incoming.quality : base.settings.quality,
      camera: incoming.camera === "hood" || incoming.camera === "bumper" || incoming.camera === "chase" ? incoming.camera : base.settings.camera,
      time: incoming.time === "dawn" || incoming.time === "day" || incoming.time === "dusk" || incoming.time === "night" ? incoming.time : base.settings.time,
      volume: num(incoming.volume, base.settings.volume, 0, 1),
      assist: num(incoming.assist, base.settings.assist, 0, 1),
      rain: typeof incoming.rain === "boolean" ? incoming.rain : base.settings.rain,
      cycle: typeof incoming.cycle === "boolean" ? incoming.cycle : base.settings.cycle,
      touch: typeof incoming.touch === "boolean" ? incoming.touch : base.settings.touch,
      tilt: typeof incoming.tilt === "boolean" ? incoming.tilt : base.settings.tilt,
    };
    return {
      version: 1,
      lang: parsed.lang === "en" ? "en" : "ar",
      credits: num(parsed.credits, base.credits, 0, 1e9),
      owned,
      selected,
      upgrades,
      visuals,
      best,
      wins: Math.floor(num(parsed.wins, 0, 0, 1e6)),
      races: Math.floor(num(parsed.races, 0, 0, 1e6)),
      distance: num(parsed.distance, 0, 0, 1e9),
      championshipRound: Math.floor(num(parsed.championshipRound, 0, 0, CHAMPIONSHIP.length)),
      settings,
    };
  } catch {
    return fresh();
  }
}

type GameStore = SaveData & {
  screen: Screen;
  returnTo: Screen;
  lastResult: RaceResult | null;
  notice: string;
  epoch: number;
  hydrated: boolean;
  hydrate: () => void;
  setLang: (lang: Lang) => void;
  patchSettings: (partial: Partial<Settings>) => void;
  selectCar: (id: string) => void;
  buy: (id: string) => boolean;
  upgrade: (key: UpgradeKey) => boolean;
  setPaint: (paint: string) => void;
  setGlow: (glow: string) => void;
  setWheels: (wheels: number) => void;
  toggleSpoiler: () => void;
  setRide: (ride: number) => void;
  setBumper: (bumper: number) => void;
  open: (screen: Screen) => void;
  startDrive: () => void;
  startGarage: () => void;
  startRace: (id: string, championship?: boolean) => void;
  startChampionship: () => void;
  pause: () => void;
  resume: () => void;
  finishRace: (result: RaceResult) => void;
  backTitle: () => void;
};

function snapshot(s: GameStore): SaveData {
  return {
    version: 1,
    lang: s.lang,
    credits: s.credits,
    owned: s.owned,
    selected: s.selected,
    upgrades: s.upgrades,
    visuals: s.visuals,
    best: s.best,
    wins: s.wins,
    races: s.races,
    distance: s.distance,
    championshipRound: s.championshipRound,
    settings: s.settings,
  };
}

export const useGame = create<GameStore>((set, get) => ({
  ...fresh(),
  screen: "title",
  returnTo: "title",
  lastResult: null,
  notice: "",
  epoch: 0,
  hydrated: false,
  hydrate: () => {
    const data = read();
    if (typeof window !== "undefined" && !localStorage.getItem(KEY) && window.matchMedia("(pointer: coarse)").matches) {
      data.settings.quality = "low";
      data.settings.touch = true;
    }
    set({ ...data, hydrated: true });
    document.documentElement.lang = data.lang;
    document.documentElement.dir = data.lang === "ar" ? "rtl" : "ltr";
  },
  setLang: (lang) => {
    set({ lang });
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    persist(snapshot(get()));
  },
  patchSettings: (partial) => {
    set({ settings: { ...get().settings, ...partial } });
    persist(snapshot(get()));
    refreshPlayer();
  },
  selectCar: (id) => {
    if (!get().owned.includes(id)) return;
    set({ selected: id });
    persist(snapshot(get()));
    refreshPlayer();
    set({ epoch: get().epoch + 1 });
  },
  buy: (id) => {
    const s = get();
    if (s.owned.includes(id)) {
      s.selectCar(id);
      return true;
    }
    const car = CARS.find((c) => c.id === id);
    if (!car || s.credits < car.price) {
      set({ notice: "notEnough" });
      return false;
    }
    set({
      credits: s.credits - car.price,
      owned: [...s.owned, id],
      selected: id,
      upgrades: { ...s.upgrades, [id]: s.upgrades[id] ?? defaultUpgrades() },
      visuals: { ...s.visuals, [id]: s.visuals[id] ?? defaultVisual(car) },
      notice: "",
      epoch: s.epoch + 1,
    });
    persist(snapshot(get()));
    refreshPlayer();
    return true;
  },
  upgrade: (key) => {
    const s = get();
    const id = s.selected;
    const current = s.upgrades[id] ?? defaultUpgrades();
    const level = current[key];
    const table = UPGRADE_COST[key];
    if (level >= table.length) return false;
    const cost = table[level]!;
    if (s.credits < cost) {
      set({ notice: "notEnough" });
      return false;
    }
    const next = { ...current, [key]: level + 1 };
    set({
      credits: s.credits - cost,
      upgrades: { ...s.upgrades, [id]: next },
      notice: "",
    });
    persist(snapshot(get()));
    refreshPlayer();
    return true;
  },
  setPaint: (paint) => {
    const s = get();
    const visual = { ...(s.visuals[s.selected] ?? defaultVisual(getCar(s.selected))), paint };
    set({ visuals: { ...s.visuals, [s.selected]: visual }, epoch: s.epoch + 1 });
    persist(snapshot(get()));
    refreshPlayer();
  },
  setGlow: (glow) => {
    const s = get();
    const visual = { ...(s.visuals[s.selected] ?? defaultVisual(getCar(s.selected))), glow };
    set({ visuals: { ...s.visuals, [s.selected]: visual }, epoch: s.epoch + 1 });
    persist(snapshot(get()));
    refreshPlayer();
  },
  setWheels: (wheels) => {
    const s = get();
    const visual = { ...(s.visuals[s.selected] ?? defaultVisual(getCar(s.selected))), wheels };
    set({ visuals: { ...s.visuals, [s.selected]: visual }, epoch: s.epoch + 1 });
    persist(snapshot(get()));
    refreshPlayer();
  },
  toggleSpoiler: () => {
    const s = get();
    const prev = s.visuals[s.selected] ?? defaultVisual(getCar(s.selected));
    const visual = { ...prev, spoiler: !prev.spoiler };
    set({ visuals: { ...s.visuals, [s.selected]: visual }, epoch: s.epoch + 1 });
    persist(snapshot(get()));
    refreshPlayer();
  },
  setRide: (ride) => {
    const s = get();
    const visual = { ...(s.visuals[s.selected] ?? defaultVisual(getCar(s.selected))), ride };
    set({ visuals: { ...s.visuals, [s.selected]: visual } });
    persist(snapshot(get()));
    refreshPlayer();
  },
  setBumper: (bumper) => {
    const s = get();
    const visual = { ...(s.visuals[s.selected] ?? defaultVisual(getCar(s.selected))), bumper };
    set({ visuals: { ...s.visuals, [s.selected]: visual }, epoch: s.epoch + 1 });
    persist(snapshot(get()));
    refreshPlayer();
  },
  open: (screen) => {
    const cur = get().screen;
    if (cur === "drive") sim.mode = "pause";
    set({ screen, returnTo: cur === "drive" ? "drive" : get().returnTo });
  },
  startDrive: () => {
    set({ screen: "drive", notice: "" });
    enterDrive();
  },
  startGarage: () => {
    const racing = !!(sim.race && !sim.race.reported);
    const fromDrive = get().screen === "pause" || get().screen === "drive" || get().returnTo === "drive";
    set({ screen: "garage", notice: "", returnTo: racing ? "title" : fromDrive ? "drive" : "title" });
    enterGarage();
  },
  startRace: (id, championship = false) => {
    set({ screen: "drive", notice: "" });
    enterRace(id, championship);
  },
  startChampionship: () => {
    const round = get().championshipRound;
    if (round >= CHAMPIONSHIP.length) {
      const id = CHAMPIONSHIP[CHAMPIONSHIP.length - 1] ?? CHAMPIONSHIP[0]!;
      get().startRace(id, false);
      return;
    }
    const id = CHAMPIONSHIP[round] ?? CHAMPIONSHIP[0]!;
    get().startRace(id, true);
  },
  pause: () => {
    if (get().screen !== "drive") return;
    flushDistance();
    sim.mode = "pause";
    set({ screen: "pause", returnTo: "drive" });
  },
  resume: () => {
    if (sim.race && sim.race.reported) return;
    sim.mode = "drive";
    set({ screen: "drive" });
  },
  finishRace: (result) => {
    flushDistance();
    const s = get();
    const prev = s.best[result.raceId];
    const value = result.higherBetter ? result.score : result.time;
    const eligible = !result.busted && value > 0;
    const better =
      eligible &&
      (prev == null || (result.higherBetter ? value > prev : value < prev));
    const best = better ? { ...s.best, [result.raceId]: value } : s.best;
    let round = s.championshipRound;
    if (result.championship && result.place <= 3 && !result.busted) {
      round = Math.min(CHAMPIONSHIP.length, round + 1);
    }
    const credits = Math.max(0, s.credits + result.reward);
    const next = {
      credits,
      best,
      wins: s.wins + (result.place === 1 && !result.busted ? 1 : 0),
      races: s.races + 1,
      championshipRound: round,
      lastResult: { ...result, record: better },
      screen: "results" as Screen,
    };
    set(next);
    persist(snapshot(get()));
  },
  backTitle: () => {
    flushDistance();
    set({ screen: "title" });
    enterTitle();
  },
}));

function flushDistance() {
  if (sim.distancePending <= 0) return;
  const meters = sim.distancePending;
  sim.distancePending = 0;
  const distance = useGame.getState().distance + meters;
  useGame.setState({ distance });
  persist(snapshot(useGame.getState()));
}

bridge.finish = (result) => useGame.getState().finishRace(result);
bridge.getSetup = () => {
  const s = useGame.getState();
  const car = getCar(s.selected);
  return {
    carId: s.selected,
    upgrades: s.upgrades[s.selected] ?? defaultUpgrades(),
    visual: s.visuals[s.selected] ?? defaultVisual(car),
    settings: s.settings,
    lang: s.lang,
  };
};
bridge.addDistance = (meters) => {
  if (!(meters > 0)) return;
  const distance = useGame.getState().distance + meters;
  useGame.setState({ distance });
  persist(snapshot(useGame.getState()));
};
bridge.bump = () => useGame.setState((s) => ({ epoch: s.epoch + 1 }));

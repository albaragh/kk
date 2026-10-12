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
import { CHAMPIONSHIP } from "./world";

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

function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1 || !parsed.selected || !Array.isArray(parsed.owned)) return fresh();
    return { ...fresh(), ...parsed, settings: { ...fresh().settings, ...parsed.settings } };
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
    set({ screen: "garage", notice: "" });
    enterGarage();
  },
  startRace: (id, championship = false) => {
    set({ screen: "drive", notice: "" });
    enterRace(id, championship);
  },
  startChampionship: () => {
    const round = Math.min(get().championshipRound, CHAMPIONSHIP.length - 1);
    const id = CHAMPIONSHIP[round] ?? CHAMPIONSHIP[0]!;
    get().startRace(id, true);
  },
  pause: () => {
    if (get().screen !== "drive") return;
    sim.mode = "pause";
    set({ screen: "pause", returnTo: "drive" });
  },
  resume: () => {
    if (sim.race && sim.race.reported) return;
    sim.mode = "drive";
    set({ screen: "drive" });
  },
  finishRace: (result) => {
    const s = get();
    const prev = s.best[result.raceId];
    const value = result.higherBetter ? result.score : result.time;
    const better =
      prev == null
        ? true
        : result.higherBetter
          ? value > prev
          : value < prev && value > 0;
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
    set({ screen: "title" });
    enterTitle();
  },
}));

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
  useGame.setState({ distance: useGame.getState().distance + meters });
};
bridge.bump = () => useGame.setState((s) => ({ epoch: s.epoch + 1 }));

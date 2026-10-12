import type { RaceResult, Settings, Upgrades, Visual } from "./types";

export type Setup = {
  carId: string;
  upgrades: Upgrades;
  visual: Visual;
  settings: Settings;
  lang: "ar" | "en";
};

export const bridge = {
  finish: (_result: RaceResult) => {},
  getSetup: (): Setup => {
    throw new Error("bridge not ready");
  },
  addDistance: (_meters: number) => {},
  bump: () => {},
};

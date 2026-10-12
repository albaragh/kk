export type Lang = "ar" | "en";
export type CarClass = "sedan" | "sport" | "suv" | "super";
export type DriveType = "FWD" | "RWD" | "AWD";
export type Surface = "asphalt" | "wet" | "sand" | "dirt" | "concrete" | "water";
export type Quality = "low" | "med" | "high";
export type CameraMode = "chase" | "hood" | "bumper";
export type TimePreset = "night" | "dawn" | "day" | "dusk";
export type RaceKind = "street" | "time" | "drift" | "highway" | "police";
export type Screen =
  | "title"
  | "garage"
  | "races"
  | "map"
  | "settings"
  | "drive"
  | "pause"
  | "results";

export type Upgrades = {
  engine: number;
  brakes: number;
  suspension: number;
  gearbox: number;
  turbo: number;
};

export type Visual = {
  paint: string;
  wheels: number;
  spoiler: boolean;
  ride: number;
  glow: string;
  bumper: number;
};

export type Settings = {
  quality: Quality;
  volume: number;
  assist: number;
  camera: CameraMode;
  rain: boolean;
  time: TimePreset;
  cycle: boolean;
  touch: boolean;
  tilt: boolean;
};

export type Gate = { x: number; z: number; yaw: number; halfWidth: number };

export type RaceResult = {
  raceId: string;
  place: number;
  total: number;
  time: number;
  score: number;
  reward: number;
  higherBetter: boolean;
  championship: boolean;
  escaped: boolean;
  busted: boolean;
  record: boolean;
};

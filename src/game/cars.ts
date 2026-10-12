import type { VehicleStats } from "./physics";
import type { CarClass, DriveType, Upgrades, Visual } from "./types";

export type CarDef = {
  id: string;
  nameAr: string;
  nameEn: string;
  cls: CarClass;
  price: number;
  paint: string;
  accent: string;
  length: number;
  width: number;
  height: number;
  cabin: number;
  ride: number;
  wheel: number;
  spoiler: number;
  mass: number;
  power: number;
  top: number;
  brake: number;
  grip: number;
  steer: number;
  drive: DriveType;
};

function car(p: CarDef): CarDef {
  return p;
}

export const CARS: CarDef[] = [
  car({ id: "afaq-sedan", nameAr: "أفق سيدان", nameEn: "Afaq Sedan", cls: "sedan", price: 0, paint: "#d9d3c7", accent: "#e8a317", length: 4.6, width: 1.82, height: 1.42, cabin: 0.48, ride: 0.16, wheel: 0.34, spoiler: 0, mass: 1480, power: 11.2, top: 56, brake: 26, grip: 1.1, steer: 2.05, drive: "FWD" }),
  car({ id: "najd-cruise", nameAr: "نجد كروز", nameEn: "Najd Cruise", cls: "sedan", price: 7500, paint: "#8e9394", accent: "#f4efe6", length: 4.85, width: 1.86, height: 1.46, cabin: 0.5, ride: 0.17, wheel: 0.35, spoiler: 0, mass: 1560, power: 11.8, top: 58, brake: 25, grip: 1.06, steer: 1.95, drive: "FWD" }),
  car({ id: "waha", nameAr: "واحة", nameEn: "Waha", cls: "sedan", price: 9800, paint: "#efe6d2", accent: "#2ec4b6", length: 4.5, width: 1.8, height: 1.4, cabin: 0.46, ride: 0.16, wheel: 0.33, spoiler: 0.05, mass: 1420, power: 12.4, top: 60, brake: 27, grip: 1.08, steer: 2.1, drive: "FWD" }),
  car({ id: "sidra", nameAr: "سدرة", nameEn: "Sidra", cls: "sedan", price: 12000, paint: "#1e2428", accent: "#e8a317", length: 4.7, width: 1.84, height: 1.38, cabin: 0.47, ride: 0.15, wheel: 0.34, spoiler: 0.1, mass: 1500, power: 13.1, top: 62, brake: 28, grip: 1.12, steer: 2.12, drive: "FWD" }),
  car({ id: "reem", nameAr: "ريم", nameEn: "Reem", cls: "sedan", price: 14500, paint: "#6d2e3a", accent: "#f4efe6", length: 4.55, width: 1.83, height: 1.4, cabin: 0.49, ride: 0.16, wheel: 0.34, spoiler: 0, mass: 1460, power: 12.8, top: 61, brake: 27, grip: 1.09, steer: 2.08, drive: "FWD" }),
  car({ id: "layan", nameAr: "ليان", nameEn: "Layan", cls: "sedan", price: 16800, paint: "#243044", accent: "#7eb6ff", length: 4.75, width: 1.88, height: 1.44, cabin: 0.5, ride: 0.17, wheel: 0.35, spoiler: 0.08, mass: 1540, power: 13.4, top: 63, brake: 28, grip: 1.07, steer: 2, drive: "AWD" }),
  car({ id: "darb", nameAr: "درب", nameEn: "Darb", cls: "sedan", price: 11200, paint: "#b7a48a", accent: "#1a1203", length: 4.62, width: 1.8, height: 1.43, cabin: 0.48, ride: 0.18, wheel: 0.34, spoiler: 0, mass: 1490, power: 11.6, top: 57, brake: 26, grip: 1.14, steer: 2.02, drive: "FWD" }),
  car({ id: "muzn", nameAr: "مزن", nameEn: "Muzn", cls: "sedan", price: 18600, paint: "#f4efe6", accent: "#2ec4b6", length: 4.68, width: 1.85, height: 1.39, cabin: 0.46, ride: 0.15, wheel: 0.34, spoiler: 0.12, mass: 1470, power: 14, top: 65, brake: 30, grip: 1.11, steer: 2.14, drive: "FWD" }),

  car({ id: "barq", nameAr: "برق", nameEn: "Barq", cls: "sport", price: 24000, paint: "#e8a317", accent: "#1a1203", length: 4.35, width: 1.9, height: 1.22, cabin: 0.4, ride: 0.12, wheel: 0.34, spoiler: 0.35, mass: 1340, power: 15.5, top: 70, brake: 32, grip: 1.16, steer: 2.28, drive: "RWD" }),
  car({ id: "shihab", nameAr: "شهاب", nameEn: "Shihab", cls: "sport", price: 28500, paint: "#c4512c", accent: "#f4efe6", length: 4.28, width: 1.92, height: 1.18, cabin: 0.38, ride: 0.11, wheel: 0.34, spoiler: 0.42, mass: 1310, power: 16.2, top: 72, brake: 33, grip: 1.14, steer: 2.32, drive: "RWD" }),
  car({ id: "lahab", nameAr: "لهب", nameEn: "Lahab", cls: "sport", price: 32000, paint: "#14171c", accent: "#ff4d3a", length: 4.4, width: 1.94, height: 1.2, cabin: 0.39, ride: 0.11, wheel: 0.35, spoiler: 0.5, mass: 1360, power: 16.8, top: 74, brake: 34, grip: 1.18, steer: 2.25, drive: "RWD" }),
  car({ id: "saker", nameAr: "صقر آر", nameEn: "Saker R", cls: "sport", price: 36000, paint: "#123c38", accent: "#2ec4b6", length: 4.32, width: 1.91, height: 1.16, cabin: 0.37, ride: 0.1, wheel: 0.34, spoiler: 0.46, mass: 1290, power: 17.2, top: 76, brake: 34, grip: 1.2, steer: 2.36, drive: "RWD" }),
  car({ id: "najm", nameAr: "نجم الليل", nameEn: "Najm", cls: "sport", price: 30500, paint: "#2a2e38", accent: "#e8a317", length: 4.48, width: 1.88, height: 1.24, cabin: 0.41, ride: 0.12, wheel: 0.34, spoiler: 0.28, mass: 1380, power: 15.8, top: 71, brake: 32, grip: 1.15, steer: 2.22, drive: "AWD" }),
  car({ id: "reeh", nameAr: "ريح", nameEn: "Reeh", cls: "sport", price: 27000, paint: "#d5dde3", accent: "#243044", length: 4.22, width: 1.86, height: 1.2, cabin: 0.4, ride: 0.12, wheel: 0.33, spoiler: 0.22, mass: 1260, power: 15.2, top: 69, brake: 31, grip: 1.13, steer: 2.4, drive: "RWD" }),
  car({ id: "wamda", nameAr: "ومضة", nameEn: "Wamda", cls: "sport", price: 41000, paint: "#f2f2f0", accent: "#2ec4b6", length: 4.38, width: 1.93, height: 1.15, cabin: 0.36, ride: 0.1, wheel: 0.35, spoiler: 0.55, mass: 1320, power: 17.6, top: 77, brake: 35, grip: 1.19, steer: 2.3, drive: "RWD" }),
  car({ id: "aseel", nameAr: "أصيل", nameEn: "Aseel", cls: "sport", price: 22500, paint: "#6b705c", accent: "#e8a317", length: 4.42, width: 1.87, height: 1.26, cabin: 0.42, ride: 0.13, wheel: 0.34, spoiler: 0.18, mass: 1390, power: 14.8, top: 68, brake: 30, grip: 1.17, steer: 2.18, drive: "AWD" }),

  car({ id: "katheeb", nameAr: "كثيب", nameEn: "Katheeb", cls: "suv", price: 21000, paint: "#c2a36b", accent: "#1a1203", length: 4.7, width: 1.98, height: 1.78, cabin: 0.52, ride: 0.28, wheel: 0.4, spoiler: 0, mass: 2100, power: 12.2, top: 54, brake: 24, grip: 0.96, steer: 1.62, drive: "AWD" }),
  car({ id: "jabal", nameAr: "جبل", nameEn: "Jabal", cls: "suv", price: 26000, paint: "#3d4a3f", accent: "#d9d3c7", length: 4.85, width: 2.02, height: 1.86, cabin: 0.54, ride: 0.3, wheel: 0.42, spoiler: 0, mass: 2280, power: 12.8, top: 52, brake: 25, grip: 1.02, steer: 1.5, drive: "AWD" }),
  car({ id: "ramel", nameAr: "رمل إكس", nameEn: "Ramel X", cls: "suv", price: 30000, paint: "#8d5a32", accent: "#f4efe6", length: 4.78, width: 2, height: 1.74, cabin: 0.5, ride: 0.26, wheel: 0.41, spoiler: 0.08, mass: 2050, power: 13.6, top: 56, brake: 26, grip: 0.94, steer: 1.66, drive: "AWD" }),
  car({ id: "nakheel", nameAr: "نخيل", nameEn: "Nakheel", cls: "suv", price: 24500, paint: "#efe8da", accent: "#2a6b4f", length: 4.9, width: 1.96, height: 1.8, cabin: 0.55, ride: 0.27, wheel: 0.4, spoiler: 0, mass: 2160, power: 12.4, top: 53, brake: 24, grip: 0.98, steer: 1.58, drive: "AWD" }),
  car({ id: "sarab", nameAr: "سراب", nameEn: "Sarab", cls: "suv", price: 34000, paint: "#1c1f24", accent: "#e8a317", length: 4.72, width: 2.04, height: 1.7, cabin: 0.48, ride: 0.24, wheel: 0.41, spoiler: 0.2, mass: 1980, power: 14.4, top: 60, brake: 28, grip: 1.04, steer: 1.7, drive: "AWD" }),
  car({ id: "hisn", nameAr: "حصن", nameEn: "Hisn", cls: "suv", price: 28000, paint: "#f4f6f7", accent: "#1a1d22", length: 4.95, width: 2.02, height: 1.84, cabin: 0.53, ride: 0.29, wheel: 0.42, spoiler: 0, mass: 2320, power: 13.2, top: 55, brake: 30, grip: 1.08, steer: 1.55, drive: "AWD" }),

  car({ id: "midnight", nameAr: "منتصف الليل", nameEn: "Midnight", cls: "super", price: 86000, paint: "#0e1014", accent: "#e8a317", length: 4.58, width: 2.02, height: 1.08, cabin: 0.34, ride: 0.08, wheel: 0.35, spoiler: 0.7, mass: 1420, power: 20.5, top: 86, brake: 38, grip: 1.24, steer: 2.12, drive: "AWD" }),
  car({ id: "afaq-ss", nameAr: "أفق إس إس", nameEn: "Afaq SS", cls: "super", price: 94000, paint: "#e8a317", accent: "#14120c", length: 4.52, width: 1.98, height: 1.1, cabin: 0.33, ride: 0.08, wheel: 0.35, spoiler: 0.62, mass: 1380, power: 21, top: 88, brake: 39, grip: 1.22, steer: 2.16, drive: "RWD" }),
  car({ id: "fajr", nameAr: "فجر", nameEn: "Fajr", cls: "super", price: 102000, paint: "#f0d8c4", accent: "#c4512c", length: 4.64, width: 2, height: 1.06, cabin: 0.32, ride: 0.07, wheel: 0.35, spoiler: 0.58, mass: 1360, power: 21.4, top: 90, brake: 40, grip: 1.2, steer: 2.18, drive: "RWD" }),
  car({ id: "qamar", nameAr: "قمر أسود", nameEn: "Qamar", cls: "super", price: 110000, paint: "#17141f", accent: "#9b8cff", length: 4.6, width: 2.04, height: 1.05, cabin: 0.32, ride: 0.07, wheel: 0.36, spoiler: 0.75, mass: 1400, power: 21.8, top: 91, brake: 40, grip: 1.23, steer: 2.1, drive: "AWD" }),
  car({ id: "asifa", nameAr: "عاصفة", nameEn: "Asifa", cls: "super", price: 118000, paint: "#12343a", accent: "#7dfff2", length: 4.7, width: 2.02, height: 1.08, cabin: 0.33, ride: 0.08, wheel: 0.35, spoiler: 0.66, mass: 1440, power: 22.2, top: 92, brake: 41, grip: 1.26, steer: 2.08, drive: "AWD" }),
  car({ id: "zero", nameAr: "أفق زيرو", nameEn: "Afaq Zero", cls: "super", price: 132000, paint: "#f7f7f5", accent: "#111111", length: 4.48, width: 2.06, height: 1.02, cabin: 0.3, ride: 0.06, wheel: 0.35, spoiler: 0.8, mass: 1320, power: 23, top: 94, brake: 42, grip: 1.21, steer: 2.2, drive: "RWD" }),
  car({ id: "neon-x", nameAr: "نيون إكس", nameEn: "Neon X", cls: "super", price: 128000, paint: "#101820", accent: "#2ec4b6", length: 4.66, width: 2.05, height: 1.07, cabin: 0.31, ride: 0.07, wheel: 0.36, spoiler: 0.72, mass: 1390, power: 22.6, top: 93, brake: 41, grip: 1.25, steer: 2.14, drive: "AWD" }),
  car({ id: "ufuq", nameAr: "الأفق الأسطوري", nameEn: "Ufuq Legend", cls: "super", price: 180000, paint: "#1a1208", accent: "#e8a317", length: 4.75, width: 2.08, height: 1.04, cabin: 0.3, ride: 0.06, wheel: 0.36, spoiler: 0.9, mass: 1460, power: 24.5, top: 98, brake: 44, grip: 1.28, steer: 2.06, drive: "AWD" }),
];

export const PAINTS = ["#d9d3c7", "#f4efe6", "#1a1d22", "#e8a317", "#c4512c", "#123c38", "#243044", "#6d2e3a", "#8d5a32", "#2ec4b6"];
export const GLOWS = ["#2ec4b6", "#e8a317", "#ff4d3a", "#7eb6ff", "#f4efe6", "#9b8cff"];

export const UPGRADE_COST = {
  engine: [1600, 3000, 4800, 7600, 11500],
  brakes: [1300, 2400, 3800, 5600, 8400],
  suspension: [1400, 2500, 4000, 6000, 8800],
  gearbox: [1500, 2700, 4300, 6600, 9600],
  turbo: [3800, 7600, 12800],
} as const;

export type UpgradeKey = keyof typeof UPGRADE_COST;

const byId = new Map(CARS.map((c) => [c.id, c]));

export function getCar(id: string): CarDef {
  return byId.get(id) ?? CARS[0]!;
}

export function defaultUpgrades(): Upgrades {
  return { engine: 0, brakes: 0, suspension: 0, gearbox: 0, turbo: 0 };
}

export function defaultVisual(car: CarDef): Visual {
  return {
    paint: car.paint,
    wheels: 1,
    spoiler: car.spoiler > 0.2,
    ride: 0,
    glow: "#2ec4b6",
    bumper: 0,
  };
}

export function effectiveStats(car: CarDef, up: Upgrades): VehicleStats {
  return {
    mass: car.mass,
    power: car.power * (1 + up.engine * 0.075) * (1 + up.gearbox * 0.05),
    top: car.top * (1 + up.engine * 0.028 + up.turbo * 0.02),
    brake: car.brake * (1 + up.brakes * 0.1),
    grip: car.grip * (1 + up.suspension * 0.045),
    steer: car.steer * (1 + up.suspension * 0.02),
    drive: car.drive,
    wheelR: car.wheel,
    nitroMax: up.turbo * 1.4,
    nitroPower: 1 + up.turbo * 0.14,
  };
}

export function classKey(cls: CarClass) {
  if (cls === "sedan") return "classSedan" as const;
  if (cls === "sport") return "classSport" as const;
  if (cls === "suv") return "classSuv" as const;
  return "classSuper" as const;
}

import type { ReactNode } from "react";
import { audio } from "@/game/audio";
import { CARS, classKey, GLOWS, PAINTS, UPGRADE_COST, type UpgradeKey } from "@/game/cars";
import { t, type CopyKey } from "@/game/i18n";
import { respawn } from "@/game/sim";
import { useGame } from "@/game/store";
import type { Lang, TimePreset } from "@/game/types";
import { CHAMPIONSHIP, DISTRICTS, getRace, RACES } from "@/game/world";
import { formatTime } from "./Hud";

function tap(fn: () => void) {
  return () => {
    audio.unlock();
    fn();
  };
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`pointer-events-auto max-h-[78dvh] overflow-y-auto rounded-card border border-line bg-surface/88 p-4 shadow-none backdrop-blur-md sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Screens() {
  const screen = useGame((s) => s.screen);
  const lang = useGame((s) => s.lang);
  if (screen === "drive") return null;
  return (
    <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-8">
      {screen === "title" ? <Title /> : null}
      {screen === "garage" ? <Garage /> : null}
      {screen === "races" ? <Races /> : null}
      {screen === "map" ? <CityMap /> : null}
      {screen === "settings" ? <Settings /> : null}
      {screen === "pause" ? <Pause /> : null}
      {screen === "results" ? <Results /> : null}
      <span className="sr-only">{lang}</span>
    </div>
  );
}

function Title() {
  const lang = useGame((s) => s.lang);
  const setLang = useGame((s) => s.setLang);
  const credits = useGame((s) => s.credits);
  const selected = useGame((s) => s.selected);
  const car = CARS.find((c) => c.id === selected);
  const startDrive = useGame((s) => s.startDrive);
  const open = useGame((s) => s.open);
  return (
    <div className="pointer-events-none flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="pointer-events-auto">
        <p className="font-display text-4xl tracking-widest text-primary sm:text-6xl">MIDNIGHT RUSH</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{t(lang, "tagline")}</h1>
        <p className="text-muted">{t(lang, "city")}</p>
        <div className="mt-4 flex gap-2">
          <LangButton active={lang === "ar"} label={t(lang, "ar")} onClick={() => setLang("ar")} />
          <LangButton active={lang === "en"} label={t(lang, "en")} onClick={() => setLang("en")} />
        </div>
      </div>
      <Panel className="w-full max-w-sm">
        <MenuButton label={t(lang, "freeRoam")} hint={t(lang, "freeHint")} onClick={tap(startDrive)} />
        <MenuButton label={t(lang, "races")} hint={t(lang, "raceHint")} onClick={tap(() => open("races"))} />
        <MenuButton label={t(lang, "garage")} hint={t(lang, "garageHint")} onClick={tap(() => useGame.getState().startGarage())} />
        <MenuButton label={t(lang, "map")} hint={t(lang, "mapHint")} onClick={tap(() => open("map"))} />
        <MenuButton label={t(lang, "settings")} hint={t(lang, "saved")} onClick={tap(() => open("settings"))} />
        <p className="mt-3 text-sm text-muted">
          {car ? (lang === "ar" ? car.nameAr : car.nameEn) : ""} · {credits.toLocaleString(lang === "ar" ? "ar-SA" : "en")} {t(lang, "credits")}
        </p>
      </Panel>
    </div>
  );
}

function LangButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-11 rounded-card px-4 text-sm ${active ? "bg-primary text-primary-fg" : "border border-line bg-surface text-fg"}`}>
      {label}
    </button>
  );
}

function MenuButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-2 flex min-h-11 w-full flex-col items-start rounded-card border border-line bg-surface-2 px-4 py-2 text-start hover:border-primary">
      <span className="font-semibold text-fg">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}

function BackBar({ title }: { title: string }) {
  const lang = useGame((s) => s.lang);
  const screen = useGame((s) => s.screen);
  const backTitle = useGame((s) => s.backTitle);
  const resume = useGame((s) => s.resume);
  const returnTo = useGame((s) => s.returnTo);
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <button
        type="button"
        className="min-h-11 rounded-card border border-line px-3 text-sm"
        onClick={tap(() => {
          if (returnTo === "drive" && screen !== "title") resume();
          else backTitle();
        })}
      >
        {t(lang, "back")}
      </button>
    </div>
  );
}

function Garage() {
  const lang = useGame((s) => s.lang);
  const credits = useGame((s) => s.credits);
  const owned = useGame((s) => s.owned);
  const selected = useGame((s) => s.selected);
  const upgrades = useGame((s) => s.upgrades[selected]);
  const visual = useGame((s) => s.visuals[selected]);
  const notice = useGame((s) => s.notice);
  const buy = useGame((s) => s.buy);
  const upgrade = useGame((s) => s.upgrade);
  const car = CARS.find((c) => c.id === selected) ?? CARS[0]!;
  const up = upgrades ?? { engine: 0, brakes: 0, suspension: 0, gearbox: 0, turbo: 0 };
  const keys: UpgradeKey[] = ["engine", "brakes", "suspension", "gearbox", "turbo"];
  return (
    <Panel className="w-full max-w-3xl">
      <BackBar title={t(lang, "garage")} />
      <p className="mb-3 text-sm text-muted">
        {credits.toLocaleString(lang === "ar" ? "ar-SA" : "en")} {t(lang, "credits")}
        {notice === "notEnough" ? ` · ${t(lang, "notEnough")}` : ""}
      </p>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {CARS.map((c) => {
          const mine = owned.includes(c.id);
          const on = c.id === selected;
          return (
            <button
              key={c.id}
              type="button"
              onClick={tap(() => (mine ? useGame.getState().selectCar(c.id) : buy(c.id)))}
              className={`min-w-36 shrink-0 rounded-card border px-3 py-2 text-start ${on ? "border-primary bg-surface-2" : "border-line"}`}
            >
              <span className="block h-2 w-full rounded-full" style={{ background: c.paint }} />
              <span className="mt-2 block text-sm font-semibold">{lang === "ar" ? c.nameAr : c.nameEn}</span>
              <span className="text-xs text-muted">{t(lang, classKey(c.cls))}</span>
              <span className="mt-1 block text-xs text-accent">{mine ? t(lang, "owned") : c.price.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">{t(lang, "performance")}</h3>
          <p className="mb-2 text-xs text-muted">{t(lang, "paintNote")}</p>
          {keys.map((key) => {
            const level = up[key];
            const table = UPGRADE_COST[key];
            const maxed = level >= table.length;
            const cost = maxed ? 0 : table[level]!;
            return (
              <button
                key={key}
                type="button"
                disabled={maxed}
                onClick={tap(() => upgrade(key))}
                className="mb-2 flex min-h-11 w-full items-center justify-between rounded-card border border-line px-3 text-sm disabled:opacity-50"
              >
                <span>{t(lang, key as CopyKey)} · {level}/{table.length}</span>
                <span className="text-primary">{maxed ? t(lang, "upgradeMax") : cost.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
        <div>
          <h3 className="mb-2 font-semibold">{t(lang, "appearance")}</h3>
          <p className="mb-2 text-sm">{lang === "ar" ? car.nameAr : car.nameEn} · {car.drive} · {Math.round(car.top * 3.6)} {t(lang, "kmh")}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {PAINTS.map((paint) => (
              <button key={paint} type="button" aria-label={paint} onClick={tap(() => useGame.getState().setPaint(paint))} className="h-11 w-11 rounded-full border border-line" style={{ background: paint }} />
            ))}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {GLOWS.map((glow) => (
              <button key={glow} type="button" aria-label={glow} onClick={tap(() => useGame.getState().setGlow(glow))} className="h-11 w-11 rounded-full border border-line" style={{ background: glow }} />
            ))}
          </div>
          <div className="mb-3 flex gap-2">
            {[0, 1, 2].map((w) => (
              <button key={w} type="button" onClick={tap(() => useGame.getState().setWheels(w))} className={`min-h-11 flex-1 rounded-card border text-sm ${(visual?.wheels ?? 1) === w ? "border-primary" : "border-line"}`}>
                {t(lang, "wheels")} {w + 1}
              </button>
            ))}
          </div>
          <button type="button" onClick={tap(() => useGame.getState().toggleSpoiler())} className="mb-2 min-h-11 w-full rounded-card border border-line text-sm">
            {t(lang, "spoiler")}: {visual?.spoiler ? t(lang, "on") : t(lang, "off")}
          </button>
          <label className="block text-sm text-muted">
            {t(lang, "ride")}
            <input
              type="range"
              min={-0.08}
              max={0.16}
              step={0.02}
              value={visual?.ride ?? 0}
              onChange={(e) => useGame.getState().setRide(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>
      </div>
    </Panel>
  );
}

function Races() {
  const lang = useGame((s) => s.lang);
  const best = useGame((s) => s.best);
  const round = useGame((s) => s.championshipRound);
  const startRace = useGame((s) => s.startRace);
  const startChampionship = useGame((s) => s.startChampionship);
  const nextId = CHAMPIONSHIP[Math.min(round, CHAMPIONSHIP.length - 1)]!;
  const next = getRace(nextId);
  return (
    <Panel className="w-full max-w-3xl">
      <BackBar title={t(lang, "races")} />
      <button type="button" onClick={tap(startChampionship)} className="mb-4 min-h-11 w-full rounded-card bg-primary px-4 py-3 text-start text-primary-fg">
        <span className="block font-semibold">{t(lang, "championship")}</span>
        <span className="text-sm">{t(lang, "roundDone")} {Math.min(round, CHAMPIONSHIP.length)}/{CHAMPIONSHIP.length} · {lang === "ar" ? next.nameAr : next.nameEn}</span>
        <span className="mt-1 block text-xs">{t(lang, "champHint")}</span>
      </button>
      <div className="grid gap-2">
        {RACES.map((race) => {
          const record = best[race.id];
          const kindKey = race.kind === "street" ? "eventStreet" : race.kind === "time" ? "eventTime" : race.kind === "drift" ? "eventDrift" : race.kind === "highway" ? "eventHighway" : "eventPolice";
          return (
            <button key={race.id} type="button" onClick={tap(() => startRace(race.id, false))} className="min-h-11 rounded-card border border-line px-3 py-3 text-start">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{lang === "ar" ? race.nameAr : race.nameEn}</span>
                <span className="text-xs text-accent">{t(lang, kindKey)}</span>
              </span>
              <span className="mt-1 block text-xs text-muted">{lang === "ar" ? race.blurbAr : race.blurbEn}</span>
              <span className="mt-1 block text-xs text-primary">
                {t(lang, "reward")} {race.reward.toLocaleString()}
                {record != null ? ` · ${t(lang, "best")} ${race.higherBetter ? Math.round(record) : formatTime(record)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function CityMap() {
  const lang = useGame((s) => s.lang);
  return (
    <Panel className="w-full max-w-lg">
      <BackBar title={t(lang, "map")} />
      <p className="mb-3 text-sm text-muted">{t(lang, "mapNote")}</p>
      <ul className="space-y-2">
        {DISTRICTS.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-card border border-line px-3 py-2">
            <span className="h-3 w-3 rounded-full" style={{ background: d.color }} />
            <span>{lang === "ar" ? d.nameAr : d.nameEn}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Settings() {
  const lang = useGame((s) => s.lang);
  const settings = useGame((s) => s.settings);
  const patch = useGame((s) => s.patchSettings);
  const wins = useGame((s) => s.wins);
  const races = useGame((s) => s.races);
  const distance = useGame((s) => s.distance);
  const times: TimePreset[] = ["night", "dawn", "day", "dusk"];
  return (
    <Panel className="w-full max-w-lg">
      <BackBar title={t(lang, "settings")} />
      <p className="mb-3 text-sm text-muted">
        {t(lang, "wins")} {wins} · {t(lang, "racesDone")} {races} · {t(lang, "distance")} {(distance / 1000).toFixed(1)} km
      </p>
      <p className="mb-2 text-sm">{t(lang, "quality")}</p>
      <div className="mb-3 flex gap-2">
        {(["low", "med", "high"] as const).map((q) => (
          <button key={q} type="button" onClick={tap(() => patch({ quality: q }))} className={`min-h-11 flex-1 rounded-card border text-sm ${settings.quality === q ? "border-primary bg-surface-2" : "border-line"}`}>
            {t(lang, q)}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm">{t(lang, "camera")}</p>
      <div className="mb-3 flex gap-2">
        {(["chase", "hood", "bumper"] as const).map((c) => (
          <button key={c} type="button" onClick={tap(() => patch({ camera: c }))} className={`min-h-11 flex-1 rounded-card border text-sm ${settings.camera === c ? "border-primary bg-surface-2" : "border-line"}`}>
            {t(lang, c)}
          </button>
        ))}
      </div>
      <p className="mb-2 text-sm">{t(lang, "weather")}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {times.map((time) => (
          <button key={time} type="button" onClick={tap(() => patch({ time, cycle: false }))} className={`min-h-11 rounded-card border px-3 text-sm ${settings.time === time && !settings.cycle ? "border-primary" : "border-line"}`}>
            {t(lang, time)}
          </button>
        ))}
        <button type="button" onClick={tap(() => patch({ cycle: !settings.cycle }))} className={`min-h-11 rounded-card border px-3 text-sm ${settings.cycle ? "border-accent" : "border-line"}`}>
          {t(lang, "cycle")}
        </button>
        <button type="button" onClick={tap(() => patch({ rain: !settings.rain }))} className={`min-h-11 rounded-card border px-3 text-sm ${settings.rain ? "border-accent" : "border-line"}`}>
          {t(lang, "rain")}
        </button>
      </div>
      <label className="mb-3 block text-sm">
        {t(lang, "volume")} {Math.round(settings.volume * 100)}
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => patch({ volume: Number(e.target.value) })} className="mt-2 w-full" />
      </label>
      <label className="mb-3 block text-sm">
        {t(lang, "assist")} {Math.round(settings.assist * 100)}
        <input type="range" min={0} max={1} step={0.05} value={settings.assist} onChange={(e) => patch({ assist: Number(e.target.value) })} className="mt-2 w-full" />
        <span className="mt-1 block text-xs text-muted">{t(lang, "assistHint")}</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={tap(() => patch({ touch: !settings.touch }))} className="min-h-11 flex-1 rounded-card border border-line text-sm">
          {t(lang, "touchBtns")}: {settings.touch ? t(lang, "on") : t(lang, "off")}
        </button>
        <button
          type="button"
          onClick={tap(() => {
            const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
            if (D.requestPermission) void D.requestPermission();
            patch({ tilt: !settings.tilt });
          })}
          className="min-h-11 flex-1 rounded-card border border-line text-sm"
        >
          {t(lang, "tilt")}: {settings.tilt ? t(lang, "on") : t(lang, "off")}
        </button>
      </div>
    </Panel>
  );
}

function Pause() {
  const lang = useGame((s) => s.lang);
  const resume = useGame((s) => s.resume);
  const open = useGame((s) => s.open);
  const backTitle = useGame((s) => s.backTitle);
  const startGarage = useGame((s) => s.startGarage);
  return (
    <Panel className="w-full max-w-sm">
      <h2 className="mb-3 text-xl font-bold">{t(lang, "paused")}</h2>
      <MenuButton label={t(lang, "resume")} hint={t(lang, "driveNow")} onClick={tap(resume)} />
      <MenuButton label={t(lang, "respawn")} hint="R" onClick={tap(() => { respawn(); resume(); })} />
      <MenuButton label={t(lang, "map")} hint={t(lang, "mapHint")} onClick={tap(() => open("map"))} />
      <MenuButton label={t(lang, "settings")} hint={t(lang, "quality")} onClick={tap(() => open("settings"))} />
      <MenuButton label={t(lang, "toGarage")} hint={t(lang, "garageHint")} onClick={tap(startGarage)} />
      <MenuButton label={t(lang, "back")} hint={t(lang, "city")} onClick={tap(backTitle)} />
    </Panel>
  );
}

function Results() {
  const lang = useGame((s) => s.lang);
  const result = useGame((s) => s.lastResult);
  const credits = useGame((s) => s.credits);
  const startDrive = useGame((s) => s.startDrive);
  const startGarage = useGame((s) => s.startGarage);
  const startRace = useGame((s) => s.startRace);
  if (!result) return null;
  const race = getRace(result.raceId);
  return (
    <Panel className="w-full max-w-md">
      <h2 className="text-xl font-bold">{t(lang, "results")}</h2>
      <p className="mt-1 text-lg">{lang === "ar" ? race.nameAr : race.nameEn}</p>
      {result.busted ? <p className="mt-2 text-primary">{t(lang, "busted")}</p> : null}
      {result.escaped ? <p className="mt-2 text-accent">{t(lang, "escaped")}</p> : null}
      {!result.busted && race.kind !== "drift" && race.kind !== "police" ? (
        <p className="mt-3 font-display text-5xl text-primary">{result.place}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        {race.kind === "drift" ? `${t(lang, "score")} ${Math.round(result.score)}` : `${t(lang, "time")} ${formatTime(result.time)}`}
      </p>
      <p className="text-sm">
        {t(lang, "reward")} {result.reward > 0 ? "+" : ""}{result.reward.toLocaleString()}
        {result.record ? ` · ${t(lang, "newRecord")}` : ""}
      </p>
      <p className="mb-4 text-xs text-muted">{t(lang, "credits")} {credits.toLocaleString(lang === "ar" ? "ar-SA" : "en")}</p>
      <MenuButton label={t(lang, "retry")} hint={t(lang, "startRace")} onClick={tap(() => startRace(result.raceId, result.championship))} />
      <MenuButton label={t(lang, "toGarage")} hint={t(lang, "performance")} onClick={tap(startGarage)} />
      <MenuButton label={t(lang, "continueDrive")} hint={t(lang, "freeRoam")} onClick={tap(startDrive)} />
    </Panel>
  );
}

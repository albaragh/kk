import { useEffect, useRef, useState } from "react";
import { sim, standings } from "@/game/sim";
import { useGame } from "@/game/store";
import { t } from "@/game/i18n";
import { ROADS } from "@/game/world";

function Hold({
  label,
  className,
  onDown,
  onUp,
}: {
  label: string;
  className: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onUp();
      }}
      onPointerCancel={onUp}
    >
      {label}
    </button>
  );
}

export function Hud() {
  const lang = useGame((s) => s.lang);
  const settings = useGame((s) => s.settings);
  const pause = useGame((s) => s.pause);
  const speedRef = useRef<HTMLSpanElement>(null);
  const gearRef = useRef<HTMLSpanElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const lapRef = useRef<HTMLParagraphElement>(null);
  const wrongRef = useRef<HTMLParagraphElement>(null);
  const [board, setBoard] = useState<ReturnType<typeof standings>>([]);
  const [hint, setHint] = useState(true);
  const coarse = settings.touch || (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const p = sim.bodies.player;
      if (p && speedRef.current) speedRef.current.textContent = String(Math.round(Math.abs(p.speed) * 3.6));
      if (p && gearRef.current) gearRef.current.textContent = p.gear === 0 ? "R" : String(p.gear);
      if (p && needle.current) needle.current.setAttribute("transform", `rotate(${-210 + p.rpm * 240} 70 70)`);
      const canvas = mapRef.current;
      if (canvas && p) drawMap(canvas, p.x, p.z, p.yaw);
      if (arrowRef.current) arrowRef.current.style.rotate = `${sim.arrow}rad`;
      const raceNow = sim.race;
      const playerNow = sim.bodies.player;
      if (lapRef.current) {
        lapRef.current.textContent = raceNow && raceNow.def.kind !== "police" && raceNow.def.kind !== "drift"
          ? `${t(lang, "lap")} ${Math.min(raceNow.def.laps, (playerNow?.lap ?? 0) + 1)}/${raceNow.def.laps}`
          : raceNow?.def.kind === "drift"
            ? `${t(lang, "drift")} ${Math.round(sim.driftBank)}`
            : raceNow?.def.kind === "police"
              ? `${t(lang, "heat")} ${sim.heat.toFixed(1)}`
              : t(lang, "freeRoam");
      }
      if (clockRef.current) {
        clockRef.current.textContent = !raceNow
          ? ""
          : raceNow.phase === "countdown" && raceNow.countdown > 0
            ? String(Math.ceil(raceNow.countdown))
            : raceNow.phase === "countdown"
              ? t(lang, "go")
              : formatTime(raceNow.elapsed);
      }
      if (wrongRef.current) wrongRef.current.style.display = sim.wrongWay ? "block" : "none";
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const id = window.setInterval(() => setBoard(standings()), 200);
    const hide = window.setTimeout(() => setHint(false), 9000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(id);
      window.clearTimeout(hide);
    };
  }, [lang]);

  const race = sim.race;
  const lapText = race && race.def.kind !== "police" && race.def.kind !== "drift"
    ? `${t(lang, "lap")} ${Math.min(race.def.laps, (sim.bodies.player?.lap ?? 0) + 1)}/${race.def.laps}`
    : race?.def.kind === "drift"
      ? `${t(lang, "drift")} ${Math.round(sim.driftBank)}`
      : race?.def.kind === "police"
        ? `${t(lang, "heat")} ${sim.heat.toFixed(1)}`
        : t(lang, "freeRoam");

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute start-4 top-4 flex items-start gap-3">
        <canvas ref={mapRef} width={156} height={156} className="h-28 w-28 rounded-card border border-line bg-bg/80 sm:h-36 sm:w-36" />
        <div className="rounded-card border border-line bg-surface/80 px-3 py-2 backdrop-blur-md">
          <p ref={lapRef} className="font-display text-2xl leading-none text-primary">{lapText}</p>
          {race ? (
            <p ref={clockRef} className="mt-1 text-sm text-fg">
              {race.phase === "countdown" && race.countdown > 0
                ? Math.ceil(race.countdown)
                : race.phase === "countdown"
                  ? t(lang, "go")
                  : formatTime(race.elapsed)}
            </p>
          ) : null}
          {board.length > 1 ? (
            <ol className="mt-2 space-y-1 text-xs text-muted">
              {board.slice(0, 4).map((b, i) => (
                <li key={b.id} className={b.kind === "player" ? "text-fg" : ""}>
                  {i + 1}. {lang === "ar" ? b.nameAr : b.nameEn}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="pointer-events-auto absolute end-4 top-4 min-h-11 rounded-card border border-line bg-surface/80 px-4 text-sm text-fg"
        onClick={() => pause()}
      >
        {t(lang, "pause")}
      </button>

      <p
        ref={wrongRef}
        style={{ display: "none" }}
        className="absolute left-1/2 top-24 -translate-x-1/2 rounded-card bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
      >
        {t(lang, "wrongWay")}
      </p>

      {race && race.def.gates.length > 0 ? (
        <div ref={arrowRef} className="absolute top-16 left-1/2 h-8 w-8 -translate-x-1/2">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-accent">
            <path d="M12 3 L18 18 H6 Z" fill="currentColor" />
          </svg>
        </div>
      ) : null}

      <div className={`absolute end-3 flex items-end gap-3 sm:end-6 ${coarse ? "bottom-28" : "bottom-4 sm:bottom-6"}`}>
        <div className="relative h-36 w-36 sm:h-40 sm:w-40">
          <svg viewBox="0 0 140 140" className="h-full w-full">
            <circle cx="70" cy="70" r="62" fill="#12141c" stroke="#2a3142" strokeWidth="4" />
            <circle cx="70" cy="70" r="54" fill="none" stroke="#2a3142" strokeWidth="8" strokeDasharray="180 360" strokeLinecap="round" transform="rotate(140 70 70)" />
            <line ref={needle} x1="70" y1="70" x2="70" y2="28" stroke="#e8a317" strokeWidth="3" strokeLinecap="round" />
            <circle cx="70" cy="70" r="5" fill="#2ec4b6" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
            <span ref={speedRef} className="font-display text-4xl leading-none text-fg">0</span>
            <span className="text-xs text-muted">{t(lang, "kmh")}</span>
            <span ref={gearRef} className="font-display text-xl text-accent">1</span>
          </div>
        </div>
      </div>

      {hint && !coarse ? (
        <p className="absolute bottom-4 start-4 max-w-xs text-xs text-muted">{t(lang, "wasdHint")}</p>
      ) : null}

      {coarse ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex items-end justify-between px-3 pb-2" dir="ltr">
          <div className="flex gap-2">
            <Hold
              label="A"
              className="h-16 w-16 rounded-card border border-line bg-surface/85 text-lg text-fg"
              onDown={() => {
                sim.touch.left = true;
              }}
              onUp={() => {
                sim.touch.left = false;
              }}
            />
            <Hold
              label="D"
              className="h-16 w-16 rounded-card border border-line bg-surface/85 text-lg text-fg"
              onDown={() => {
                sim.touch.right = true;
              }}
              onUp={() => {
                sim.touch.right = false;
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Hold
              label={t(lang, "handbrake")}
              className="h-14 rounded-card border border-line bg-surface/85 px-3 text-xs text-fg"
              onDown={() => { sim.touch.handbrake = true; }}
              onUp={() => { sim.touch.handbrake = false; }}
            />
            <Hold
              label={t(lang, "nitro")}
              className="h-14 rounded-card border border-accent bg-surface/85 px-3 text-xs text-accent"
              onDown={() => { sim.touch.nitro = true; }}
              onUp={() => { sim.touch.nitro = false; }}
            />
            <Hold
              label={t(lang, "brake")}
              className="h-20 w-16 rounded-card bg-surface-2 text-sm text-fg"
              onDown={() => { sim.touch.brake = 1; }}
              onUp={() => { sim.touch.brake = 0; }}
            />
            <Hold
              label={t(lang, "gas")}
              className="h-20 w-16 rounded-card bg-primary text-sm font-semibold text-primary-fg"
              onDown={() => { sim.touch.throttle = 1; }}
              onUp={() => { sim.touch.throttle = 0; }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}

function drawMap(canvas: HTMLCanvasElement, x: number, z: number, yaw: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#12141c";
  ctx.fillRect(0, 0, w, h);
  const minX = -520;
  const minZ = -540;
  const spanX = 1100;
  const spanZ = 1060;
  const px = (v: number) => ((v - minX) / spanX) * w;
  const pz = (v: number) => ((v - minZ) / spanZ) * h;
  ctx.strokeStyle = "#3a4254";
  ctx.lineWidth = 2;
  for (const road of ROADS) {
    ctx.beginPath();
    road.pts.forEach((p, i) => {
      const sx = px(p.x);
      const sy = pz(p.z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    if (road.closed) ctx.closePath();
    ctx.stroke();
  }
  const sx = px(x);
  const sy = pz(z);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-yaw);
  ctx.fillStyle = "#e8a317";
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.fill();
  ctx.restore();
  const race = sim.race;
  const gate = race?.def.gates[sim.bodies.player?.cp ?? 0];
  if (gate && race && race.phase === "live") {
    ctx.fillStyle = "#2ec4b6";
    ctx.fillRect(px(gate.x) - 2, pz(gate.z) - 2, 4, 4);
  }
}

export { formatTime };

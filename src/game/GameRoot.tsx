import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { GameSim } from "./sim";
import { Scene } from "./scene";
import { Hud } from "./hud";

export function GameRoot() {
  const sim = useMemo(() => new GameSim(), []);
  useEffect(() => {
    const keys = sim.keys;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.add(e.code);
      sim.audio.unlock();
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    const onVis = () => {
      if (document.hidden) keys.clear();
    };
    document.addEventListener("visibilitychange", onVis);
    const qa = import.meta.env.DEV || new URLSearchParams(location.search).has("qa");
    if (qa) {
      window.__controlsTest = {
        getYaw: () => sim.player.yaw,
        getSpeed: () => Math.hypot(sim.player.vx, sim.player.vz),
        setKeys: (codes: string[]) => sim.setProbeKeys(codes),
      };
      window.__kot = { sim };
    }
    let look = false;
    let lx = 0;
    let ly = 0;
    let ox = 0;
    let oy = 0;
    const pd = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, [data-ui]")) return;
      sim.audio.unlock();
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        look = e.pointerType === "mouse";
        lx = ox = e.clientX;
        ly = oy = e.clientY;
      }
    };
    const pm = (e: PointerEvent) => {
      if (!look || e.pointerType !== "mouse") return;
      sim.addLook(e.clientX - lx, e.clientY - ly);
      lx = e.clientX;
      ly = e.clientY;
    };
    const pu = (e: PointerEvent) => {
      if (!look) return;
      const moved = Math.hypot(e.clientX - ox, e.clientY - oy);
      look = false;
      if (e.button === 0 && moved < 8 && sim.phase === "play" && sim.panel === "none" && !sim.dialogue && !sim.note) {
        sim.tap("attack");
      }
    };
    window.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    const menu = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      window.removeEventListener("contextmenu", menu);
      delete window.__controlsTest;
    };
  }, [sim]);

  const high = sim.settings.quality === "high";
  const low = sim.settings.quality === "low";
  return (
    <div className="game-shell">
      <Canvas
        shadows={high}
        dpr={low ? 0.75 : high ? [1, 1.25] : 1}
        camera={{ fov: 52, near: 0.12, far: 700, position: [18, 12, 48] }}
        gl={{ antialias: high, alpha: false, powerPreference: "high-performance" }}
      >
        <Scene sim={sim} />
      </Canvas>
      <Hud sim={sim} />
    </div>
  );
}

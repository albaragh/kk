import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import { audio } from "@/game/audio";
import { clamp } from "@/game/math";
import { boot, enterTitle, installProbe, respawn, sim } from "@/game/sim";
import { useGame } from "@/game/store";
import { GameScene } from "./Scene";
import { Hud } from "./Hud";
import { Screens } from "./Screens";

export default function MidnightRush() {
  const screen = useGame((s) => s.screen);
  const lang = useGame((s) => s.lang);
  const quality = useGame((s) => s.settings.quality);

  useEffect(() => {
    useGame.getState().hydrate();
    boot();
    installProbe();
    enterTitle();
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      sim.keys.add(e.code);
      audio.unlock();
      const s = useGame.getState();
      if (e.code === "Escape") {
        if (s.screen === "drive") s.pause();
        else if (s.screen === "pause") s.resume();
      }
      if (s.screen !== "drive") return;
      if (e.code === "KeyC") {
        const order = ["chase", "hood", "bumper"] as const;
        const i = order.indexOf(s.settings.camera);
        s.patchSettings({ camera: order[(i + 1) % order.length]! });
      }
      if (e.code === "KeyR") respawn();
      if (e.code === "KeyM") s.open("map");
    };
    const up = (e: KeyboardEvent) => sim.keys.delete(e.code);
    const blur = () => {
      sim.keys.clear();
      sim.touch.steer = 0;
      sim.touch.left = false;
      sim.touch.right = false;
      sim.touch.throttle = 0;
      sim.touch.brake = 0;
      sim.touch.handbrake = false;
      sim.touch.nitro = false;
    };
    const tilt = (e: DeviceOrientationEvent) => {
      if (!useGame.getState().settings.tilt) {
        sim.tiltSteer = 0;
        return;
      }
      sim.tiltSteer = clamp(-(e.gamma ?? 0) / 28, -1, 1);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("deviceorientation", tilt);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("deviceorientation", tilt);
    };
  }, []);

  const dpr: [number, number] = quality === "low" ? [1, 1] : quality === "med" ? [1, 1.35] : [1, 1.6];

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg text-fg touch-none" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Canvas
        key={quality}
        className="h-full w-full"
        dpr={dpr}
        gl={{ antialias: quality !== "low", powerPreference: "high-performance", alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.28;
        }}
        camera={{ fov: 62, near: 0.15, far: 900, position: [24, 18, 48] }}
      >
        <GameScene />
      </Canvas>
      <Screens />
      {screen === "drive" ? <Hud /> : null}
    </div>
  );
}

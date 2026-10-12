import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { advance, sim } from "@/game/sim";
import type { Gate } from "@/game/types";
import { GARAGE_SPOT } from "@/game/world";
import { CarPool } from "./CarMesh";
import { WorldView } from "./WorldView";
import { useGame } from "@/game/store";

function nightAmount(t: number) {
  const elev = Math.sin((t - 0.25) * Math.PI * 2);
  return THREE.MathUtils.clamp(0.55 - elev, 0, 1);
}

const SKY = [
  { t: 0, bg: "#070b16", fog: "#0a1020", sun: 0.08, amb: 0.28, sky: "#16243f", ground: "#1a120c" },
  { t: 0.28, bg: "#e3926a", fog: "#e7b39a", sun: 0.9, amb: 0.52, sky: "#f0b89a", ground: "#6d5644" },
  { t: 0.5, bg: "#8ec8ef", fog: "#d5e4ee", sun: 1.3, amb: 0.66, sky: "#c5e6f8", ground: "#d9c7a2" },
  { t: 0.74, bg: "#c45a3a", fog: "#d98972", sun: 0.55, amb: 0.42, sky: "#e48a62", ground: "#3a2a28" },
  { t: 1, bg: "#070b16", fog: "#0a1020", sun: 0.08, amb: 0.28, sky: "#16243f", ground: "#1a120c" },
];

function sampleSky(t: number) {
  let a = SKY[0]!;
  let b = SKY[1]!;
  for (let i = 0; i < SKY.length - 1; i++) {
    if (t >= SKY[i]!.t && t <= SKY[i + 1]!.t) {
      a = SKY[i]!;
      b = SKY[i + 1]!;
      break;
    }
  }
  const span = b.t - a.t || 1;
  const u = (t - a.t) / span;
  return { a, b, u };
}

function Director() {
  const { camera, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  const bg = useMemo(() => new THREE.Color(), []);
  const fogC = useMemo(() => new THREE.Color(), []);
  const skyC = useMemo(() => new THREE.Color(), []);
  const gndC = useMemo(() => new THREE.Color(), []);
  const cA = useMemo(() => new THREE.Color(), []);
  const cB = useMemo(() => new THREE.Color(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const camPos = useRef(new THREE.Vector3(30, 24, 70));
  const lookPos = useRef(new THREE.Vector3(0, 4, 0));
  const rainTint = useMemo(() => new THREE.Color("#1a1e24"), []);
  const rainFog = useMemo(() => new THREE.Color("#2a3038"), []);

  useFrame((_, delta) => {
    advance(delta);
    const dt = Math.min(delta, 0.05);
    const p = sim.bodies.player;
    if (!p) return;
    const { a, b, u } = sampleSky(sim.timeOfDay);
    const mix = (from: string, to: string, into: THREE.Color) => {
      cA.set(from);
      cB.set(to);
      into.copy(cA).lerp(cB, u);
    };
    mix(a.bg, b.bg, bg);
    mix(a.fog, b.fog, fogC);
    if (sim.rain) {
      bg.lerp(rainTint, 0.45);
      fogC.lerp(rainFog, 0.55);
    }
    scene.background = bg;
    if (!scene.fog) scene.fog = new THREE.Fog(fogC, 40, 420);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(fogC);
    const far = sim.quality === "low" ? 250 : sim.quality === "med" ? 380 : 520;
    fog.near = sim.rain ? 30 : 50;
    fog.far = sim.rain ? far * 0.7 : far;
    const night = nightAmount(sim.timeOfDay);
    if (sun.current && amb.current && hemi.current) {
      const elev = Math.sin((sim.timeOfDay - 0.25) * Math.PI * 2);
      sun.current.intensity = THREE.MathUtils.lerp(a.sun, b.sun, u) * (sim.rain ? 0.45 : 1);
      sun.current.position.set(Math.cos(sim.timeOfDay * Math.PI * 2) * 90, Math.max(8, elev * 70 + 12), 30);
      amb.current.intensity = THREE.MathUtils.lerp(a.amb, b.amb, u) * (sim.rain ? 0.75 : 1);
      mix(a.sky, b.sky, skyC);
      mix(a.ground, b.ground, gndC);
      hemi.current.color.copy(skyC);
      hemi.current.groundColor.copy(gndC);
      hemi.current.intensity = 0.45 + (1 - night) * 0.3;
    }
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const speed = Math.abs(p.speed);
    if (sim.mode === "title") {
      const t = sim.time;
      desired.set(Math.sin(t * 0.08) * 78, 32, Math.cos(t * 0.08) * 58);
      look.set(0, 10, 0);
    } else if (sim.mode === "garage") {
      const t = sim.time;
      desired.set(GARAGE_SPOT.x + Math.sin(t * 0.5) * 8.5, 2.8, GARAGE_SPOT.z + Math.cos(t * 0.5) * 8.5);
      look.set(GARAGE_SPOT.x, 1.05, GARAGE_SPOT.z);
    } else if (sim.camera === "hood") {
      desired.set(p.x + fx * 1.2, p.y + 0.82, p.z + fz * 1.2);
      look.set(p.x + fx * 16, p.y + 0.7, p.z + fz * 16);
    } else if (sim.camera === "bumper") {
      desired.set(p.x + fx * 2.1, p.y + 0.48, p.z + fz * 2.1);
      look.set(p.x + fx * 22, p.y + 0.55, p.z + fz * 22);
    } else {
      const dist = 7.6 + Math.min(2.4, speed * 0.035);
      const height = 2.45 + Math.min(0.8, speed * 0.015);
      const boom = sim.cinematic > 0 ? 4 : 0;
      desired.set(p.x - fx * (dist + boom), p.y + height + boom * 0.5, p.z - fz * (dist + boom));
      look.set(p.x + fx * 7, p.y + 1.05, p.z + fz * 7);
    }
    const snap = sim.snapCam ? 1 : 1 - Math.exp(-(sim.reduce ? 10 : 4.5) * dt);
    camPos.current.lerp(desired, snap);
    lookPos.current.lerp(look, snap);
    if (sim.snapCam) sim.snapCam = false;
    if (sim.shake > 0.01 && !sim.reduce && sim.mode === "drive") {
      camPos.current.x += (Math.random() - 0.5) * sim.shake;
      camPos.current.y += (Math.random() - 0.5) * sim.shake * 0.4;
    }
    camera.position.copy(camPos.current);
    camera.lookAt(lookPos.current);
    const persp = camera as THREE.PerspectiveCamera;
    const fovT = sim.mode === "drive" && !sim.reduce ? 62 + Math.min(14, speed * 0.2) : 60;
    if (Math.abs(persp.fov - fovT) > 0.05) {
      persp.fov += (fovT - persp.fov) * (1 - Math.exp(-3 * dt));
      persp.updateProjectionMatrix();
    }
    if (spot.current && target.current) {
      spot.current.position.set(p.x + fx * 1.4, p.y + 0.55, p.z + fz * 1.4);
      target.current.position.set(p.x + fx * 24, p.y, p.z + fz * 24);
      spot.current.target = target.current;
      spot.current.intensity = (night * 18 + 2) * (sim.quality === "low" ? 0 : 1);
    }
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.3} />
      <hemisphereLight ref={hemi} args={["#16243f", "#1a120c", 0.5]} />
      <directionalLight ref={sun} position={[40, 60, 20]} intensity={0.2} />
      <spotLight ref={spot} angle={0.55} penumbra={0.45} distance={70} color="#fff3d2" decay={2} />
      <object3D ref={target} />
    </>
  );
}

function GateMark({ gate, index }: { gate: Gate; index: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const race = sim.race;
    const on = !!race && sim.bodies.player?.cp === index && !sim.bodies.player?.finished;
    if (mat.current) mat.current.emissiveIntensity = on ? 1.8 : 0.2;
  });
  const rx = Math.cos(gate.yaw);
  const rz = -Math.sin(gate.yaw);
  const span = Math.min(gate.halfWidth, 14);
  return (
    <group>
      <mesh position={[gate.x + rx * span, 1.6, gate.z + rz * span]}>
        <boxGeometry args={[0.25, 3.2, 0.25]} />
        <meshStandardMaterial ref={mat} color="#e8a317" emissive="#e8a317" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[gate.x - rx * span, 1.6, gate.z - rz * span]}>
        <boxGeometry args={[0.25, 3.2, 0.25]} />
        <meshStandardMaterial color="#2ec4b6" emissive="#2ec4b6" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[gate.x, 3.15, gate.z]} rotation={[0, gate.yaw, 0]}>
        <boxGeometry args={[span * 2, 0.12, 0.12]} />
        <meshStandardMaterial color="#f4efe6" emissive="#f4efe6" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function Gates() {
  const race = sim.race;
  if (!race || sim.mode === "title" || sim.mode === "garage") return null;
  return (
    <>
      {race.def.gates.map((g, i) => (
        <GateMark key={`${race.def.id}-${i}`} gate={g} index={i} />
      ))}
    </>
  );
}

function Dust() {
  const count = sim.quality === "low" ? 0 : 48;
  const ref = useRef<THREE.Points>(null);
  const lives = useRef<number[]>(Array.from({ length: count }, () => 0));
  const pos = useMemo(() => new Float32Array(Math.max(1, count) * 3).fill(-40), [count]);
  useFrame((_, dt) => {
    const p = sim.bodies.player;
    const geo = ref.current?.geometry;
    if (!p || !geo || count === 0) return;
    const arr = geo.getAttribute("position").array as Float32Array;
    const spawn = p.drifting || (p.surface === "sand" && Math.abs(p.speed) > 12);
    for (let i = 0; i < count; i++) {
      lives.current[i] = (lives.current[i] ?? 0) - dt;
      if ((lives.current[i] ?? 0) <= 0) {
        if (spawn && i % 3 === Math.floor(sim.time * 20) % 3) {
          lives.current[i] = 0.4 + Math.random() * 0.3;
          arr[i * 3] = p.x + (Math.random() - 0.5) * 1.6;
          arr[i * 3 + 1] = p.y * 0.2 + 0.15;
          arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 1.6;
        } else {
          arr[i * 3 + 1] = -20;
        }
      } else {
        arr[i * 3 + 1]! += dt * 1.2;
      }
    }
    geo.getAttribute("position").needsUpdate = true;
  });
  if (count === 0) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#d9c7a2" size={0.35} transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

function Rain() {
  const count = sim.quality === "low" ? 0 : 280;
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(Math.max(1, count) * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 50;
      a[i * 3 + 1] = Math.random() * 24;
      a[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return a;
  }, [count]);
  useFrame((_, dt) => {
    const geo = ref.current?.geometry;
    const p = sim.bodies.player;
    if (!geo || !p || !sim.rain || count === 0) return;
    const arr = geo.getAttribute("position").array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1]! -= dt * 28;
      if (arr[i * 3 + 1]! < 0) {
        arr[i * 3] = p.x + (Math.random() - 0.5) * 50;
        arr[i * 3 + 1] = 18 + Math.random() * 8;
        arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 50;
      }
    }
    geo.getAttribute("position").needsUpdate = true;
  });
  if (!sim.rain || count === 0) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c5d4e0" size={0.08} transparent opacity={0.45} />
    </points>
  );
}

function Stars() {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      a[i * 3] = (Math.random() - 0.5) * 700;
      a[i * 3 + 1] = 40 + Math.random() * 140;
      a[i * 3 + 2] = (Math.random() - 0.5) * 700;
    }
    return a;
  }, []);
  useFrame(() => {
    if (ref.current) ref.current.visible = nightAmount(sim.timeOfDay) > 0.45 && !sim.rain;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#f4efe6" size={1.1} sizeAttenuation={false} />
    </points>
  );
}

export function GameScene() {
  const epoch = useGame((s) => s.epoch);
  const screen = useGame((s) => s.screen);
  const rain = useGame((s) => s.settings.rain);
  void epoch;
  void screen;
  void rain;
  return (
    <>
      <Director />
      <WorldView />
      <CarPool />
      <Gates />
      <Dust />
      <Rain />
      <Stars />
    </>
  );
}

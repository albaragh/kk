import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCar } from "@/game/cars";
import { sim } from "@/game/sim";
import { useGame } from "@/game/store";

const tireGeo = new THREE.CylinderGeometry(1, 1, 0.28, 16);
tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12);
rimGeo.rotateZ(Math.PI / 2);

export function CarView({ id }: { id: string }) {
  const epoch = useGame((s) => s.epoch);
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const spins = useRef<(THREE.Group | null)[]>([]);
  const brake = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.MeshStandardMaterial>(null);
  const body = sim.bodies[id];
  const def = getCar(body?.carId ?? "afaq-sedan");
  const paint = body?.paint ?? def.paint;
  const accent = body?.accent ?? def.accent;
  const glow = body?.glow ?? "#2ec4b6";
  const spoilerOn = body?.spoiler || def.spoiler > 0.25;
  const wheelStyle = body?.wheels ?? 1;
  void epoch;

  const mats = useMemo(() => {
    return {
      paint: new THREE.MeshStandardMaterial({ color: paint, metalness: 0.55, roughness: 0.38 }),
      accent: new THREE.MeshStandardMaterial({ color: accent, metalness: 0.4, roughness: 0.45 }),
      glass: new THREE.MeshStandardMaterial({
        color: "#0e141c",
        metalness: 0.8,
        roughness: 0.12,
        transparent: true,
        opacity: 0.78,
      }),
      dark: new THREE.MeshStandardMaterial({ color: "#14161a", metalness: 0.3, roughness: 0.6 }),
      glow: new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.4 }),
    };
  }, [paint, accent, glow]);

  useLayoutEffect(() => {
    return () => {
      mats.paint.dispose();
      mats.accent.dispose();
      mats.glass.dispose();
      mats.dark.dispose();
      mats.glow.dispose();
    };
  }, [mats]);

  useFrame(() => {
    const b = sim.bodies[id];
    const rig = root.current;
    if (!b || !rig || !shell.current) return;
    rig.visible = b.active;
    if (!b.active) return;
    rig.position.set(b.x, b.y, b.z);
    rig.rotation.set(0, b.yaw + Math.PI, 0);
    shell.current.rotation.set(b.pitch, 0, -b.roll);
    const night = sim.timeOfDay < 0.22 || sim.timeOfDay > 0.78 ? 1 : 0.35;
    if (brake.current) brake.current.emissiveIntensity = b.braking ? 2.4 : 0.25 + night * 0.2;
    if (beam.current) beam.current.emissiveIntensity = 2.2 + night * 2.6;
    spins.current.forEach((wheel, i) => {
      if (!wheel) return;
      const front = i < 2;
      wheel.rotation.y = front ? -b.steerVisual * 0.42 : 0;
      const spin = wheel.children[0] as THREE.Group | undefined;
      if (spin) spin.rotation.x = b.wheelSpin;
    });
  });

  const L = def.length;
  const W = def.width;
  const H = def.height;
  const wr = def.wheel;
  const ride = def.ride + (body?.ride ?? 0);
  const cabinL = L * def.cabin;
  const front = L * 0.33;

  return (
    <group ref={root}>
      {[
        [front, W * 0.46],
        [front, -W * 0.46],
        [-L * 0.33, W * 0.46],
        [-L * 0.33, -W * 0.46],
      ].map(([z, x], i) => (
        <group key={i} ref={(n: THREE.Group | null) => { spins.current[i] = n; }} position={[x, 0, z ?? 0]}>
          <group>
            <mesh geometry={tireGeo} scale={[wr, wr, wr * 0.85]} castShadow>
              <meshStandardMaterial color="#161616" roughness={0.72} />
            </mesh>
            <mesh geometry={rimGeo} scale={[wr * (0.42 + wheelStyle * 0.08), wr * (0.42 + wheelStyle * 0.08), wr * 0.5]}>
              <meshStandardMaterial color="#d5d8dc" metalness={0.85} roughness={0.22} />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={shell} position={[0, ride, 0]}>
        <mesh position={[0, H * 0.28, 0]} castShadow>
          <boxGeometry args={[W * 0.98, H * 0.34, L * 0.92]} />
          <primitive object={mats.paint} attach="material" />
        </mesh>
        <mesh position={[0, H * 0.48, -L * 0.04]} castShadow>
          <boxGeometry args={[W * 0.86, H * 0.28, L * 0.62]} />
          <primitive object={mats.paint} attach="material" />
        </mesh>
        <mesh position={[0, H * 0.72, -L * (0.08 + (0.5 - def.cabin) * 0.2)]} castShadow>
          <boxGeometry args={[W * 0.74, H * 0.32, cabinL]} />
          <primitive object={mats.glass} attach="material" />
        </mesh>
        <mesh position={[0, H * 0.34, L * 0.28]}>
          <boxGeometry args={[W * 0.72, H * 0.1, L * 0.22]} />
          <primitive object={mats.dark} attach="material" />
        </mesh>
        <mesh position={[0, H * 0.22, L * 0.46]}>
          <boxGeometry args={[W * 0.92, H * 0.16, 0.18]} />
          <primitive object={mats.paint} attach="material" />
        </mesh>
        <mesh position={[0, H * 0.2, -L * 0.46]}>
          <boxGeometry args={[W * 0.9, H * 0.18, 0.16]} />
          <primitive object={body?.bumper ? mats.accent : mats.paint} attach="material" />
        </mesh>
        <mesh position={[W * 0.34, H * 0.36, L * 0.42]}>
          <boxGeometry args={[0.22, 0.1, 0.12]} />
          <meshStandardMaterial ref={beam} color="#fff8dc" emissive="#fff3c4" emissiveIntensity={3.2} />
        </mesh>
        <mesh position={[-W * 0.34, H * 0.36, L * 0.42]}>
          <boxGeometry args={[0.28, 0.12, 0.16]} />
          <meshStandardMaterial color="#fff8dc" emissive="#fff3c4" emissiveIntensity={3.2} />
        </mesh>
        <mesh position={[W * 0.36, H * 0.34, -L * 0.46]}>
          <boxGeometry args={[0.24, 0.08, 0.08]} />
          <meshStandardMaterial ref={brake} color="#3a0000" emissive="#ff2a2a" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[-W * 0.36, H * 0.34, -L * 0.46]}>
          <boxGeometry args={[0.24, 0.08, 0.08]} />
          <meshStandardMaterial color="#3a0000" emissive="#ff2a2a" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, H * 0.56, L * 0.12]}>
          <boxGeometry args={[W * 0.2, 0.04, L * 0.28]} />
          <primitive object={mats.accent} attach="material" />
        </mesh>
        {spoilerOn ? (
          <mesh position={[0, H * 0.78 + def.spoiler * 0.25, -L * 0.42]} castShadow>
            <boxGeometry args={[W * 0.86, 0.06, 0.28 + def.spoiler * 0.2]} />
            <primitive object={mats.accent} attach="material" />
          </mesh>
        ) : null}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 0.7, L * 0.7]} />
          <primitive object={mats.glow} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

export function CarPool() {
  return (
    <>
      {sim.ids.map((id) => (
        <CarView key={id} id={id} />
      ))}
    </>
  );
}

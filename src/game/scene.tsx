import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { QUESTS } from "./content";
import type { GameSim } from "./sim";
import type { Archetype, Block, MatId } from "./types";
import { BLOCKS, PROPS, WATERS, kingdomAt, sampleBiomeColor, terrainHeight } from "./world";

const MAT_COLOR: Record<MatId, string> = {
  sandstone: "#c6a36a",
  plaster: "#efe2cf",
  wood: "#7a4b2d",
  copper: "#b87333",
  cloth: "#8c3b4a",
  stone: "#8d8a84",
  ice: "#d5e7f2",
  ash: "#4a403c",
  metal: "#6e7c86",
  glow: "#7de3c7",
  leaf: "#2f7d45",
  moon: "#b7a4d6",
};

const ENEMY_COLOR: Record<Archetype, [string, string, number]> = {
  raider: ["#8a3e32", "#e6c27a", 1],
  guard: ["#5c5348", "#d7d2c8", 1.12],
  archer: ["#3d5c48", "#e6c27a", 1],
  mage: ["#3a3f78", "#8fd0ff", 1.05],
  brute: ["#6a4332", "#c4492c", 1.45],
  captain: ["#6b3a4a", "#e6c27a", 1.15],
  beast: ["#6d4a28", "#1f6a42", 1.05],
  auto: ["#4d5c66", "#8fd0c8", 1.1],
  thief: ["#2a3038", "#e6c27a", 0.95],
  trainer: ["#243044", "#d0d7e2", 1.05],
  boss_bloom: ["#1d6b42", "#d6f27a", 1.7],
  boss_frost: ["#d5e4ef", "#8fb4d6", 1.75],
  boss_ash: ["#5a241c", "#ff6a2a", 1.85],
  boss_lost: ["#2c3e48", "#7de3c7", 1.7],
  boss_moon: ["#2a2040", "#e7d8ff", 1.9],
};

function loose(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.getIndex()) return g;
  const next = g.toNonIndexed();
  g.dispose();
  return next;
}

function blockGeometry(blocks: Block[]): Map<MatId, THREE.BufferGeometry> {
  const buckets = new Map<MatId, THREE.BufferGeometry[]>();
  for (const b of blocks) {
    let g: THREE.BufferGeometry;
    if (b.shape === "cyl") {
      g = new THREE.CylinderGeometry(b.w * 0.5, b.w * 0.52, b.h, 8);
      g.translate(b.x, b.base + b.h * 0.5, b.z);
    } else if (b.shape === "dome") {
      g = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(b.w * 0.5, b.h, b.d * 0.5);
      g.translate(b.x, b.base, b.z);
    } else if (b.shape === "cone") {
      g = new THREE.ConeGeometry(b.w * 0.5, b.h, 7);
      g.translate(b.x, b.base + b.h * 0.5, b.z);
    } else {
      g = new THREE.BoxGeometry(b.w, b.h, b.d);
      g.translate(b.x, b.base + b.h * 0.5, b.z);
    }
    const list = buckets.get(b.mat) ?? [];
    list.push(loose(g));
    buckets.set(b.mat, list);
  }
  const out = new Map<MatId, THREE.BufferGeometry>();
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list, false);
    if (merged) out.set(mat, merged);
    for (const g of list) g.dispose();
  }
  return out;
}

function propGeometry(kind: string): THREE.BufferGeometry {
  if (kind === "palm") {
    const trunk = loose(new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5).translate(0, 1.2, 0));
    const parts = [trunk];
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.ConeGeometry(0.18, 1.5, 4);
      leaf.rotateZ(Math.PI / 2.4);
      leaf.rotateY((i / 5) * Math.PI * 2);
      leaf.translate(0, 2.3, 0);
      parts.push(loose(leaf));
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) if (p !== merged) p.dispose();
    return merged ?? new THREE.CylinderGeometry(0.16, 0.22, 2.4, 5);
  }
  if (kind === "rock") return new THREE.DodecahedronGeometry(0.7, 0);
  if (kind === "tree") {
    const t = loose(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 5).translate(0, 0.8, 0));
    const c = loose(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 2, 0));
    const merged = mergeGeometries([t, c], false);
    t.dispose();
    c.dispose();
    return merged ?? new THREE.IcosahedronGeometry(0.9, 0);
  }
  if (kind === "pine") {
    const t = loose(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 5).translate(0, 0.4, 0));
    const a = loose(new THREE.ConeGeometry(0.7, 1.4, 6).translate(0, 1.4, 0));
    const b = loose(new THREE.ConeGeometry(0.5, 1.1, 6).translate(0, 2.2, 0));
    const merged = mergeGeometries([t, a, b], false);
    t.dispose();
    a.dispose();
    b.dispose();
    return merged ?? new THREE.ConeGeometry(0.7, 2, 6);
  }
  if (kind === "crystal") return new THREE.OctahedronGeometry(0.55, 0);
  if (kind === "pillar") {
    const g = new THREE.CylinderGeometry(0.28, 0.34, 2.2, 6);
    g.translate(0, 1.1, 0);
    return g;
  }
  if (kind === "dead") {
    const t = new THREE.CylinderGeometry(0.08, 0.14, 1.8, 4);
    t.translate(0, 0.9, 0);
    return t;
  }
  const reed = new THREE.ConeGeometry(0.08, 1.1, 4);
  reed.translate(0, 0.55, 0);
  return reed;
}

function makeTerrain(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const size = 240;
  const seg = 32;
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -1; gz <= 1; gz++) {
      const cx = gx * size;
      const cz = gz * size;
      const g = new THREE.PlaneGeometry(size, size, seg, seg);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + cx;
        const z = pos.getZ(i) + cz;
        const h = terrainHeight(x, z);
        pos.setXYZ(i, x, h, z);
        const c = sampleBiomeColor(x, z, h);
        colors[i * 3] = c[0];
        colors[i * 3 + 1] = c[1];
        colors[i * 3 + 2] = c[2];
      }
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      g.computeVertexNormals();
      geos.push(g);
    }
  }
  return geos;
}

const skyVert = `
  varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = position;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const skyFrag = `
  uniform vec3 uSun;
  uniform float uNight;
  varying vec3 vPos;
  void main() {
    vec3 dir = normalize(vPos);
    float h = dir.y * 0.5 + 0.5;
    vec3 dusk = mix(vec3(0.10, 0.08, 0.12), vec3(0.62, 0.32, 0.22), smoothstep(0.0, 0.55, h));
    vec3 day = mix(vec3(0.55, 0.62, 0.72), vec3(0.33, 0.52, 0.78), smoothstep(0.2, 1.0, h));
    vec3 night = mix(vec3(0.03, 0.04, 0.08), vec3(0.07, 0.09, 0.16), h);
    vec3 col = mix(day, dusk, clamp(uNight * 1.4, 0.0, 1.0));
    col = mix(col, night, smoothstep(0.35, 1.0, uNight));
    float sun = pow(max(dot(dir, normalize(uSun)), 0.0), 360.0);
    col += vec3(1.0, 0.78, 0.45) * sun;
    float stars = step(0.992, fract(sin(dot(floor(dir * 90.0), vec3(12.9, 78.2, 45.1))) * 43758.5));
    col += stars * smoothstep(0.4, 0.9, uNight) * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const waterVert = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vW;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.y += sin(p.x * 0.45 + uTime) * 0.08 + cos(p.z * 0.38 + uTime * 0.8) * 0.06;
    vW = p.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const waterFrag = `
  uniform vec3 uColor;
  uniform float uHot;
  varying float vW;
  void main() {
    vec3 col = uColor + vW * 0.8;
    col += uHot * vec3(0.5, 0.15, 0.0);
    gl_FragColor = vec4(col, uHot > 0.5 ? 0.85 : 0.62);
  }
`;

function Humanoid({
  accent,
  cloth,
  scale = 1,
  boss = false,
}: {
  accent: string;
  cloth: string;
  scale?: number;
  boss?: boolean;
}) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.55, 4, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.62, 0.04]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color="#e6c7a2" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow>
        <coneGeometry args={[0.26, 0.42, 8]} />
        <meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.15, -0.12]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.62, 0.7, 0.08]} />
        <meshStandardMaterial color={accent} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.08, 1.64, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a120c" emissive="#e6c27a" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.08, 1.64, 0.18]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#1a120c" emissive="#e6c27a" emissiveIntensity={0.4} />
      </mesh>
      {boss ? (
        <mesh position={[0, 2.15, 0]}>
          <torusGeometry args={[0.28, 0.045, 6, 16]} />
          <meshStandardMaterial color="#e6c27a" emissive="#c4492c" emissiveIntensity={0.6} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Scene({ sim }: { sim: GameSim }) {
  const { camera, scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const sky = useRef<THREE.Mesh>(null);
  const player = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const enemyRefs = useRef<(THREE.Group | null)[]>([]);
  const npcRefs = useRef<(THREE.Group | null)[]>([]);
  const shotRefs = useRef<(THREE.Mesh | null)[]>([]);
  const markerRef = useRef<THREE.Mesh>(null);
  const gliderRef = useRef<THREE.Mesh>(null);
  const objectRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const waterMats = useRef<THREE.ShaderMaterial[]>([]);
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        uniforms: { uSun: { value: new THREE.Vector3(0.3, 0.6, 0.2) }, uNight: { value: 0.4 } },
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  const cities = useMemo(() => blockGeometry(BLOCKS), []);
  const terrain = useMemo(() => makeTerrain(), []);
  const props = useMemo(() => {
    const kinds = ["palm", "rock", "tree", "pine", "crystal", "pillar", "dead", "reed"] as const;
    return kinds.map((kind) => {
      const list = PROPS.filter((p) => p.kind === kind);
      const geo = propGeometry(kind);
      const color = kind === "tree" || kind === "pine" || kind === "reed" ? "#2f7d45" : kind === "palm" ? "#c4a15a" : kind === "crystal" ? "#7de3c7" : "#8a8178";
      return { kind, list, geo, color: kind === "palm" ? "#6a8f4e" : color };
    });
  }, []);

  useEffect(() => {
    const prev = scene.fog;
    return () => {
      skyMat.dispose();
      terrain.forEach((g) => g.dispose());
      for (const g of cities.values()) g.dispose();
      props.forEach((p) => p.geo.dispose());
      if (prev) scene.fog = prev;
    };
  }, [cities, props, scene, skyMat, terrain]);

  useFrame((_, delta) => {
    sim.tick(delta);
    const dt = Math.min(delta, 0.05);
    camera.position.set(sim.cam.x, sim.cam.y, sim.cam.z);
    camera.lookAt(sim.cam.lx, sim.cam.ly, sim.cam.lz);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== sim.cam.fov) {
      camera.fov = sim.cam.fov;
      camera.updateProjectionMatrix();
    }
    const sunV = sim.sunDir();
    const night = clampNight(sunV[1]);
    skyMat.uniforms.uSun.value.set(sunV[0], sunV[1], sunV[2]);
    skyMat.uniforms.uNight.value = night;
    if (sky.current) sky.current.position.set(sim.cam.x, 0, sim.cam.z);
    if (sun.current) {
      sun.current.position.set(sim.player.x + sunV[0] * 40, sim.player.y + sunV[1] * 40, sim.player.z + sunV[2] * 40);
      sun.current.target.position.set(sim.player.x, sim.player.y, sim.player.z);
      sun.current.target.updateMatrixWorld();
      sun.current.intensity = 0.35 + Math.max(0, sunV[1]) * 1.5;
    }
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      const k = kingdomAt(sim.player.x, sim.player.z);
      const tint: Record<string, string> = {
        sand: "#d8b07a",
        life: "#8fbf9a",
        frost: "#c5d5e2",
        ash: "#8a5a48",
        lost: "#6f8d90",
        twilight: "#9a86b8",
      };
      fog.color.set(tint[k] ?? "#d8b07a");
      const w = sim.weather();
      fog.density = w === "sand" ? 0.028 : w === "snow" ? 0.02 : w === "ash" ? 0.018 : k === "lost" ? 0.03 : 0.0085;
    }
    const p = sim.player;
    if (player.current) {
      player.current.visible = sim.phase !== "title";
      player.current.position.set(p.x, p.y, p.z);
      player.current.rotation.y = p.yaw + Math.PI;
      const walk = Math.sin(p.anim * 1.4) * Math.min(1, p.speed / 6);
      if (legL.current) legL.current.rotation.x = walk * 0.7;
      if (legR.current) legR.current.rotation.x = -walk * 0.7;
      if (arm.current) {
        const swing = p.attackT > 0 ? Math.sin((1 - p.attackT / 0.4) * Math.PI) * -1.6 : walk * 0.5;
        arm.current.rotation.x = p.gliding ? -1.1 : swing;
      }
      player.current.position.y += p.swimming ? -0.4 : 0;
    }
    sim.enemies.forEach((e, i) => {
      const ref = enemyRefs.current[i];
      if (!ref) return;
      ref.visible = e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 150;
      ref.position.set(e.x, e.y, e.z);
      ref.rotation.y = e.yaw + Math.PI;
      const s = 1 + (e.flash > 0 ? 0.06 : 0);
      ref.scale.setScalar(s);
    });
    sim.npcSpots().forEach((n, i) => {
      const ref = npcRefs.current[i];
      if (!ref) return;
      const y = terrainHeight(n.x, n.z);
      ref.position.set(n.x, y, n.z);
      ref.rotation.y = Math.sin(sim.play * 0.4 + i) * 0.4 + Math.PI;
    });
    for (const mat of waterMats.current) {
      if (mat?.uniforms?.uTime) mat.uniforms.uTime.value += dt;
    }
    if (gliderRef.current) gliderRef.current.visible = sim.hasGlider && (p.gliding || p.y > terrainHeight(p.x, p.z) + 1.2);
    const mark = objectiveMarker(sim);
    if (markerRef.current) {
      markerRef.current.visible = !!mark;
      if (mark) markerRef.current.position.set(mark.x, mark.y + 5, mark.z);
    }
    sim.objects.forEach((o, i) => {
      const m = objectRefs.current[i];
      if (!m) return;
      const show = !(o.used && o.kind !== "travel" && o.kind !== "puzzle" && o.kind !== "well");
      m.visible = show;
      m.position.set(o.x, o.y + 1.1 + Math.sin(sim.play * 2 + i) * 0.12, o.z);
    });
    sim.enemies.forEach((e, i) => {
      const ring = ringRefs.current[i];
      if (!ring) return;
      ring.visible = e.alive && e.wind > 0;
      const sc = e.slam ? 2.4 : 1;
      ring.scale.setScalar(sc);
    });
    for (let i = 0; i < 24; i++) {
      const m = shotRefs.current[i];
      const s = sim.shots[i];
      if (!m) continue;
      m.visible = !!s;
      if (s) {
        m.position.set(s.x, s.y, s.z);
        m.scale.setScalar(s.r);
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.color.set(s.team === "p" ? "#f4efe4" : "#c4492c");
      }
    }
  });

  const q = sim.settings.quality === "low" ? 0 : sim.settings.quality === "high" ? 1 : 0.5;

  return (
    <>
      <color attach="background" args={["#1a140f"]} />
      <fogExp2 attach="fog" args={["#d8b07a", 0.01]} />
      <hemisphereLight args={["#f0d2a0", "#3a2a22", 0.55]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        ref={sun}
        castShadow={q > 0}
        intensity={1.3}
        shadow-mapSize={q > 0.6 ? [2048, 2048] : [1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
      />
      <mesh ref={sky} frustumCulled={false}>
        <sphereGeometry args={[380, 24, 16]} />
        <primitive object={skyMat} attach="material" />
      </mesh>
      <mesh position={[48, 150, -90]}>
        <sphereGeometry args={[10, 16, 12]} />
        <meshStandardMaterial color="#f4efe4" emissive="#f2e2b8" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[28, 146, -96]}>
        <sphereGeometry args={[8.2, 16, 12]} />
        <meshStandardMaterial color="#d9e4f5" emissive="#c9d7ee" emissiveIntensity={1.1} />
      </mesh>
      {terrain.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.94} metalness={0.02} />
        </mesh>
      ))}
      {[...cities.entries()].map(([mat, geo]) => (
        <mesh key={mat} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color={MAT_COLOR[mat]}
            roughness={mat === "metal" || mat === "copper" ? 0.45 : 0.86}
            metalness={mat === "metal" || mat === "copper" ? 0.45 : 0}
            emissive={mat === "glow" ? "#1f8a70" : "#000"}
            emissiveIntensity={mat === "glow" ? 0.8 : 0}
          />
        </mesh>
      ))}
      {props.map((p) =>
        p.list.length ? <PropField key={p.kind} geo={p.geo} list={p.list} color={p.color} /> : null,
      )}
      {WATERS.map((w, i) => (
        <Water key={w.id} x={w.x} y={w.y} z={w.z} r={w.r} hot={w.kind === "lava"} mats={waterMats} index={i} />
      ))}
      <group ref={player}>
        <Humanoid accent="#6b3a4a" cloth="#efe2cf" />
        <group ref={arm} position={[0.34, 1.25, 0.05]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.08, 0.32, 3, 6]} />
            <meshStandardMaterial color="#e6c7a2" />
          </mesh>
          <mesh position={[0.05, -0.55, 0.15]} rotation={[0.4, 0, -0.6]} castShadow>
            <boxGeometry args={[0.07, 0.85, 0.035]} />
            <meshStandardMaterial color="#d7dde6" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
        <group ref={legL} position={[-0.12, 0.62, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.09, 0.28, 3, 6]} />
            <meshStandardMaterial color="#3a3128" />
          </mesh>
        </group>
        <group ref={legR} position={[0.12, 0.62, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.09, 0.28, 3, 6]} />
            <meshStandardMaterial color="#3a3128" />
          </mesh>
        </group>
        {sim.hasGlider || true ? (
          <mesh ref={gliderRef} position={[0, 1.2, -0.2]} rotation={[0.4, 0, 0]} visible={false}>
            <boxGeometry args={[1.5, 0.04, 0.42]} />
            <meshStandardMaterial color="#c4492c" side={THREE.DoubleSide} />
          </mesh>
        ) : null}
      </group>
      {sim.enemies.map((e, i) => {
        const look = ENEMY_COLOR[e.arch];
        return (
          <group key={e.id} ref={(n) => { enemyRefs.current[i] = n; }}>
            <Humanoid accent={look[1]} cloth={look[0]} scale={look[2]} boss={e.arch.startsWith("boss")} />
            {e.arch ? (
              <mesh ref={(n) => { ringRefs.current[i] = n; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={false}>
                <ringGeometry args={[0.45, 1.25, 20]} />
                <meshBasicMaterial color="#e6c27a" transparent opacity={0.5} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {sim.npcSpots().map((n, i) => (
        <group key={n.id} ref={(el) => { npcRefs.current[i] = el; }}>
          <Humanoid accent="#e6c27a" cloth={robeOf(n.id)} scale={0.95} />
        </group>
      ))}
      {sim.objects.map((o, i) => (
        <mesh key={o.id} ref={(n) => { objectRefs.current[i] = n; }} position={[o.x, o.y + 1.1, o.z]}>
          <octahedronGeometry args={[o.tag === "obelisk" ? 0.45 : 0.22, 0]} />
          <meshStandardMaterial color={o.tag === "obelisk" ? "#e6c27a" : "#7de3c7"} emissive="#e6c27a" emissiveIntensity={0.35} />
        </mesh>
      ))}
      <mesh ref={markerRef} visible={false}>
        <cylinderGeometry args={[0.08, 0.22, 7, 6]} />
        <meshBasicMaterial color="#e6c27a" transparent opacity={0.5} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => (
        <mesh key={`shot-${i}`} ref={(n) => { shotRefs.current[i] = n; }} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#f4efe4" />
        </mesh>
      ))}
      <Weather sim={sim} />
    </>
  );
}

function clampNight(sunY: number): number {
  return Math.max(0, Math.min(1, 0.55 - sunY));
}

function robeOf(id: string): string {
  const map: Record<string, string> = {
    layla: "#6b3a4a",
    sakhr: "#8a6232",
    cook: "#a3542c",
    trainer: "#2e3d55",
    nahr: "#1f6a52",
    hermit: "#d5dde6",
    survivor: "#5c4038",
    smith: "#7a2e22",
    archivist: "#3d6e78",
    echo: "#6d5a9a",
  };
  return map[id] ?? "#efe2cf";
}

function objectiveMarker(sim: GameSim): { x: number; y: number; z: number } | null {
  if (sim.phase !== "play") return null;
  for (const def of QUESTS) {
    const q = sim.quests[def.id];
    if (!q || q.status !== "active" || def.kind !== "main") continue;
    const obj = def.objectives[q.step];
    if (!obj) return null;
    if (obj.type === "reach") return { x: obj.x, y: terrainHeight(obj.x, obj.z), z: obj.z };
    if (obj.type === "talk") {
      const n = sim.npcSpots().find((p) => p.id === obj.npc);
      if (n) return { x: n.x, y: terrainHeight(n.x, n.z), z: n.z };
    }
  }
  return null;
}

function PropField({
  geo,
  list,
  color,
}: {
  geo: THREE.BufferGeometry;
  list: { x: number; y: number; z: number; s: number; r: number }[];
  color: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.y = p.r;
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [list]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, list.length]} castShadow>
      <meshStandardMaterial color={color} roughness={0.82} />
    </instancedMesh>
  );
}

function Water({
  x, y, z, r, hot, mats, index,
}: {
  x: number; y: number; z: number; r: number; hot: boolean; mats: MutableRefObject<THREE.ShaderMaterial[]>; index: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: index },
          uColor: { value: new THREE.Color(hot ? "#ff5a1f" : "#1f6f86") },
          uHot: { value: hot ? 1 : 0 },
        },
        vertexShader: waterVert,
        fragmentShader: waterFrag,
      }),
    [hot, index],
  );
  useEffect(() => {
    mats.current[index] = mat;
  }, [index, mat, mats]);
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(1, 24);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <mesh position={[x, y, z]} scale={[r, 1, r]} geometry={geo} material={mat} />
  );
}

function Weather({ sim }: { sim: GameSim }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 280;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const w = sim.weather();
    pts.visible = w !== "clear";
    const arr = geo.attributes.position as THREE.BufferAttribute;
    const speed = w === "sand" ? 18 : 8;
    for (let i = 0; i < arr.count; i++) {
      let y = arr.getY(i) - dt * speed;
      if (y < 0) y = 16;
      arr.setY(i, y);
    }
    arr.needsUpdate = true;
    pts.position.set(sim.player.x, sim.player.y, sim.player.z);
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#f4efe4" size={0.08} transparent opacity={0.7} />
    </points>
  );
}

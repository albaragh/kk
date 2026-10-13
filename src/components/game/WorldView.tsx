import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/game/sim";
import { BUILDINGS, PROPS, ROADS, type Prop } from "@/game/world";

function makeWindows() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#12151c";
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 250; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const on = Math.random() > 0.42;
      g.fillStyle = on ? (Math.random() > 0.75 ? "#f0c36a" : "#d7e4ef") : "#1c2430";
      g.fillRect(x, y, 9, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSign(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#10141c";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#e8a317";
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 246, 512, 10);
  g.fillStyle = "#2ec4b6";
  g.fillRect(0, 18, 8, 220);
  g.fillStyle = "#f4efe6";
  g.font = "700 92px Cairo, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  let v = 0;
  for (const road of ROADS) {
    const pts = road.closed ? [...road.pts, road.pts[0]!] : road.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const rx = (-dz / len) * (road.width / 2);
      const rz = (dx / len) * (road.width / 2);
      const lift = 0.05;
      positions.push(
        a.x - rx, a.y + lift, a.z - rz,
        a.x + rx, a.y + lift, a.z + rz,
        b.x + rx, b.y + lift, b.z + rz,
        b.x - rx, b.y + lift, b.z - rz,
      );
      indices.push(v, v + 2, v + 1, v, v + 3, v + 2);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

type Item = { x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number };

function cullRadius() {
  if (sim.quality === "low") return 220;
  if (sim.quality === "med") return 340;
  return 420;
}

function Instanced({
  items,
  geometry,
  material,
}: {
  items: Item[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const bases = useRef<THREE.Matrix4[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const zero = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    bases.current = items.map((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      return dummy.matrix.clone();
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, dummy]);
  const acc = useRef(0);
  const shown = useRef<Uint8Array | null>(null);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.45) return;
    acc.current = 0;
    const mesh = ref.current;
    const p = sim.bodies.player;
    if (!mesh || !p) return;
    if (!shown.current || shown.current.length !== items.length) shown.current = new Uint8Array(items.length).fill(1);
    const radius = cullRadius();
    let dirty = false;
    for (let i = 0; i < items.length; i++) {
      const b = items[i]!;
      const vis = Math.hypot(b.x - p.x, b.z - p.z) > radius ? 0 : 1;
      if (shown.current[i] === vis) continue;
      shown.current[i] = vis;
      const base = bases.current[i];
      if (base) mesh.setMatrixAt(i, vis ? base : zero);
      dirty = true;
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  });
  if (items.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />;
}

function buildingsOf(style: "tower" | "stone" | "industrial" | "neon"): Item[] {
  return BUILDINGS.filter((b) => b.style === style).map((b) => ({
    x: b.x,
    y: b.h / 2,
    z: b.z,
    sx: b.w,
    sy: b.h,
    sz: b.d,
    rot: 0,
  }));
}

function propsOf(kind: Prop["kind"], map: (p: Prop) => Item): Item[] {
  return PROPS.filter((p) => p.kind === kind).map(map);
}

export function WorldView() {
  const roads = useMemo(() => roadGeometry(), []);
  const windows = useMemo(() => makeWindows(), []);
  const signs = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const p of PROPS) {
      if (p.kind === "sign" && p.text && !map.has(p.text)) map.set(p.text, makeSign(p.text));
    }
    return map;
  }, []);
  const towers = useMemo(() => buildingsOf("tower"), []);
  const stone = useMemo(() => buildingsOf("stone"), []);
  const industrial = useMemo(() => buildingsOf("industrial"), []);
  const neon = useMemo(() => buildingsOf("neon"), []);
  const lamps = useMemo(
    () => propsOf("lamp", (p) => ({ x: p.x, y: p.y + 2.2, z: p.z, sx: 0.16, sy: 4.4, sz: 0.16, rot: p.rot })),
    [],
  );
  const heads = useMemo(
    () => propsOf("lamp", (p) => ({ x: p.x, y: p.y + 4.5, z: p.z, sx: 0.55, sy: 0.16, sz: 0.28, rot: p.rot })),
    [],
  );
  const palms = useMemo(
    () => propsOf("palm", (p) => ({ x: p.x, y: 1.6 * p.s, z: p.z, sx: 0.22 * p.s, sy: 3.2 * p.s, sz: 0.22 * p.s, rot: p.rot })),
    [],
  );
  const crowns = useMemo(
    () => propsOf("palm", (p) => ({ x: p.x, y: 3.5 * p.s, z: p.z, sx: 1.5 * p.s, sy: 1.1 * p.s, sz: 1.5 * p.s, rot: p.rot })),
    [],
  );
  const dunes = useMemo(
    () => propsOf("dune", (p) => ({ x: p.x, y: p.s * 0.18, z: p.z, sx: p.s, sy: p.s * 0.45, sz: p.s * 0.75, rot: p.rot })),
    [],
  );
  const rocks = useMemo(
    () => propsOf("rock", (p) => ({ x: p.x, y: p.s * 0.4, z: p.z, sx: p.s, sy: p.s * 0.8, sz: p.s * 0.9, rot: p.rot })),
    [],
  );
  const rails = useMemo(
    () => propsOf("barrier", (p) => ({ x: p.x, y: p.y + 0.45, z: p.z, sx: 0.16, sy: 0.7, sz: 1.4, rot: p.rot })),
    [],
  );
  const pillars = useMemo(
    () => propsOf("pillar", (p) => ({ x: p.x, y: p.s / 2, z: p.z, sx: 0.7, sy: Math.max(0.4, p.s), sz: 0.7, rot: 0 })),
    [],
  );
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 6), []);
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 6), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const rock = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const mat = useMemo(
    () => ({
      tower: new THREE.MeshStandardMaterial({ color: "#b7c0cc", roughness: 0.42, metalness: 0.28, emissive: "#ffc98a", emissiveMap: windows, emissiveIntensity: 1.25 }),
      stone: new THREE.MeshStandardMaterial({ color: "#e4d2ae", roughness: 0.82, metalness: 0.04 }),
      industrial: new THREE.MeshStandardMaterial({ color: "#8d948f", roughness: 0.75, metalness: 0.16 }),
      neon: new THREE.MeshStandardMaterial({ color: "#243040", roughness: 0.38, metalness: 0.35, emissive: "#3ef0dc", emissiveMap: windows, emissiveIntensity: 1.7 }),
      lamp: new THREE.MeshStandardMaterial({ color: "#3a3228", roughness: 0.55 }),
      head: new THREE.MeshStandardMaterial({ color: "#fff6d0", emissive: "#ffe08a", emissiveIntensity: 4.2 }),
      palm: new THREE.MeshStandardMaterial({ color: "#6a4a32", roughness: 0.9 }),
      crown: new THREE.MeshStandardMaterial({ color: "#2f6b45", roughness: 0.75 }),
      dune: new THREE.MeshStandardMaterial({ color: "#d8c08a", roughness: 1 }),
      rock: new THREE.MeshStandardMaterial({ color: "#6a6158", roughness: 0.95 }),
      rail: new THREE.MeshStandardMaterial({ color: "#c9ccd1", metalness: 0.6, roughness: 0.35 }),
      pillar: new THREE.MeshStandardMaterial({ color: "#8a8178", roughness: 0.8 }),
    }),
    [windows],
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow>
        <planeGeometry args={[1400, 1200]} />
        <meshStandardMaterial color="#3a342c" emissive="#221c16" emissiveIntensity={0.45} roughness={1} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.02, 370]}>
        <planeGeometry args={[1100, 220]} />
        <meshStandardMaterial color="#c4ae78" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-470, -0.4, 70]}>
        <planeGeometry args={[260, 360]} />
        <meshStandardMaterial color="#143e48" roughness={0.25} metalness={0.35} />
      </mesh>
      <mesh geometry={roads} receiveShadow>
        <meshStandardMaterial color="#6a7384" emissive="#2a3142" emissiveIntensity={0.55} roughness={0.82} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <Instanced items={towers} geometry={box} material={mat.tower} />
      <Instanced items={stone} geometry={box} material={mat.stone} />
      <Instanced items={industrial} geometry={box} material={mat.industrial} />
      <Instanced items={neon} geometry={box} material={mat.neon} />
      <Instanced items={lamps} geometry={box} material={mat.lamp} />
      <Instanced items={heads} geometry={box} material={mat.head} />
      <Instanced items={palms} geometry={cyl} material={mat.palm} />
      <Instanced items={crowns} geometry={cone} material={mat.crown} />
      <Instanced items={dunes} geometry={sphere} material={mat.dune} />
      <Instanced items={rocks} geometry={rock} material={mat.rock} />
      <Instanced items={rails} geometry={box} material={mat.rail} />
      <Instanced items={pillars} geometry={box} material={mat.pillar} />
      {PROPS.filter((p) => p.kind === "sign").map((p) => (
        <group key={`${p.x}-${p.z}-${p.text}`} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[0.2, 4.2, 0.2]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <planeGeometry args={[4.2, 2.1]} />
            <meshStandardMaterial map={signs.get(p.text ?? "")} emissive="#fff4d2" emissiveMap={signs.get(p.text ?? "")} emissiveIntensity={0.95} roughness={0.45} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} position={[188 + i * 14, 0, 140]}>
          <mesh position={[0, 2.2, 7]}>
            <boxGeometry args={[0.4, 4.4, 0.4]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
          <mesh position={[0, 2.2, -7]}>
            <boxGeometry args={[0.4, 4.4, 0.4]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[0.5, 0.35, 14.6]} />
            <meshStandardMaterial color="#2a2724" />
          </mesh>
        </group>
      ))}
      <group position={[28, 0, 122]}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[7, 24]} />
          <meshStandardMaterial color="#1a1c22" metalness={0.4} roughness={0.5} />
        </mesh>
        {[
          [5, 5],
          [5, -5],
          [-5, 5],
          [-5, -5],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 2.4, z]}>
            <boxGeometry args={[0.25, 4.8, 0.25]} />
            <meshStandardMaterial color="#cbb892" />
          </mesh>
        ))}
        <mesh position={[0, 4.8, 0]}>
          <boxGeometry args={[11, 0.2, 11]} />
          <meshStandardMaterial color="#12141c" />
        </mesh>
      </group>
    </group>
  );
}

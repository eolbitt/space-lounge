"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { EARTH_POS, SUN_POS } from "@/lib/solarSystem";

type Pattern = {
  id: string;
  /** Local 2D star coords in constellation plane (side, up) before world map */
  stars: [number, number][];
  /** Edge pairs by star index */
  edges: [number, number][];
  /** Corridor frac ∈ (0,1) Sun→Earth */
  frac: number;
  /** Lateral offsets (side, up) — keep clear of planet sprites */
  side: number;
  up: number;
  scale: number;
};

/**
 * Recognizable linked-star patterns in the Sun↔Earth band.
 * Placed off the planet corridor so labels/sprites stay readable.
 * Fracs sit between packed planet slots; |side|/|up| leave a clear gap.
 */
const PATTERNS: Pattern[] = [
  {
    id: "dipper",
    stars: [
      [-3.2, -0.4],
      [-1.8, 0.2],
      [-0.6, 0.35],
      [0.5, 0.15],
      [1.4, 1.1],
      [2.6, 1.35],
      [3.4, 0.45],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [3, 6],
    ],
    frac: 0.53,
    side: -52,
    up: 54,
    scale: 3.4,
  },
  {
    id: "orion",
    stars: [
      [-2.4, 2.6],
      [2.2, 2.4],
      [-1.6, 0.15],
      [0, 0],
      [1.5, -0.1],
      [-1.8, -2.5],
      [1.9, -2.7],
      [0.2, 3.4],
    ],
    edges: [
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
      [0, 7],
      [1, 7],
    ],
    frac: 0.61,
    side: 54,
    up: -50,
    scale: 3.1,
  },
  {
    id: "cass",
    stars: [
      [-3.0, 0.2],
      [-1.5, 1.4],
      [0, 0.1],
      [1.5, 1.35],
      [3.0, 0.15],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    frac: 0.75,
    side: -50,
    up: 48,
    scale: 2.9,
  },
  {
    id: "cross",
    stars: [
      [0, 2.4],
      [0, -2.2],
      [-1.8, 0.2],
      [1.9, 0.15],
      [0.85, 0.9],
    ],
    edges: [
      [0, 1],
      [2, 3],
    ],
    frac: 0.68,
    side: 50,
    up: -46,
    scale: 2.8,
  },
  {
    id: "triangle",
    stars: [
      [0, 2.8],
      [-2.6, -1.6],
      [2.5, -1.5],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 0],
    ],
    frac: 0.84,
    side: 48,
    up: 50,
    scale: 3.2,
  },
];

/** Soft round sprite — kills default square point quads. */
function makeSoftStarTexture() {
  if (typeof document === "undefined") {
    return new THREE.Texture();
  }
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const c = size * 0.5;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(245,250,255,0.95)");
  g.addColorStop(0.48, "rgba(210,225,245,0.45)");
  g.addColorStop(0.72, "rgba(170,195,230,0.12)");
  g.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function corridorFrame() {
  const toEarth = EARTH_POS.clone().sub(SUN_POS);
  const dist = toEarth.length();
  const forward = toEarth.normalize();
  const side = new THREE.Vector3()
    .crossVectors(forward, new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = new THREE.Vector3().crossVectors(side, forward).normalize();
  return { dist, forward, side, up };
}

function patternWorld(p: Pattern) {
  const { dist, forward, side, up } = corridorFrame();
  const origin = SUN_POS.clone()
    .add(forward.clone().multiplyScalar(dist * p.frac))
    .add(side.clone().multiplyScalar(p.side))
    .add(up.clone().multiplyScalar(p.up));

  const points = p.stars.map(([sx, sy]) =>
    origin
      .clone()
      .add(side.clone().multiplyScalar(sx * p.scale))
      .add(up.clone().multiplyScalar(sy * p.scale)),
  );
  return { points, edges: p.edges };
}

export function Constellations() {
  const data = useMemo(() => {
    const linePositions: number[] = [];
    const starPositions: number[] = [];
    const starSizes: number[] = [];

    for (const pattern of PATTERNS) {
      const { points, edges } = patternWorld(pattern);
      for (let i = 0; i < points.length; i++) {
        const pt = points[i]!;
        starPositions.push(pt.x, pt.y, pt.z);
        // Slight size variation — brighter “alpha” stars a touch larger
        starSizes.push(i === 0 || i === 3 ? 1.15 : 0.85 + (i % 3) * 0.08);
      }
      for (const [a, b] of edges) {
        const pa = points[a];
        const pb = points[b];
        if (!pa || !pb) continue;
        linePositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }

    const stars = new THREE.BufferGeometry();
    stars.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    stars.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(starSizes, 1),
    );

    const lines = new THREE.BufferGeometry();
    lines.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3),
    );

    const softMap = makeSoftStarTexture();
    return { stars, lines, softMap };
  }, []);

  const starMat = useMemo(() => {
    // Custom shader so `size` attribute + round soft sprite work together
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: data.softMap },
        uColor: { value: new THREE.Color("#eef4ff") },
        uScale: { value: 180 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vAlpha = size;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Smaller on screen — soft dots, not chunky quads
          gl_PointSize = clamp(uScale * size / max(-mv.z, 1.0), 2.0, 14.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(map, gl_PointCoord);
          float a = texel.a * 0.9;
          if (a < 0.02) discard;
          gl_FragColor = vec4(uColor * texel.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, [data.softMap]);

  return (
    <group>
      {/* Hairline links — low opacity reads thinner than opaque 1px strokes */}
      <lineSegments geometry={data.lines} frustumCulled={false} renderOrder={1}>
        <lineBasicMaterial
          color="#9eb4cc"
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      {/* Soft round cores */}
      <points
        geometry={data.stars}
        material={starMat}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
}

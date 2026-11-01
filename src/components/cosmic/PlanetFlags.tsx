"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import {
  PLANET_SITES,
  isFlagVisible,
  type PlanetFlag,
} from "@/lib/planetFlags";

type Props = {
  flags: Map<string, PlanetFlag>;
  now: number;
};

/** 3D flag poles + shared text labels on major planets. */
export function PlanetFlags({ flags, now }: Props) {
  const sites = useMemo(() => PLANET_SITES, []);

  return (
    <group>
      {sites.map((site) => {
        const flag = flags.get(site.id);
        const show = isFlagVisible(flag, now);
        const tip: [number, number, number] = [
          site.pos[0],
          site.pos[1] + site.flagLift,
          site.pos[2],
        ];
        return (
          <group key={site.id} position={tip}>
            {/* Pole */}
            <mesh position={[0, -site.flagLift * 0.35, 0]}>
              <cylinderGeometry args={[0.04, 0.05, site.flagLift * 0.7, 6]} />
              <meshBasicMaterial color="#d8c8a8" toneMapped={false} />
            </mesh>
            {/* Cloth */}
            <mesh position={[0.55, 0.15, 0]}>
              <planeGeometry args={[1.1, 0.55]} />
              <meshBasicMaterial
                color={show ? "#e8f4ff" : "#9aa8b8"}
                transparent
                opacity={show ? 0.92 : 0.35}
                side={2}
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
            <Html
              center
              distanceFactor={18}
              style={{ pointerEvents: "none", userSelect: "none" }}
              zIndexRange={[20, 0]}
            >
              <div
                className="whitespace-nowrap rounded-md border border-white/25 bg-[#0a1018]/75 px-2 py-1 font-sans text-[11px] tracking-wide text-[#f2f5f8] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                style={{ minWidth: "2.5rem", textAlign: "center" }}
              >
                {show && flag?.text ? (
                  <span>{flag.text}</span>
                ) : (
                  <span className="text-[#8a9aaa]">{site.label}</span>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

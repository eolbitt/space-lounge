"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import {
  PLANET_SITES,
  isFlagVisible,
  type PlanetFlag,
  type PlanetSite,
} from "@/lib/planetFlags";

type Props = {
  flags: Map<string, PlanetFlag>;
  now: number;
  /** Optional — sun no longer uses far-click; proximity near sun only */
  onSelectPlanet?: (site: PlanetSite) => void;
};

/** 3D flag poles + shared text labels on major planets (incl. sun). */
export function PlanetFlags({ flags, now: _now }: Props) {
  const sites = useMemo(() => PLANET_SITES, []);

  return (
    <group>
      {sites.map((site) => {
        const flag = flags.get(site.id);
        const show = isFlagVisible(flag);
        const isSun = site.id === "sun";
        const tip: [number, number, number] = [
          site.pos[0],
          site.pos[1] + site.flagLift,
          site.pos[2],
        ];
        const poleLen = isSun ? 28 : site.flagLift * 0.7;
        const clothW = isSun ? 6.2 : 1.1;
        const clothH = isSun ? 3.1 : 0.55;
        return (
          <group key={site.id} position={tip}>
            <mesh position={[0, -poleLen * 0.45, 0]}>
              <cylinderGeometry
                args={[isSun ? 0.48 : 0.04, isSun ? 0.58 : 0.05, poleLen, 6]}
              />
              <meshBasicMaterial color="#d8c8a8" toneMapped={false} />
            </mesh>
            <mesh position={[clothW * 0.5, clothH * 0.2, 0]}>
              <planeGeometry args={[clothW, clothH]} />
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
              distanceFactor={isSun ? 110 : 18}
              style={{ pointerEvents: "none", userSelect: "none" }}
              zIndexRange={[20, 0]}
            >
              <div
                className="whitespace-nowrap rounded-md border border-white/25 bg-[#0a1018]/75 px-2 py-1 font-sans text-[11px] tracking-wide text-[#f2f5f8] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                style={{
                  minWidth: isSun ? "4.5rem" : "2.5rem",
                  textAlign: "center",
                  fontSize: isSun ? 20 : 11,
                  padding: isSun ? "0.4rem 0.8rem" : undefined,
                }}
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

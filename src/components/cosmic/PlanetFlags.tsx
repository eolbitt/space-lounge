"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import {
  PLANET_SITES,
  SUN_INTERACT_POS,
  isFlagVisible,
  type PlanetFlag,
  type PlanetSite,
} from "@/lib/planetFlags";

type Props = {
  flags: Map<string, PlanetFlag>;
  now: number;
  onSelectPlanet?: (site: PlanetSite) => void;
};

function FlagLabel({
  site,
  show,
  text,
  isSun,
  onSelect,
  compact,
}: {
  site: PlanetSite;
  show: boolean;
  text?: string;
  isSun: boolean;
  onSelect?: (site: PlanetSite) => void;
  compact?: boolean;
}) {
  const clickable = Boolean(onSelect);
  return (
    <Html
      center
      distanceFactor={isSun && !compact ? 110 : compact ? 28 : 18}
      style={{
        pointerEvents: clickable ? "auto" : "none",
        userSelect: "none",
      }}
      zIndexRange={[20, 0]}
    >
      <button
        type="button"
        aria-label={`${site.label} 깃발`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect?.(site);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`whitespace-nowrap rounded-md border border-white/25 bg-[#0a1018]/8 px-2 py-1 font-sans tracking-wide text-[#f2f5f8] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-sm ${
          clickable
            ? "cursor-pointer transition hover:border-white/45 hover:bg-[#121c28]/9"
            : "cursor-default"
        }`}
        style={{
          minWidth: isSun && !compact ? "5rem" : compact ? "4.2rem" : "2.5rem",
          textAlign: "center",
          fontSize: isSun && !compact ? 20 : compact ? 12 : 11,
          padding: isSun && !compact ? "0.4rem 0.8rem" : undefined,
        }}
      >
        {show && text ? (
          <span>{text}</span>
        ) : (
          <span className="text-[#9eb0c4]">
            {compact ? `${site.label} 깃발` : site.label}
          </span>
        )}
      </button>
    </Html>
  );
}

/** 3D flag poles + shared text labels on major planets (incl. sun). */
export function PlanetFlags({ flags, now: _now, onSelectPlanet }: Props) {
  const sites = useMemo(() => PLANET_SITES, []);
  const sunSite = useMemo(
    () => sites.find((s) => s.id === "sun") ?? null,
    [sites],
  );

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
            <FlagLabel
              site={site}
              show={show}
              text={flag?.text}
              isSun={isSun}
              onSelect={isSun ? onSelectPlanet : undefined}
            />
          </group>
        );
      })}

      {/* Lounge-side sun plant beacon — opens the same flag panel near spawn */}
      {sunSite && (
        <group position={SUN_INTERACT_POS}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 6]} />
            <meshBasicMaterial color="#e8d8b0" toneMapped={false} />
          </mesh>
          <mesh position={[0.55, 4.15, 0]}>
            <planeGeometry args={[1.0, 0.55]} />
            <meshBasicMaterial
              color={
                isFlagVisible(flags.get("sun")) ? "#fff4d8" : "#c8b890"
              }
              transparent
              opacity={0.88}
              side={2}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          {/* Soft ground ring so the plant zone is findable */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <ringGeometry args={[2.4, 3.1, 28]} />
            <meshBasicMaterial
              color="#f0d090"
              transparent
              opacity={0.28}
              side={2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <group position={[0, 4.6, 0]}>
            <FlagLabel
              site={sunSite}
              show={isFlagVisible(flags.get("sun"))}
              text={flags.get("sun")?.text}
              isSun
              compact
              onSelect={onSelectPlanet}
            />
          </group>
        </group>
      )}
    </group>
  );
}

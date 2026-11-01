"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Astronaut } from "./Astronaut";
import { EARTH, type CelestialBody } from "@/lib/celestial";
import { DRIFT_SPEED, LOOK_EARTH_LERP, ORBIT_SPEED } from "@/lib/constants";

export type PlayerMode = "drift" | "lookEarth" | "orbit";

type Props = {
  playerRef: React.RefObject<THREE.Group | null>;
  mode: PlayerMode;
  orbitTarget: CelestialBody | null;
  entered: boolean;
};

const keys = new Set<string>();

export function PlayerController({
  playerRef,
  mode,
  orbitTarget,
  entered,
}: Props) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const orbitAngle = useRef(0);
  const lookTarget = useRef(new THREE.Vector3());
  const camOffset = useRef(new THREE.Vector3(0, 1.2, 5.5));

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const group = playerRef.current;
    if (!group || !entered) return;

    const dt = Math.min(delta, 0.05);

    if (mode === "orbit" && orbitTarget) {
      orbitAngle.current += ORBIT_SPEED * dt;
      const r = orbitTarget.radius * 2.8;
      const cx = orbitTarget.position[0];
      const cy = orbitTarget.position[1];
      const cz = orbitTarget.position[2];
      const desired = new THREE.Vector3(
        cx + Math.cos(orbitAngle.current) * r,
        cy + Math.sin(orbitAngle.current * 0.6) * orbitTarget.radius * 0.35,
        cz + Math.sin(orbitAngle.current) * r,
      );
      group.position.lerp(desired, 1 - Math.pow(0.001, dt));
      lookTarget.current.set(cx, cy, cz);
    } else if (mode === "lookEarth") {
      const earth = new THREE.Vector3(...EARTH.position);
      const fromEarth = group.position.clone().sub(earth).normalize();
      const desired = earth
        .clone()
        .add(fromEarth.multiplyScalar(EARTH.radius * 3.2));
      desired.y += 0.8;
      group.position.lerp(desired, LOOK_EARTH_LERP);
      lookTarget.current.copy(earth);
    } else {
      // Gentle idle drift + WASD / arrows
      const wish = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) wish.z -= 1;
      if (keys.has("s") || keys.has("arrowdown")) wish.z += 1;
      if (keys.has("a") || keys.has("arrowleft")) wish.x -= 1;
      if (keys.has("d") || keys.has("arrowright")) wish.x += 1;
      if (keys.has("q") || keys.has("e")) {
        wish.y += keys.has("q") ? 1 : -1;
      }

      if (wish.lengthSq() > 0) {
        wish.normalize().multiplyScalar(DRIFT_SPEED);
        // Move relative to camera yaw
        const yaw = new THREE.Euler(0, camera.rotation.y, 0);
        wish.applyEuler(yaw);
        velocity.current.lerp(wish, 0.08);
      } else {
        // Soft autonomous drift
        const t = performance.now() * 0.00015;
        const idle = new THREE.Vector3(
          Math.sin(t) * 0.25,
          Math.sin(t * 0.7) * 0.12,
          Math.cos(t * 0.9) * 0.25,
        );
        velocity.current.lerp(idle, 0.02);
      }

      group.position.addScaledVector(velocity.current, dt * 2.2);
      lookTarget.current.copy(group.position).add(
        new THREE.Vector3(0, 0, -4).applyEuler(
          new THREE.Euler(0, camera.rotation.y, 0),
        ),
      );
    }

    // Soft follow camera
    const desiredCam = group.position.clone().add(camOffset.current);
    camera.position.lerp(desiredCam, 1 - Math.pow(0.02, dt));
    const focus = group.position.clone().add(new THREE.Vector3(0, 0.2, 0));
    if (mode === "lookEarth" || mode === "orbit") {
      camera.lookAt(lookTarget.current);
    } else {
      camera.lookAt(focus);
    }
  });

  return (
    <group ref={playerRef} position={[0, 1, 22]}>
      <Astronaut self suit="#f0f4f8" accent="#4a6a82" bob={0.035} />
    </group>
  );
}

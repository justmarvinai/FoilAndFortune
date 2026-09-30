import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Color, type Mesh, MeshBasicMaterial } from 'three';
import { useDioramaRuntime } from '../runtime';

/**
 * Procedural reflection/ambient environment from Lightformers (docs/04 §4.3): no HDRI download,
 * so no runtime network request (CLAUDE.md rule 10 — drei's `preset` would fetch from a CDN).
 *
 * The cube map is captured once; while the time of day is blending we re-capture every frame
 * (cheap at this resolution), then freeze it again. Driven by the runtime blend itself, so it
 * needs no timers.
 */
interface FormerSpec {
  day: string;
  eve: string;
  dayIntensity: number;
  eveIntensity: number;
}

const FORMERS = {
  ceiling: { day: '#FFF1DD', eve: '#FFC27E', dayIntensity: 1.0, eveIntensity: 0.55 },
  window: { day: '#CFE6FF', eve: '#3E4C9E', dayIntensity: 1.6, eveIntensity: 0.35 },
  fill: { day: '#FFE2C0', eve: '#FF9A5C', dayIntensity: 0.6, eveIntensity: 0.28 },
  floor: { day: '#C78B5A', eve: '#6B3F2A', dayIntensity: 0.35, eveIntensity: 0.18 },
  rim: { day: '#FFFFFF', eve: '#FFD3A0', dayIntensity: 2.2, eveIntensity: 0.7 },
} satisfies Record<string, FormerSpec>;

type FormerName = keyof typeof FORMERS;

const BG_DAY = new Color('#8E8A96');
const BG_EVE = new Color('#1A1A33');
const tmpA = new Color();
const tmpB = new Color();

function blendInto(target: Color, spec: FormerSpec, t: number): void {
  tmpA.set(spec.day).multiplyScalar(spec.dayIntensity);
  tmpB.set(spec.eve).multiplyScalar(spec.eveIntensity);
  target.lerpColors(tmpA, tmpB, t);
}

export function ProceduralEnvironment({ resolution }: { resolution: number }) {
  const runtime = useDioramaRuntime();
  // Capture live on mount and while day/evening is blending, then freeze (frames = 1).
  const [live, setLive] = useState(true);
  const refs = useRef<Partial<Record<FormerName, Mesh | null>>>({});
  const background = useRef<Color>(null);
  const settle = useRef({ stableFor: 0 });

  useFrame((_, delta) => {
    const t = runtime.evening;
    for (const name of Object.keys(FORMERS) as FormerName[]) {
      const mesh = refs.current[name];
      if (mesh && mesh.material instanceof MeshBasicMaterial)
        blendInto(mesh.material.color, FORMERS[name], t);
    }
    background.current?.lerpColors(BG_DAY, BG_EVE, t);
    const blending = Math.abs(runtime.evening - runtime.eveningTarget) > 0.0005;
    settle.current.stableFor = blending ? 0 : settle.current.stableFor + Math.min(delta, 0.1);
    if (blending && !live) setLive(true);
    else if (live && settle.current.stableFor > 0.4) setLive(false);
  }, -7);

  const setRef = (name: FormerName) => (mesh: Mesh | null) => {
    refs.current[name] = mesh;
  };

  return (
    <Environment resolution={resolution} frames={live ? Number.POSITIVE_INFINITY : 1}>
      <color ref={background} attach="background" args={['#6F6A78']} />
      <Lightformer
        ref={setRef('ceiling')}
        form="rect"
        position={[0, 6, 0]}
        rotation-x={Math.PI / 2}
        scale={[14, 14, 1]}
      />
      <Lightformer
        ref={setRef('window')}
        form="rect"
        position={[-6, 2.5, 2]}
        target={[0, 0, 0]}
        scale={[6, 3.5, 1]}
      />
      <Lightformer
        ref={setRef('fill')}
        form="rect"
        position={[6, 1.5, 6]}
        target={[0, 0, 0]}
        scale={[8, 3, 1]}
      />
      <Lightformer
        ref={setRef('floor')}
        form="rect"
        position={[0, -5, 0]}
        rotation-x={-Math.PI / 2}
        scale={[14, 14, 1]}
      />
      <Lightformer
        ref={setRef('rim')}
        form="rect"
        position={[-2, 3, -6]}
        target={[0, 1, 0]}
        scale={[1.4, 7, 1]}
      />
    </Environment>
  );
}

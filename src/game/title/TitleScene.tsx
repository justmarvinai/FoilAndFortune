import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Season } from '@/core/calendar';
import type { AvatarSpec } from '@/sim/state/types';
import { AvatarPortrait } from '../newgame/AvatarPortrait';

/**
 * The title backdrop (docs/05 §5.1): the Nook on Lantern Lane at dusk (docs/03 §2), drawn as
 * layered SVG in a 1600 × 1000 space anchored to the bottom center. Layers drift apart with the
 * pointer (parallax) and the whole street breathes slowly. The neon sign is the page's <h1>,
 * positioned in the same space with CSS so it always hangs on the shop.
 */

/** px per scene unit for `xMidYMax slice` (CSS mirror of the SVG scaling). */
const SCALE = 'max(calc(100vw / 1600), calc(100dvh / 1000))';
const at = (units: number) => `calc(${units} * var(--s))`;

const INK = 'var(--color-ink)';

/** Deterministic 0–1 noise so the scene renders the same every time (render purity). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43_758.545;
  return x - Math.floor(x);
}

function Layer({
  depth,
  children,
  className = '',
}: {
  depth: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`title-layer ${className}`} style={{ '--depth': depth } as CSSProperties}>
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        {children}
      </svg>
    </div>
  );
}

function windowsGrid(
  x: number,
  y: number,
  cols: number,
  rows: number,
  w: number,
  h: number,
  gap: number,
  seed: number,
) {
  const out: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = hash(seed + r * 13 + c) > 0.35;
      out.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * (w + gap)}
          y={y + r * (h + gap)}
          width={w}
          height={h}
          rx={6}
          fill={lit ? 'var(--window-warm)' : 'var(--city-near)'}
          opacity={lit ? 0.92 : 0.8}
          stroke={INK}
          strokeWidth={4}
        />,
      );
    }
  }
  return out;
}

function FarCity() {
  return (
    <Layer depth={3}>
      <circle cx="1330" cy="120" r="70" fill="var(--color-sunLight)" opacity="0.12" />
      <circle cx="1330" cy="120" r="38" fill="var(--color-sunLight)" />
      <circle cx="1346" cy="108" r="34" fill="var(--dusk-mid)" opacity="0.55" />
      <path
        d="M0 560 L60 560 L60 520 L140 520 L140 470 L180 450 L220 470 L220 540 L300 540 L300 500 L360 500 L360 430 L376 400 L392 430 L392 520 L470 520 L470 480 L560 480 L560 540 L640 540 L640 500 L720 500 L720 460 L748 360 L776 460 L776 520 L860 520 L860 470 L960 470 L960 530 L1040 530 L1040 490 L1120 490 L1120 440 L1160 420 L1200 440 L1200 520 L1290 520 L1290 470 L1370 470 L1370 530 L1460 530 L1460 490 L1540 490 L1540 540 L1600 540 L1600 1000 L0 1000 Z"
        fill="var(--city-far)"
      />
      {[90, 170, 330, 410, 520, 600, 690, 820, 900, 1000, 1080, 1170, 1240, 1320, 1410, 1500].map(
        (x, i) => (
          <rect
            key={x}
            x={x}
            y={500 + (i % 3) * 18}
            width="10"
            height="12"
            rx="2"
            fill="var(--window-warm)"
            opacity={hash(i) > 0.4 ? 0.7 : 0.15}
          />
        ),
      )}
      <circle
        cx="748"
        cy="410"
        r="14"
        fill="var(--color-sunLight)"
        opacity="0.9"
        stroke={INK}
        strokeWidth="3"
      />
    </Layer>
  );
}

function bulbs(points: [number, number][], seed: number) {
  return points.map(([x, y], i) => (
    <g
      key={`${seed}-${x}`}
      className="title-bulb"
      style={{ animationDelay: `${(hash(seed + i) * 2.4).toFixed(2)}s` }}
    >
      <circle cx={x} cy={y + 10} r="16" fill="var(--color-sun)" opacity="0.25" />
      <circle
        cx={x}
        cy={y + 10}
        r="7"
        fill={
          i % 3 === 0 ? 'var(--color-coral)' : i % 3 === 1 ? 'var(--color-sun)' : 'var(--neon-cyan)'
        }
        stroke={INK}
        strokeWidth="2.5"
      />
    </g>
  ));
}

/** Points along a quadratic catenary-ish curve for the string lights. */
function strand(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  count: number,
): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)];
  });
}

function Neighbors() {
  const left = strand(150, 330, 540, 300, 60, 7);
  const right = strand(1060, 300, 1460, 350, 60, 7);
  return (
    <Layer depth={7}>
      {/* Left: the brick café block. */}
      <rect
        x="40"
        y="320"
        width="500"
        height="460"
        fill="var(--brick)"
        stroke={INK}
        strokeWidth="6"
      />
      <rect
        x="28"
        y="300"
        width="524"
        height="34"
        rx="8"
        fill="var(--brick-dark)"
        stroke={INK}
        strokeWidth="6"
      />
      {windowsGrid(80, 360, 4, 2, 86, 92, 26, 3)}
      <rect
        x="90"
        y="600"
        width="250"
        height="160"
        rx="10"
        fill="var(--window-deep)"
        stroke={INK}
        strokeWidth="6"
      />
      <path
        d="M80 590 L350 590 L330 560 L100 560 Z"
        fill="var(--color-coral)"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect
        x="380"
        y="610"
        width="110"
        height="150"
        rx="8"
        fill="var(--brick-dark)"
        stroke={INK}
        strokeWidth="6"
      />
      {/* Right: the teal bookshop with a bay window. */}
      <rect
        x="1060"
        y="350"
        width="500"
        height="430"
        fill="var(--teal-dark)"
        stroke={INK}
        strokeWidth="6"
      />
      <rect
        x="1048"
        y="330"
        width="524"
        height="34"
        rx="8"
        fill="var(--city-near)"
        stroke={INK}
        strokeWidth="6"
      />
      {windowsGrid(1110, 390, 4, 2, 84, 86, 28, 11)}
      <path
        d="M1130 760 L1130 640 Q1260 590 1390 640 L1390 760 Z"
        fill="var(--window-warm)"
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M1260 615 L1260 760 M1130 690 L1390 690" stroke={INK} strokeWidth="5" />
      {/* String lights across the lane. */}
      <path d={`M150 330 Q345 ${315 + 60} 540 300`} fill="none" stroke={INK} strokeWidth="3" />
      <path d={`M1060 300 Q1260 ${325 + 60} 1460 350`} fill="none" stroke={INK} strokeWidth="3" />
      {bulbs(left, 1)}
      {bulbs(right, 2)}
    </Layer>
  );
}

const PACK_COLORS = [
  'var(--color-coral)',
  'var(--color-sky)',
  'var(--color-grape)',
  'var(--color-mint)',
  'var(--color-sun)',
  'var(--color-teal)',
];

function Nook({ owner }: { owner: AvatarSpec }) {
  return (
    <>
      {/* Facade, cornice and the neon sign's mounting board (the <h1> sits on top of it). */}
      <rect
        x="560"
        y="280"
        width="480"
        height="490"
        fill="var(--color-wood)"
        stroke={INK}
        strokeWidth="6"
      />
      <path d="M560 300 L1040 300" stroke="var(--color-woodDark)" strokeWidth="10" />
      <rect
        x="540"
        y="250"
        width="520"
        height="44"
        rx="10"
        fill="var(--color-woodDark)"
        stroke={INK}
        strokeWidth="6"
      />
      <g stroke={INK} strokeWidth="4">
        <line x1="640" y1="294" x2="640" y2="312" />
        <line x1="960" y1="294" x2="960" y2="312" />
      </g>
      {/* Awning with scallops. */}
      <rect
        x="575"
        y="410"
        width="450"
        height="46"
        fill="var(--color-paper)"
        stroke={INK}
        strokeWidth="6"
      />
      {Array.from({ length: 9 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative stripes.
        <rect key={i} x={575 + i * 50} y="410" width="25" height="46" fill="var(--color-teal)" />
      ))}
      <path
        d={`M575 456 ${Array.from({ length: 9 }, (_, i) => `Q${600 + i * 50} 496 ${625 + i * 50} 456`).join(' ')}`}
        fill="var(--color-teal)"
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <rect x="575" y="410" width="450" height="46" fill="none" stroke={INK} strokeWidth="6" />
      {/* Display window: warm light, shelves of packs, the owner behind the counter. */}
      <rect
        x="590"
        y="500"
        width="260"
        height="225"
        rx="10"
        fill="var(--window-deep)"
        stroke={INK}
        strokeWidth="6"
      />
      <rect x="600" y="510" width="240" height="205" rx="6" fill="var(--window-warm)" />
      {[530, 580].map((y, row) =>
        PACK_COLORS.map((color, i) => (
          <rect
            key={`${y}-${color}`}
            x={612 + i * 37 + row * 8}
            y={y}
            width="26"
            height="36"
            rx="4"
            fill={color}
            stroke={INK}
            strokeWidth="3"
          />
        )),
      )}
      <line x1="604" y1="568" x2="836" y2="568" stroke="var(--color-woodDark)" strokeWidth="6" />
      <line x1="604" y1="618" x2="836" y2="618" stroke="var(--color-woodDark)" strokeWidth="6" />
      <AvatarPortrait
        spec={owner}
        expression="happy"
        svgProps={{ x: 652, y: 552, width: 136, height: 136 }}
      />
      <rect
        x="600"
        y="680"
        width="240"
        height="38"
        fill="var(--color-woodDark)"
        stroke={INK}
        strokeWidth="5"
      />
      <path d="M612 520 L660 520 L620 600 Z" fill="white" opacity="0.25" />
      {/* Door with its little OPEN sign and bell. */}
      <rect
        x="880"
        y="490"
        width="130"
        height="275"
        rx="10"
        fill="var(--color-woodDark)"
        stroke={INK}
        strokeWidth="6"
      />
      <rect
        x="898"
        y="510"
        width="94"
        height="130"
        rx="8"
        fill="var(--window-warm)"
        stroke={INK}
        strokeWidth="5"
      />
      <path d="M915 545 L945 528 L975 545" fill="none" stroke={INK} strokeWidth="3" />
      <rect
        x="915"
        y="545"
        width="60"
        height="32"
        rx="5"
        fill="var(--color-mint)"
        stroke={INK}
        strokeWidth="4"
      />
      <circle cx="990" cy="660" r="7" fill="var(--color-sun)" stroke={INK} strokeWidth="3" />
      {/* House number and planter. */}
      <circle cx="865" cy="515" r="17" fill="var(--color-paper)" stroke={INK} strokeWidth="4" />
      <text
        x="865"
        y="523"
        textAnchor="middle"
        fontFamily="Lilita One, sans-serif"
        fontSize="22"
        fill={INK}
      >
        12
      </text>
      <rect
        x="585"
        y="728"
        width="270"
        height="34"
        rx="8"
        fill="var(--color-woodDark)"
        stroke={INK}
        strokeWidth="5"
      />
      {[608, 650, 692, 734, 776, 818].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={724}
          r={14 + (i % 2) * 4}
          fill={i % 2 ? 'var(--color-mint)' : 'var(--teal-dark)'}
          stroke={INK}
          strokeWidth="4"
        />
      ))}
      {[636, 720, 790].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={712}
          r="6"
          fill="var(--color-coral)"
          stroke={INK}
          strokeWidth="2.5"
        />
      ))}
    </>
  );
}

function Street() {
  const cobbles: ReactNode[] = [];
  for (let row = 0; row < 6; row++) {
    const y = 820 + row * 34;
    const w = 70 + row * 12;
    for (let x = -40 + (row % 2) * (w / 2); x < 1640; x += w + 10) {
      cobbles.push(
        <rect
          key={`${row}-${x}`}
          x={x}
          y={y}
          width={w}
          height={26}
          rx={12}
          fill="var(--cobble)"
          opacity={0.75}
        />,
      );
    }
  }
  return (
    <Layer depth={14}>
      <rect
        x="-50"
        y="770"
        width="1700"
        height="40"
        fill="var(--street-light)"
        stroke={INK}
        strokeWidth="6"
      />
      <rect x="-50" y="806" width="1700" height="260" fill="var(--street)" />
      {cobbles}
      {/* Lamp post with a warm pool of light. */}
      <ellipse
        className="title-lamp-glow"
        cx="400"
        cy="420"
        rx="150"
        ry="150"
        fill="var(--color-sun)"
        fillOpacity="0.16"
      />
      <ellipse
        className="title-lamp-glow"
        cx="400"
        cy="800"
        rx="170"
        ry="26"
        fill="var(--color-sun)"
        fillOpacity="0.22"
      />
      <rect
        x="392"
        y="440"
        width="16"
        height="360"
        rx="6"
        fill="var(--city-near)"
        stroke={INK}
        strokeWidth="5"
      />
      <path
        d="M372 404 L428 404 L418 446 L382 446 Z"
        fill="var(--color-sunLight)"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M366 404 L434 404 L400 380 Z"
        fill="var(--city-near)"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect
        x="380"
        y="790"
        width="40"
        height="18"
        rx="5"
        fill="var(--city-near)"
        stroke={INK}
        strokeWidth="5"
      />
      {/* A-frame chalkboard and a bench. */}
      <path
        d="M1120 800 L1150 690 L1210 690 L1240 800"
        fill="var(--color-woodDark)"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect
        x="1150"
        y="702"
        width="60"
        height="70"
        rx="6"
        fill="var(--city-near)"
        stroke={INK}
        strokeWidth="4"
      />
      <path
        d="M1160 724 Q1180 714 1200 724 M1162 744 L1198 744 M1168 758 L1192 758"
        stroke="var(--color-paper)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      <rect
        x="1290"
        y="748"
        width="190"
        height="16"
        rx="6"
        fill="var(--color-wood)"
        stroke={INK}
        strokeWidth="5"
      />
      <rect
        x="1290"
        y="720"
        width="190"
        height="16"
        rx="6"
        fill="var(--color-wood)"
        stroke={INK}
        strokeWidth="5"
      />
      <path
        d="M1306 764 L1302 800 M1464 764 L1468 800"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </Layer>
  );
}

const PARTICLE: Record<Season, { className: string; tone: string; count: number }> = {
  spring: { className: 'rounded-[60%_10%]', tone: 'bg-[var(--petal)]', count: 22 },
  summer: {
    className: 'rounded-full shadow-[0_0_12px_4px_rgb(255_229_138/0.7)]',
    tone: 'bg-sunLight',
    count: 16,
  },
  autumn: { className: 'rounded-[60%_10%]', tone: 'bg-[var(--leaf)]', count: 20 },
  winter: { className: 'rounded-full', tone: 'bg-white', count: 34 },
};

function Weather({ season }: { season: Season }) {
  const style = PARTICLE[season];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: style.count }, (_, i) => {
        const size = season === 'winter' ? 4 + hash(i) * 5 : 7 + hash(i) * 7;
        const left = `${(hash(i + 7) * 100).toFixed(1)}%`;
        const duration = 9 + hash(i + 3) * 9;
        const delay = -hash(i + 5) * duration;
        if (season === 'summer') {
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of decorative particles.
              key={i}
              className={`title-firefly ${style.className} ${style.tone}`}
              style={
                {
                  left,
                  top: `${(45 + hash(i + 9) * 45).toFixed(1)}%`,
                  width: 5,
                  height: 5,
                  animationDuration: `${(2 + hash(i) * 3).toFixed(2)}s`,
                  animationDelay: `${delay.toFixed(2)}s`,
                  '--sway': `${Math.round((hash(i + 2) - 0.5) * 90)}px`,
                } as CSSProperties
              }
            />
          );
        }
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of decorative particles.
            key={i}
            className={`title-particle ${style.className} ${style.tone}`}
            style={
              {
                left,
                width: size,
                height: size * (season === 'winter' ? 1 : 0.7),
                opacity: 0.85,
                animationDuration: `${duration.toFixed(2)}s`,
                animationDelay: `${delay.toFixed(2)}s`,
                '--sway': `${Math.round((hash(i + 2) - 0.5) * 160)}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export interface TitleSceneProps {
  owner: AvatarSpec;
  season: Season;
  /** Dims and blurs the street behind panels (New Game, Load…). */
  dimmed?: boolean;
  children?: ReactNode;
}

export function TitleScene({ owner, season, dimmed = false, children }: TitleSceneProps) {
  const { t } = useTranslation();
  const ts = useTranslation('shell').t;
  const rootRef = useRef<HTMLDivElement>(null);
  const [before, after] = t('appName').split('&');

  // Pointer parallax: write CSS variables, never React state (60 fps without re-renders).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      root.style.setProperty('--px', (-x).toFixed(3));
      root.style.setProperty('--py', (-y).toFixed(3));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div
      ref={rootRef}
      className="title-scene fixed inset-0 overflow-hidden select-none"
      style={{ '--s': SCALE } as CSSProperties}
    >
      <p className="sr-only">{ts('title.sceneLabel')}</p>
      <div
        className={`title-drift absolute inset-0 transition-[filter] duration-500 ${dimmed ? 'blur-[3px] brightness-[0.55]' : ''}`}
      >
        <div className="title-stars absolute inset-x-0 top-0 h-1/2" />
        <FarCity />
        <Neighbors />
        <div className="title-layer" style={{ '--depth': 10 } as CSSProperties}>
          <svg
            viewBox="0 0 1600 1000"
            preserveAspectRatio="xMidYMax slice"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <Nook owner={owner} />
          </svg>
          {/* The neon sign IS the page title (smoke test: <h1> "Foil & Fortune"). */}
          <div
            className="neon-board absolute flex flex-col items-center justify-center rounded-[calc(14*var(--s))] border-ink shadow-[0_0_40px_rgb(255_95_168/0.35)]"
            style={{
              left: `calc(50% - ${at(215)})`,
              top: `calc(100% - ${at(696)})`,
              width: at(430),
              height: at(98),
              borderWidth: at(6),
            }}
          >
            <h1
              className="neon-text neon-hum whitespace-nowrap font-display leading-none tracking-wide"
              style={{ fontSize: at(54) }}
            >
              {after === undefined ? (
                t('appName')
              ) : (
                <>
                  {before}
                  <span className="neon-amp">&amp;</span>
                  {after}
                </>
              )}
            </h1>
          </div>
        </div>
        <Street />
      </div>
      {dimmed ? null : <Weather season={season} />}
      {children}
    </div>
  );
}

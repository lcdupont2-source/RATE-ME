// COURBE D'ATTRAIT : "tu es plus attrayant que X % des gens" + courbe interactive
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  myScore: number;
  myVoteCount: number;
  hasPhoto: boolean;
};

// Reglages : votes minimum pour qu'une photo compte, et nombre minimum de photos pour comparer
const MIN_VOTES = 4;
const MIN_PROFILES = 5;

const W = 300;
const H = 150;
const PAD_X = 12;
const BASE = 120;
const PLOT_H = 95;
const PLOT_W = W - PAD_X * 2;
const xOf = (score: number) => PAD_X + (score / 100) * PLOT_W;

export default function AttractivenessCurve({ myScore, myVoteCount, hasPhoto }: Props) {
  const [scores, setScores] = useState<number[] | null>(null);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc('get_score_distribution', {
        p_min_votes: MIN_VOTES,
      });
      setScores((data ?? []).map((row: any) => Number(row.score)));
    };
    load();
  }, [myScore, myVoteCount]);

  // Les autres photos (la mienne est retiree de la liste)
  const others = useMemo(() => {
    if (!scores) return [];
    const list = [...scores];
    const index = list.findIndex((s) => Math.abs(s - myScore) < 0.005);
    if (index !== -1) list.splice(index, 1);
    return list;
  }, [scores, myScore]);

  const pct = (x: number): number => {
    if (others.length === 0) return 0;
    return Math.round((100 * others.filter((s) => s < x).length) / others.length);
  };

  // Courbe lissee (cloche) construite a partir des vraies notes
  const curve = useMemo(() => {
    if (!scores || scores.length === 0) return null;

    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const h = Math.max(5, 1.06 * (sd || 5) * Math.pow(n, -0.2));

    const density = (x: number) => {
      let d = 0;
      for (const s of scores) d += Math.exp(-0.5 * ((x - s) / h) ** 2);
      return d;
    };

    const points: { x: number; d: number }[] = [];
    let maxD = 0;
    for (let x = 0; x <= 100; x += 2) {
      const d = density(x);
      points.push({ x, d });
      if (d > maxD) maxD = d;
    }

    const yAt = (x: number) => BASE - (density(x) / (maxD || 1)) * PLOT_H;

    const line = points
      .map((p, i) => {
        const y = BASE - (p.d / (maxD || 1)) * PLOT_H;
        return `${i === 0 ? 'M' : 'L'}${xOf(p.x).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const area = `${line} L${xOf(100)},${BASE} L${xOf(0)},${BASE} Z`;

    return { line, area, yAt };
  }, [scores]);

  const updateHover = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const score = Math.min(100, Math.max(0, ((x - PAD_X) / PLOT_W) * 100));
    setHoverScore(score);
  };

  const card = 'bg-gray-50 rounded-xl p-5 mt-4';

  if (scores === null) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-500 text-center">Chargement du classement...</p>
      </div>
    );
  }

  if (!hasPhoto) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-600 text-center">
          Ajoute une photo pour decouvrir ton classement.
        </p>
      </div>
    );
  }

  if (myVoteCount < MIN_VOTES) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-600 text-center">
          Il te faut au moins {MIN_VOTES} votes pour voir ton classement (tu en as {myVoteCount}).
        </p>
      </div>
    );
  }

  if (scores.length < MIN_PROFILES || !curve) {
    return (
      <div className={card}>
        <p className="text-sm text-gray-600 text-center">
          Pas encore assez de profils notes pour te comparer ({scores.length}/{MIN_PROFILES}).
        </p>
      </div>
    );
  }

  const myPct = pct(myScore);
  const active = hoverScore ?? myScore;
  const markerY = curve.yAt(myScore);

  return (
    <div className={card}>
      <p className="text-center text-sm text-gray-500 mb-1">Ton classement</p>
      <p className="text-center text-gray-700 mb-1">
        Tu es plus attrayant que{' '}
        <span className="text-4xl font-bold text-indigo-600 align-middle">{myPct} %</span>{' '}
        des gens
      </p>
      <p className="text-center text-xs text-gray-500 mb-3">
        Top {Math.max(1, 100 - myPct)} % &middot; note mediane : {myScore.toFixed(0)} / 100
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none cursor-crosshair"
        style={{ touchAction: 'pan-y' }}
        onPointerMove={(e) => updateHover(e.clientX)}
        onPointerDown={(e) => updateHover(e.clientX)}
        onPointerLeave={() => setHoverScore(null)}
      >
        <defs>
          <clipPath id="attr-clip">
            <rect x={0} y={0} width={xOf(active)} height={H} />
          </clipPath>
        </defs>

        <path d={curve.area} fill="#c7d2fe" />
        <path d={curve.area} fill="#6366f1" fillOpacity={0.6} clipPath="url(#attr-clip)" />
        <path d={curve.line} fill="none" stroke="#4f46e5" strokeWidth={2} />
        <line x1={PAD_X} y1={BASE} x2={W - PAD_X} y2={BASE} stroke="#9ca3af" strokeWidth={1} />

        {/* Ma position */}
        <line
          x1={xOf(myScore)}
          y1={markerY}
          x2={xOf(myScore)}
          y2={BASE}
          stroke="#312e81"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <circle cx={xOf(myScore)} cy={markerY} r={4} fill="#312e81" />
        <text
          x={xOf(myScore)}
          y={Math.max(12, markerY - 8)}
          textAnchor="middle"
          fontSize={11}
          fontWeight="bold"
          fill="#312e81"
        >
          Toi
        </text>

        {/* Position survolee */}
        {hoverScore !== null && (
          <>
            <line
              x1={xOf(hoverScore)}
              y1={8}
              x2={xOf(hoverScore)}
              y2={BASE}
              stroke="#6b7280"
              strokeWidth={1}
            />
            <circle cx={xOf(hoverScore)} cy={curve.yAt(hoverScore)} r={3.5} fill="#4f46e5" />
          </>
        )}

        <text x={xOf(0)} y={BASE + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
          0
        </text>
        <text x={xOf(50)} y={BASE + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
          50
        </text>
        <text x={xOf(100)} y={BASE + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
          100
        </text>
      </svg>

      <p className="text-center text-sm text-gray-700 mt-2 min-h-[1.25rem]">
        {hoverScore !== null
          ? `Avec ${Math.round(hoverScore)} / 100, tu serais plus attrayant que ${pct(hoverScore)} % des gens`
          : 'Glisse ton doigt ou ta souris sur la courbe pour explorer'}
      </p>

      <p className="text-xs text-gray-400 text-center mt-3">
        Base sur {scores.length} profils notes (au moins {MIN_VOTES} votes chacun), classes selon leur note mediane.
      </p>
    </div>
  );
}
// PAGE VOTE : photo a noter, curseur, vote, signalement, consensus et proximite
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type PhotoToRate = {
  id: string;
  image_url: string;
  user_id: string;
  pseudo: string | null;
  age: number | null;
  is_public: boolean;
};

type VoteFeedback = {
  myScore: number;
  consensus: number | null;
  proximity: number | null;
};

// Nombre minimum de votes (le tien inclus) pour afficher un consensus
const MIN_VOTES_FOR_CONSENSUS = 4;

const REPORT_REASONS = [
  { value: 'not_a_person', label: 'Ne correspond pas à une personne' },
  { value: 'nudity', label: 'Nudité' },
  { value: 'violence', label: 'Contenu violent' },
  { value: 'age', label: 'Âge (personne mineure)' },
  { value: 'other', label: 'Autre raison' },
];

const getLabel = (score: number): string => {
  if (score <= 14) return 'Sans attrait particulier';
  if (score <= 29) return 'Peu seduisant';
  if (score <= 44) return 'Passable';
  if (score <= 59) return 'Moyen';
  if (score <= 74) return 'Seduisant';
  if (score <= 89) return 'Tres attrayant';
  return 'Sublime';
};

const getProximityLabel = (p: number): string => {
  if (p >= 90) return 'Pile dans le consensus !';
  if (p >= 75) return 'Tres proche du consensus';
  if (p >= 55) return 'Plutot proche du consensus';
  if (p >= 35) return 'Assez eloigne du consensus';
  return 'Tres eloigne du consensus';
};

const getProximityColor = (p: number): string => {
  if (p >= 75) return 'text-green-600';
  if (p >= 50) return 'text-amber-500';
  return 'text-red-500';
};

export default function VotePage() {
  const [photo, setPhoto] = useState<PhotoToRate | null>(null);
  const [score, setScore] = useState(50);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showZoom, setShowZoom] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [feedback, setFeedback] = useState<VoteFeedback | null>(null);
  const [animatedPct, setAnimatedPct] = useState(0);

  const fetchNextPhoto = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setFeedback(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: votedRows, error: votedError } = await supabase
      .from('ratings')
      .select('photo_id')
      .eq('voter_id', user.id);

    if (votedError) {
      console.error(votedError);
      setMessage("Erreur lors du chargement de tes votes precedents.");
      setLoading(false);
      return;
    }

    const { data: reportedRows } = await supabase
      .from('reports')
      .select('photo_id')
      .eq('reporter_id', user.id);

    const excludedIds = [
      ...(votedRows ?? []).map((r) => r.photo_id),
      ...(reportedRows ?? []).map((r) => r.photo_id),
    ];

        const { data: rawData, error } = await supabase.rpc('get_votable_photos');
    const data = (rawData ?? []).filter((p: any) => !excludedIds.includes(p.id));

    if (error) {
      console.error(error);
      setMessage("Erreur lors du chargement des photos.");
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setPhoto(null);
      setLoading(false);
      return;
    }

    const pick = data[Math.floor(Math.random() * data.length)] as any;
         const { data: ownerData } = await supabase.rpc('get_photo_owner_info', {
      p_photo_id: pick.id,
    });
    const owner = Array.isArray(ownerData) ? ownerData[0] : ownerData;

    setPhoto({
      id: pick.id,
      image_url: pick.image_url,
      user_id: pick.user_id,
      pseudo: owner?.pseudo ?? null,
      age: owner?.age ?? null,
      is_public: owner?.is_public ?? true,
    });
    setScore(50);
    setShowZoom(false);
    setShowReport(false);
    setReportReason(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNextPhoto();
  }, [fetchNextPhoto]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowZoom(false);
        setShowReport(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Animation : le pourcentage monte de 0 jusqu'a sa valeur
  useEffect(() => {
    if (!feedback || feedback.proximity === null) return;

    const target = feedback.proximity;
    const duration = 1200;
    const start = performance.now();
    let frame = 0;

    setAnimatedPct(0);

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedPct(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [feedback]);

  const handleVote = async () => {
    if (!photo) return;
    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase.rpc('submit_vote', {
      p_photo_id: photo.id,
      p_score: score,
    });

    if (error) {
      setSubmitting(false);
      setMessage(`Erreur : ${error.message}`);
      return;
    }

    // Lecture du consensus APRES le vote
    const { data: stats } = await supabase.rpc('get_vote_feedback', {
      p_photo_id: photo.id,
    });

    setSubmitting(false);

    const row = Array.isArray(stats) ? stats[0] : stats;
    let consensus: number | null = null;
    let proximity: number | null = null;

    if (row && Number(row.vote_count) >= MIN_VOTES_FOR_CONSENSUS) {
      consensus = Math.round(Number(row.average_score));
      proximity = Math.max(0, 100 - Math.abs(score - consensus));
    }

    setFeedback({ myScore: score, consensus, proximity });
  };

  const handleReport = async () => {
    if (!photo || !reportReason) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setReporting(true);

    const { error } = await supabase.from('reports').insert({
      photo_id: photo.id,
      reporter_id: user.id,
      reason: reportReason,
    });

    setReporting(false);

    // 23505 = deja signalee par cette personne : on passe simplement a la suite
    if (error && error.code !== '23505') {
      setShowReport(false);
      setMessage(`Erreur lors du signalement : ${error.message}`);
      return;
    }

    fetchNextPhoto();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  if (!photo) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-lg text-gray-600">
          Aucune nouvelle photo a noter pour le moment
        </p>
      </div>
    );
  }

  const hasConsensus =
    feedback !== null && feedback.consensus !== null && feedback.proximity !== null;

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <div
        onClick={() => setShowZoom(true)}
        className="relative rounded-xl overflow-hidden shadow-lg mb-6 cursor-zoom-in group"
      >
        <img
          src={photo.image_url}
          alt="Photo a noter"
          className="w-full h-[32rem] object-cover"
        />

        {!feedback && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowReport(true);
            }}
            className="absolute top-3 left-3 z-10 bg-black/60 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition cursor-pointer"
          >
            🚩 Signaler
          </button>
        )}

        {hasConsensus && (
          <div className="absolute top-3 left-3 z-10 bg-black/70 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
            Consensus : {feedback!.consensus}/100
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-4 z-10 pointer-events-none">
          <p className="text-xl font-semibold text-white drop-shadow">
            {photo.is_public && photo.pseudo
              ? `${photo.pseudo}${photo.age ? `, ${photo.age} ans` : ''}`
              : 'Profil anonyme'}
          </p>
        </div>
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full opacity-90 group-hover:opacity-100 transition flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          Agrandir
        </div>
      </div>

      {feedback ? (
        <>
          <div className="mb-6 text-center">
            {hasConsensus ? (
              <>
                                <div className="flex items-center justify-center gap-6 mb-5">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ta note</p>
                    <p className="text-5xl font-bold text-gray-800">{feedback.myScore}</p>
                  </div>
                  <span className="text-3xl text-gray-300">·</span>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Consensus</p>
                    <p className="text-5xl font-bold text-indigo-600">{feedback.consensus}</p>
                  </div>
                </div>

                <span
                  className={`text-4xl font-bold block ${getProximityColor(feedback.proximity as number)}`}
                >
                  {animatedPct}%
                </span>
                <p className="text-sm text-gray-500 mb-1">de proximite avec le consensus</p>
                <p className="font-medium text-gray-700">
                  {getProximityLabel(feedback.proximity as number)}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Ta note : <span className="font-semibold text-gray-700">{feedback.myScore}</span>
                </p>
                <p className="text-gray-600">
                  Vote enregistre ! Pas encore assez de votes sur cette photo pour calculer un consensus.
                </p>
              </>
            )}
          </div>

          <button
            onClick={fetchNextPhoto}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Photo suivante
          </button>
        </>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-500">0</span>
              <div className="text-center">
                <span className="text-3xl font-bold text-indigo-600 block">{score}</span>
                <span className="text-sm font-medium text-indigo-500">{getLabel(score)}</span>
              </div>
              <span className="text-sm text-gray-500">100</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <button
            onClick={handleVote}
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Envoi...' : 'Voter'}
          </button>
        </>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-red-500">{message}</p>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        ⚠️ Note : Afin de garantir des scores objectifs, les votes trop extremes ou trop eloignes du consensus global sont automatiquement ponderes ou ignores.
      </p>

      {showZoom && (
        <div
          onClick={() => setShowZoom(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={photo.image_url}
            alt="Photo agrandie"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            onClick={() => setShowZoom(false)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-10 h-10 flex items-center justify-center text-xl transition"
          >
            &times;
          </button>
        </div>
      )}

      {showReport && (
        <div
          onClick={() => setShowReport(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl"
          >
            <h2 className="text-lg font-bold mb-1">Signaler cette photo</h2>
            <p className="text-sm text-gray-500 mb-4">Pourquoi signales-tu cette photo ?</p>

            <div className="space-y-2 mb-6">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer transition ${
                    reportReason === reason.value
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason.value}
                    checked={reportReason === reason.value}
                    onChange={() => setReportReason(reason.value)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm">{reason.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason || reporting}
                className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {reporting ? 'Envoi...' : 'Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
type ScoreStatsProps = {
  medianScore: number;
  voteCount: number;
};

export default function ScoreStats({ medianScore, voteCount }: ScoreStatsProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-5 space-y-5">
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm text-gray-500">Note mediane</span>
          <span className="text-2xl font-bold text-indigo-600">
            {medianScore.toFixed(1)} / 100
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${medianScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          La moitie des votants t'ont donne plus de {medianScore.toFixed(0)}, l'autre moitie moins. Elle n'est pas tiree par les votes extremes.
        </p>
      </div>

      <p className="text-sm text-gray-500 pt-1 border-t border-gray-200">
        Base sur {voteCount} vote{voteCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
// PAGE REGLES : explication du systeme de notation (FAQ)
export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-gray-100">
      <h1 className="text-3xl font-bold mb-3 text-center text-white">
        💡 Comment ça marche ?
      </h1>
      <p className="text-center text-gray-300 mb-10 leading-relaxed">
        Découvrez comment fonctionne le système de notation de profil, garant
        d'un classement juste et sans triche.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-indigo-400">
          1. La Note globale (0 à 100)
        </h2>
        <p className="text-gray-200 leading-relaxed">
          Chaque photo de profil est notée sur 100 points par la communauté. Le
          score final n'est pas une simple moyenne : les votes des utilisateurs
          les plus objectifs ont plus d'impact sur votre note.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-indigo-400">
          2. Votre Score de Fiabilité
        </h2>
        <p className="text-gray-200 leading-relaxed mb-3">
          Pour éviter le troll et les notes injustes, le site utilise un
          algorithme de fiabilité inspiré du classement Elo :
        </p>
        <ul className="list-disc list-inside text-gray-200 space-y-2">
          <li>
            Vous notez avec objectivité ? (Proche du consensus de la
            communauté) → Votre score de fiabilité augmente et vos prochains
            votes auront plus de poids.
          </li>
          <li>
            Vous mettez des notes extrêmes ou incohérentes ? → Votre score de
            fiabilité baisse et vos votes compteront moins.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3 text-indigo-400">
          3. Les Règles du Jeu
        </h2>
        <ul className="text-gray-200 space-y-3">
          <li>
            🚫 <span className="font-semibold text-white">Pas d'auto-vote :</span>{' '}
            Impossible de noter votre propre photo.
          </li>
          <li>
            🔒 <span className="font-semibold text-white">Vote définitif :</span>{' '}
            Une fois validée, votre note ne peut plus être modifiée.
          </li>
          <li>
            ☝️ <span className="font-semibold text-white">Un seul vote par profil :</span>{' '}
            Vous ne pouvez noter chaque personne qu'une seule fois.
          </li>
          <li>
            🤝 <span className="font-semibold text-white">Respect & Bienveillance :</span>{' '}
            Les photos inappropriées ou ne respectant pas les conditions
            d'utilisation seront supprimées.
          </li>
        </ul>
      </section>
    </div>
  );
}
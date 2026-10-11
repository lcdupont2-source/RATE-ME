// PAGE PROFIL : photo, resume des infos (repliable), scores et fiabilite
'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ScoreStats from '@/components/profile/ScoreStats';
import AttractivenessCurve from '@/components/profile/AttractivenessCurve';

type ProfileData = {
  pseudo: string | null;
  age: number | null;
  is_public: boolean;
  gender: string | null;
  preference: string;
  reliability: number;
  avg_proximity: number | null;
  rated_count: number;
  photo_id: string | null;
  photo_url: string | null;
  average_score: number;
  median_score: number;
  vote_count: number;
};

const GENDER_OPTIONS = [
  { value: 'homme', label: 'Homme' },
  { value: 'femme', label: 'Femme' },
];

const PREFERENCE_OPTIONS = [
  { value: 'femme', label: 'Femmes' },
  { value: 'homme', label: 'Hommes' },
  { value: 'tous', label: 'Tout le monde' },
];

const PREFERENCE_HELP: Record<string, string> = {
  femme: 'Tu ne notes que des femmes, et tu ne peux etre note que par des femmes.',
  homme: 'Tu ne notes que des hommes, et tu ne peux etre note que par des hommes.',
  tous: 'Tu notes tout le monde, et tout le monde peut te noter.',
};

const PREFERENCE_SHORT: Record<string, string> = {
  femme: 'femmes uniquement',
  homme: 'hommes uniquement',
  tous: 'tout le monde',
};

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 py-2 text-sm rounded-lg border transition ${
            value === option.value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [pseudoInput, setPseudoInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [isPublicInput, setIsPublicInput] = useState(true);
  const [genderInput, setGenderInput] = useState<string | null>(null);
  const [preferenceInput, setPreferenceInput] = useState('tous');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showReliabilityHelp, setShowReliabilityHelp] = useState(false);
  const [showPhotoWarning, setShowPhotoWarning] = useState(false);
  const [showInfoForm, setShowInfoForm] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('pseudo, age, is_public, gender, rate_gender, rated_by_gender, reliability')
      .eq('id', user.id)
      .single();

    const { data: photoRow } = await supabase
      .from('photos')
      .select('id, image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let averageScore = 0;
    let medianScore = 0;
    let voteCount = 0;

    if (photoRow) {
      const { data: statsData } = await supabase.rpc('get_my_photo_stats');
      const statsRow = (statsData ?? []).find((s: any) => s.photo_id === photoRow.id);

      if (statsRow) {
        averageScore = Number(statsRow.average_score);
        medianScore = Number(statsRow.median_score);
        voteCount = statsRow.vote_count;
      }
    }

    // Fiabilite et proximite moyenne avec le consensus
    const { data: relData } = await supabase.rpc('get_my_reliability_stats');
    const relRow = Array.isArray(relData) ? relData[0] : relData;

    // Une seule preference : on la deduit des deux colonnes (si elles different, "tous")
    const preference =
      profileRow?.rate_gender && profileRow.rate_gender === profileRow.rated_by_gender
        ? profileRow.rate_gender
        : 'tous';

    setProfile({
      pseudo: profileRow?.pseudo ?? null,
      age: profileRow?.age ?? null,
      is_public: profileRow?.is_public ?? true,
      gender: profileRow?.gender ?? null,
      preference,
      reliability: Number(profileRow?.reliability ?? 1),
      avg_proximity:
        relRow && relRow.avg_proximity !== null && relRow.avg_proximity !== undefined
          ? Number(relRow.avg_proximity)
          : null,
      rated_count: Number(relRow?.rated_count ?? 0),
      photo_id: photoRow?.id ?? null,
      photo_url: photoRow?.image_url ?? null,
      average_score: averageScore,
      median_score: medianScore,
      vote_count: voteCount,
    });
    setPseudoInput(profileRow?.pseudo ?? '');
    setAgeInput(profileRow?.age ? String(profileRow.age) : '');
    setIsPublicInput(profileRow?.is_public ?? true);
    setGenderInput(profileRow?.gender ?? null);
    setPreferenceInput(preference);

    // Profil complet : on replie le formulaire. Sinon on le laisse ouvert.
    setShowInfoForm(!(profileRow?.pseudo && profileRow?.age && profileRow?.gender));

    setLoading(false);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ageValue = parseInt(ageInput, 10);
    if (isNaN(ageValue) || ageValue < 16 || ageValue > 120) {
      setMessage('Tu dois avoir au moins 16 ans (age entre 16 et 120).');
      return;
    }

    if (!pseudoInput.trim()) {
      setMessage('Merci de choisir un pseudo.');
      return;
    }

    if (!genderInput) {
      setMessage("Merci d'indiquer si tu es un homme ou une femme.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        pseudo: pseudoInput.trim(),
        age: ageValue,
        is_public: isPublicInput,
        gender: genderInput,
        rate_gender: preferenceInput,
        rated_by_gender: preferenceInput,
      })
      .eq('id', user.id)
      .select();

    setSaving(false);

    if (error) {
      setMessage(`Erreur : ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setMessage("Rien n'a ete enregistre : profil introuvable ou modification bloquee par Supabase.");
      return;
    }

    setMessage('Profil mis a jour');
    loadProfile();
  };

  // Ferme le formulaire sans enregistrer : on remet les valeurs d'origine
  const closeInfoForm = () => {
    if (!profile) return;
    setPseudoInput(profile.pseudo ?? '');
    setAgeInput(profile.age ? String(profile.age) : '');
    setIsPublicInput(profile.is_public);
    setGenderInput(profile.gender);
    setPreferenceInput(profile.preference);
    setMessage(null);
    setShowInfoForm(false);
  };

  // Clic sur "Changer ma photo" : avertissement d'abord s'il y a deja une photo
    const handleChangePhotoClick = () => {
    setShowPhotoWarning(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Merci de choisir une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image trop lourde (5 Mo maximum).');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploadingPhoto(true);
    setMessage(null);

    const extension = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file);

    if (uploadError) {
      setUploadingPhoto(false);
      setMessage(`Erreur d'envoi : ${uploadError.message}`);
      return;
    }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
    const newUrl = urlData.publicUrl;

    const oldPhotoId = profile.photo_id;
    const oldPhotoUrl = profile.photo_url;

    // 1. On cree la nouvelle photo (nouvel identifiant = nouvelles notes a zero)
    const { data: inserted, error: insertError } = await supabase
      .from('photos')
      .insert({ user_id: user.id, image_url: newUrl })
      .select('id')
      .single();

    if (insertError || !inserted) {
      setUploadingPhoto(false);
      setMessage(`Erreur : ${insertError ? insertError.message : 'photo non enregistree.'}`);
      return;
    }

    // 2. On supprime l'ancienne photo (ses notes partent avec elle)
    if (oldPhotoId) {
      const { data: deleted, error: deleteError } = await supabase
        .from('photos')
        .delete()
        .eq('id', oldPhotoId)
        .select();

      if (deleteError || !deleted || deleted.length === 0) {
        // On annule : on retire la nouvelle photo pour ne pas en avoir deux
        await supabase.from('photos').delete().eq('id', inserted.id);
        setUploadingPhoto(false);
        setMessage(
          `Erreur : l'ancienne photo n'a pas pu etre remplacee. ${deleteError ? deleteError.message : ''}`
        );
        return;
      }

      // 3. On essaie de supprimer l'ancien fichier du stockage (sans bloquer si ca echoue)
      if (oldPhotoUrl) {
        const marker = '/object/public/photos/';
        const index = oldPhotoUrl.indexOf(marker);
        if (index !== -1) {
          const oldPath = decodeURIComponent(oldPhotoUrl.substring(index + marker.length));
          await supabase.storage.from('photos').remove([oldPath]);
        }
      }
    }

    setUploadingPhoto(false);
    setMessage(
      oldPhotoId
        ? 'Photo mise a jour. Ta note a ete reinitialisee.'
        : 'Photo ajoutee.'
    );
    loadProfile();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-gray-600">Connecte-toi pour voir ton profil.</p>
      </div>
    );
  }

  // La fiabilite va de 0,1 a 2,0 : on la convertit sur 100
  const reliability100 = Math.round(Math.min(100, Math.max(0, (profile.reliability / 2) * 100)));

  // Le profil est complet quand pseudo, age et genre sont renseignes
  const infoComplete = !!(profile.pseudo && profile.age && profile.gender);

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Mon profil</h1>

      {profile.photo_url ? (
        <img
          src={profile.photo_url}
          alt="Ma photo"
          className="w-48 h-48 object-cover rounded-full mx-auto mb-4 shadow-lg"
        />
      ) : (
        <div className="w-48 h-48 rounded-full mx-auto mb-4 bg-gray-100 flex items-center justify-center text-gray-400">
          Aucune photo
        </div>
      )}

      <div className="text-center mb-6">
        <button
          type="button"
          onClick={handleChangePhotoClick}
          disabled={uploadingPhoto}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {uploadingPhoto
            ? 'Envoi en cours...'
            : profile.photo_url
            ? 'Changer ma photo'
            : 'Ajouter ma photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          disabled={uploadingPhoto}
          className="hidden"
        />
        {profile.photo_url && (
          <p className="text-xs text-gray-500 mt-2">
            Changer de photo remet ta note a zero.
          </p>
        )}
      </div>

      {showInfoForm ? (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Pseudo</label>
            <input
              type="text"
              value={pseudoInput}
              onChange={(e) => setPseudoInput(e.target.value)}
              placeholder="Ton pseudo"
              maxLength={30}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
            <input
              type="number"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              placeholder="Ton age"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="mb-4 bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Je suis</p>
              <OptionGroup options={GENDER_OPTIONS} value={genderInput} onChange={setGenderInput} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Je veux noter et etre note par</p>
              <OptionGroup
                options={PREFERENCE_OPTIONS}
                value={preferenceInput}
                onChange={setPreferenceInput}
              />
              <p className="text-xs text-gray-500 mt-2">{PREFERENCE_HELP[preferenceInput]}</p>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div>
              <p className="text-sm font-medium text-gray-700">
                {isPublicInput ? '🌍 Profil public' : '🔒 Profil anonyme'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isPublicInput
                  ? 'Les autres voient ton pseudo et ton age pendant le vote.'
                  : 'Les autres ne voient ni ton pseudo ni ton age, seulement ta photo.'}
              </p>
              
            </div>
            <button
              onClick={() => setIsPublicInput(!isPublicInput)}
              className={`ml-4 shrink-0 w-12 h-7 rounded-full transition relative ${
                isPublicInput ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  isPublicInput ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="mb-6 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>

            {infoComplete && (
              <button
                type="button"
                onClick={closeInfoForm}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
            )}
          </div>
        </>
      ) : (
                <div className="mb-6 text-center">
          <p className="text-xl font-semibold text-white">
            {profile.pseudo}, {profile.age} ans
          </p>
          <p className="text-sm text-gray-100 mt-1">
            {profile.gender === 'homme' ? 'Homme' : 'Femme'} &middot; Notation :{' '}
            {PREFERENCE_SHORT[profile.preference]} &middot;{' '}
            {profile.is_public ? 'Profil public' : 'Profil anonyme'}
          </p>
          <button
            type="button"
            onClick={() => setShowInfoForm(true)}
            className="mt-2 text-sm text-gray-300 hover:text-white underline"
          >
            Modifier mes informations
          </button>
        </div>
      )}

      {message && <p className="text-sm text-center text-gray-600 mb-6">{message}</p>}

      <ScoreStats
        medianScore={profile.median_score}
        voteCount={profile.vote_count}
      />

      <AttractivenessCurve
        myScore={profile.median_score}
        myVoteCount={profile.vote_count}
        hasPhoto={!!profile.photo_id}
      />

      <div className="bg-gray-50 rounded-xl p-5 mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Ton score de fiabilite</span>
          <button
            type="button"
            onClick={() => setShowReliabilityHelp(!showReliabilityHelp)}
            aria-label="Explication du score de fiabilite"
            className="w-5 h-5 rounded-full bg-gray-300 text-gray-700 text-xs font-bold hover:bg-indigo-600 hover:text-white transition"
          >
            ?
          </button>
        </div>

        {showReliabilityHelp && (
          <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg p-3 leading-relaxed space-y-2">
            <p>
              <span className="font-semibold">Fiabilite :</span> elle mesure a quel point tes notes
              sont proches de l'avis general. Un vote proche du consensus la fait monter, un vote
              extreme ou incoherent la fait baisser. Plus elle est haute, plus tes votes pesent
              dans le score des autres. Un nouveau compte commence a 50 / 100.
            </p>
            <p>
              <span className="font-semibold">Proximite moyenne :</span> pour chaque photo notee,
              on calcule 100 moins l'ecart entre ta note et le consensus, puis on fait la moyenne
              sur tous tes votes (photos avec au moins 4 votes).
            </p>
          </div>
        )}

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-gray-500">Fiabilite</span>
            <span className="text-2xl font-bold text-indigo-600">{reliability100} / 100</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${reliability100}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-baseline pt-1 border-t border-gray-200">
          <span className="text-sm text-gray-500">Proximite moyenne avec le consensus</span>
          <span className="text-xl font-semibold text-gray-800">
            {profile.avg_proximity !== null ? `${Math.round(profile.avg_proximity)} %` : '-'}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {profile.rated_count > 0
            ? `Calcule sur ${profile.rated_count} vote${profile.rated_count !== 1 ? 's' : ''}`
            : 'Pas encore assez de votes pour calculer ta proximite moyenne.'}
        </p>
      </div>

      {showPhotoWarning && (
        <div
          onClick={() => setShowPhotoWarning(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl"
          >
                       <h2 className="text-lg font-bold mb-3">
              {profile.photo_id ? '⚠️ Changer de photo ?' : '📸 Ajouter ta photo'}
            </h2>

            {profile.photo_id && (
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Ta photo porte tes notes : en la changeant, ta note mediane, ton classement et tes
                votes seront <span className="font-semibold">remis a zero</span>. Action definitive.
              </p>
            )}

            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-1">Regles de la photo</p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Ton visage humain doit etre clairement visible.</li>
                <li>Aucune nudite ni violence.</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">Toute photo non conforme sera supprimee.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPhotoWarning(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowPhotoWarning(false);
                  fileInputRef.current?.click();
                }}
                className="flex-1 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// PAGE D'ACCUEIL : connexion / inscription, puis redirection vers Mon profil
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/profile');
      } else {
        setChecking(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/profile');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(`Erreur : ${error.message}`);
      else setMessage('Compte cree avec succes ! Tu peux maintenant te connecter.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(`Erreur : ${error.message}`);
      else setMessage('Connexion reussie !');
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl mt-8">
        <h1 className="text-2xl font-bold text-center mb-2">Attractiveness Score</h1>

        <p className="text-slate-400 text-center text-sm mb-6">
          {isSignUp ? 'Cree ton compte' : 'Connecte-toi a ton compte'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              placeholder="ton@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold py-2 px-4 rounded-lg transition text-sm"
          >
            {isSignUp ? "S'inscrire" : 'Se connecter'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
            }}
            className="text-xs text-indigo-400 hover:underline"
          >
            {isSignUp
              ? 'Deja un compte ? Connecte-toi'
              : "Pas encore de compte ? S'inscrire"}
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm text-center font-medium text-indigo-400">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
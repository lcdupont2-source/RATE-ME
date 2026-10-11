'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <Link href="/" className="text-xl font-bold text-indigo-600">
        RateMe
      </Link>
      <div className="flex items-center gap-5">
        <Link href="/vote" className="text-gray-600 hover:text-indigo-600 text-sm font-medium">
          Noter
        </Link>
        <Link href="/profile" className="text-gray-600 hover:text-indigo-600 text-sm font-medium">
          Profil
        </Link>
        <Link href="/rules" className="text-gray-600 hover:text-indigo-600 text-sm font-medium">
          Règles
        </Link>
               {user ? (
          <button
            onClick={handleLogout}
            style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
            className="font-semibold text-sm px-4 py-2 rounded-lg transition hover:opacity-90"
          >
            Déconnexion
          </button>
        ) : (
          <Link
            href="/"
            style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
            className="font-semibold text-sm px-4 py-2 rounded-lg transition hover:opacity-90"
          >
            Connexion
          </Link>
        )}
      </div>
    </nav>
  );
}
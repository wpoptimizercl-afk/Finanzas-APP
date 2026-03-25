import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial session check
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setUser(session?.user ?? null);
                setSession(session);
            })
            .catch(err => {
                console.error('Auth check failed:', err);
                setUser(null);
                setSession(null);
            })
            .finally(() => {
                setLoading(false);
            });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) console.error('Error signing in:', error.message);
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error.message);
    };

    return (
        <AuthCtx.Provider value={{ user, session, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);

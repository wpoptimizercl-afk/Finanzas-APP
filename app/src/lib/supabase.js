import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const akey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValid = url.startsWith('http');

export const supabase = isValid
    ? createClient(url, akey, { auth: { persistSession: true, autoRefreshToken: true } })
    : {
        auth: {
            getSession: async () => ({ data: { session: null } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signInWithOAuth: () => alert('⚠️ Falta configurar VITE_SUPABASE_URL en .env.local'),
            signOut: async () => { }
        },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }), order: async () => ({ data: [] }), then: (cb) => cb({ data: [] }) }), maybeSingle: async () => ({ data: null }), order: async () => ({ data: [] }), then: (cb) => cb({ data: [] }) }),
            insert: async () => ({ data: null, error: null }),
            update: async () => ({ data: null, error: null }),
            upsert: () => ({ select: () => ({ single: async () => ({ data: { id: 'dummy-id' } }) }) }),
            delete: () => ({ eq: () => ({ eq: async () => ({ data: null }), then: (cb) => cb({ data: null }) }) })
        })
    };

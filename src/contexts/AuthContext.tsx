import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const MISSING_ENV = (() => {
  const missing: string[] = [];
  if (!import.meta.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
  return missing;
})();

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const envIssues = useRef(MISSING_ENV);

  useEffect(() => {
    if (envIssues.current.length > 0) {
      console.error(
        `Missing Supabase env vars: ${envIssues.current.join(", ")}. ` +
        "Create a .env file in the project root. See .env.example for reference."
      );
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = useCallback(async (email, password) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp: AuthContextValue["signUp"] = useCallback(async (email, password, fullName) => {
    if (envIssues.current.length > 0) return { error: `Missing env vars: ${envIssues.current.join(", ")}`, needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName },
      },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut: AuthContextValue["signOut"] = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword: AuthContextValue["resetPassword"] = useCallback(async (email) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error?.message ?? null;
  }, []);

  const updatePassword: AuthContextValue["updatePassword"] = useCallback(async (password) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

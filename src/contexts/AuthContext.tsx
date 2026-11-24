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

function formatAuthError(error: { message?: string; name?: string } | unknown): string {
  const rawMessage =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : error instanceof Error
      ? error.message
      : "Authentication request failed. Please try again.";
  const rawName =
    error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name
      : "";
  const lower = rawMessage.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before logging in. Check your inbox for the confirmation link.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password. If you signed up with Google, click \"Continue with Google\" or use \"Forgot password?\" to set a password.";
  }
  if (rawName === "AuthRetryableFetchError" || lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Unable to reach the authentication service. Please check your connection or reload the page and try again.";
  }
  return rawMessage;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const envIssues = useRef(MISSING_ENV);
  const backfilledName = useRef(false);

  useEffect(() => {
    if (envIssues.current.length > 0) {
      console.warn(
        `Missing Supabase env vars: ${envIssues.current.join(", ")}. ` +
        "Create a .env file in the project root. See .env.example for reference."
      );
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // After an OAuth redirect, strip the #access_token fragment from the URL
  // using replaceState so no navigation/redirect is triggered.
  useEffect(() => {
    if (!session) return;
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [session]);

  useEffect(() => {
    if (!user || backfilledName.current) return;
    const meta = user.user_metadata ?? {};
    if (meta.full_name) return;
    const name = meta.name
      ?? user.identities?.find((i) => i.provider === "google")?.identity_data?.name
      ?? user.identities?.find((i) => i.provider === "google")?.identity_data?.full_name
      ?? null;
    if (!name) return;
    backfilledName.current = true;
    supabase.auth.updateUser({ data: { full_name: name } }).catch(() => {});
  }, [user]);

  const signIn: AuthContextValue["signIn"] = useCallback(async (email, password) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return formatAuthError(error);
      }
      return null;
    } catch (err) {
      return formatAuthError(err);
    }
  }, []);

  const signUp: AuthContextValue["signUp"] = useCallback(async (email, password, fullName) => {
    if (envIssues.current.length > 0) return { error: `Missing env vars: ${envIssues.current.join(", ")}`, needsConfirmation: false };
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: fullName },
        },
      });
      if (error) return { error: formatAuthError(error), needsConfirmation: false };
      return { error: null, needsConfirmation: !data.session };
    } catch (err) {
      return { error: formatAuthError(err), needsConfirmation: false };
    }
  }, []);

  const signOut: AuthContextValue["signOut"] = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const resetPassword: AuthContextValue["resetPassword"] = useCallback(async (email) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return error ? formatAuthError(error) : null;
    } catch (err) {
      return formatAuthError(err);
    }
  }, []);

  const updatePassword: AuthContextValue["updatePassword"] = useCallback(async (password) => {
    if (envIssues.current.length > 0) return `Missing env vars: ${envIssues.current.join(", ")}`;
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? formatAuthError(error) : null;
    } catch (err) {
      return formatAuthError(err);
    }
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

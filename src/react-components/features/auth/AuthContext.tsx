import React, { createContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: "google" | "azure") => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const devAutoLoginState = useRef<"idle" | "attempting" | "settled">("idle");

  const fetchProfile = async (uid: string, retries = 3): Promise<void> => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("uid", uid)
          .single();

        if (data) {
          setProfile(data);
          return;
        }
        if (error) {
          console.warn(`Attempt ${i + 1} to fetch profile returned error:`, error.message);
        }
      } catch (err) {
        console.warn(`Attempt ${i + 1} to fetch profile threw:`, err);
      }
      // Wait 500ms before retrying to allow trigger to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.error("Failed to retrieve profile after retries.");
    setProfile(null);
  };

  useEffect(() => {
    const hasOAuthParams =
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token=") ||
      window.location.search.includes("error=");

    let isWaitingForOAuth = hasOAuthParams;
    let timeoutId: any = null;

    if (hasOAuthParams) {
      // Set a safety timeout to clear loading state in case the exchange fails or doesn't trigger onAuthStateChange
      timeoutId = setTimeout(() => {
        isWaitingForOAuth = false;
        setIsLoading((loading) => {
          if (loading) {
            console.warn("OAuth exchange timed out. Stopping loading state.");
            return false;
          }
          return loading;
        });
      }, 8000); // 8 seconds safety timeout
    }

    // 1. Recover initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        isWaitingForOAuth = false;
        fetchProfile(initialSession.user.id).finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
          setIsLoading(false);
        });
      } else if (!hasOAuthParams) {
        const devEnv = import.meta.env as unknown as {
          VITE_DEV_AUTO_LOGIN_EMAIL?: string;
          VITE_DEV_AUTO_LOGIN_PASSWORD?: string;
        };
        const devEmail = import.meta.env.DEV ? devEnv.VITE_DEV_AUTO_LOGIN_EMAIL : undefined;
        const devPassword = import.meta.env.DEV ? devEnv.VITE_DEV_AUTO_LOGIN_PASSWORD : undefined;

        if (devEmail && devPassword && devAutoLoginState.current === "idle") {
          devAutoLoginState.current = "attempting";
          const devLoginTimeoutId = setTimeout(() => {
            console.warn("Dev auto-login timed out.");
            devAutoLoginState.current = "settled";
            setIsLoading(false);
          }, 8000); // Safety timeout, mirrors the OAuth exchange timeout above.

          loginWithEmail(devEmail, devPassword)
            .catch((err) => {
              console.warn("Dev auto-login failed:", err);
            })
            .finally(() => {
              clearTimeout(devLoginTimeoutId);
              devAutoLoginState.current = "settled";
              setIsLoading(false);
            });
        } else if (!devEmail || !devPassword) {
          setIsLoading(false);
        }
        // else: a dev auto-login attempt is already in flight (or has settled) from a
        // prior invocation of this effect (e.g. React StrictMode's double-invoke in dev)
        // — let that attempt's own timeout/catch/finally resolve isLoading instead of
        // flipping it here, which would race ahead of the still-pending login.
      }
    });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        isWaitingForOAuth = false;
        // Fetch the profile in the background. We intentionally do NOT flip
        // isLoading back to true here: doing so unmounts the router mid-login
        // (see main.tsx) and caused a /login <-> /projects redirect loop.
        fetchProfile(newSession.user.id).finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
          setIsLoading(false);
        });
      } else {
        setProfile(null);
        // Only set isLoading to false if we are not currently waiting for an OAuth callback exchange
        if (!isWaitingForOAuth) {
          if (timeoutId) clearTimeout(timeoutId);
          setIsLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Automatically redirects to the application root
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const loginWithOAuth = async (provider: "google" | "azure") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading,
    isAuthenticated: !!user,
    loginWithEmail,
    signUpWithEmail,
    loginWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

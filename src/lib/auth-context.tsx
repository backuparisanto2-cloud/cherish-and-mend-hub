import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAppUser, type AppRole, type AppUser } from "@/lib/auth.functions";

type AuthContextValue = {
  session: Session | null;
  user: AppUser | null;
  role: AppRole | null;
  isOwner: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const profileQuery = useQuery({
    queryKey: ["app-user", session?.user.id ?? null],
    queryFn: () => getCurrentAppUser(),
    enabled: Boolean(session),
    staleTime: 60_000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const user = (profileQuery.data as AppUser | null) ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        role: user?.role ?? null,
        isOwner: user?.role === "owner",
        loading: !ready || (Boolean(session) && profileQuery.isLoading),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: null,
      user: null,
      role: null,
      isOwner: false,
      loading: true,
      signOut: async () => {},
    };
  }
  return context;
}

export function initialsOf(name: string, fallback = "US") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

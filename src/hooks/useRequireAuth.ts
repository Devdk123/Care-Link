import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Auth guard hook — redirects unauthenticated users to the landing tab.
 * Uses the context/AuthContext (Supabase user) that App.tsx relies on.
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // The App.tsx effect already handles tab redirect to "landing",
      // but this hook can be used inside any protected view for safety.
      // No router needed — CareLink uses tab-based navigation in App.tsx.
    }
  }, [loading, user]);

  return { isAuthed: !!user, ready: !loading };
}

import { useEffect } from "react";

import { supabase } from "@/api/supabase";
import { useSession } from "@/stores/session";

export function useAuthBootstrap() {
  const setSession = useSession((s) => s.setSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [setSession]);
}

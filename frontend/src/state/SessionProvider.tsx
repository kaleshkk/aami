import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

import type { MasterContext } from "../crypto/crypto";

type SessionState = {
  token: string | null;
  master: MasterContext | null;
};

type SessionContextValue = {
  session: SessionState;
  setSession: (next: SessionState) => void;
  clearSession: () => void;
  lockVault: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const IDLE_LOCK_MS = 60 * 1000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionState>({
    token: typeof window !== "undefined" ? localStorage.getItem("aami_token") : null,
    master: null
  });

  const idleTimerRef = useRef<number | null>(null);

  function applyTokenPersistence(token: string | null) {
    if (token) {
      localStorage.setItem("aami_token", token);
    } else {
      localStorage.removeItem("aami_token");
    }
  }

  function setSession(next: SessionState) {
    setSessionState(next);
    applyTokenPersistence(next.token);
  }

  function clearSession() {
    setSessionState({ token: null, master: null });
    applyTokenPersistence(null);
  }

  function lockVault() {
    setSessionState(prev => ({
      token: prev.token,
      master: null
    }));
  }

  useEffect(() => {
    function resetTimer() {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      if (session.master) {
        idleTimerRef.current = window.setTimeout(() => {
          lockVault();
        }, IDLE_LOCK_MS);
      }
    }

    resetTimer();

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach(evt => window.addEventListener(evt, resetTimer));

    return () => {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [session.master]);

  return (
    <SessionContext.Provider
      value={{
        session,
        setSession,
        clearSession,
        lockVault
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}



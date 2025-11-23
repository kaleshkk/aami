import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useSession } from "../../state/SessionProvider";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const { session, clearSession, lockVault } = useSession();
  const navigate = useNavigate();

  const isAuthed = !!session.token;
  const isUnlocked = !!session.master;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/vault" className="flex items-center gap-3" aria-label="Aami home">
            <img
              src="/logo.png"
              alt="Aami logo"
              className="h-8 w-8 rounded-2xl border border-cyan-500/40 shadow-lg shadow-cyan-500/30"
            />
            <span className="text-lg font-semibold tracking-tight text-slate-50">
              Aami
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link to="/vault" className="hover:text-white">
              Vault
            </Link>
            <Link to="/settings" className="hover:text-white">
              Settings
            </Link>
            {isAuthed && (
              <>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isUnlocked ? "bg-cyan-400" : "bg-yellow-400"
                    }`}
                  />
                  {isUnlocked ? "Unlocked" : "Locked"}
                </span>
                <button
                  type="button"
                  onClick={() => lockVault()}
                  className="rounded-full border border-slate-600 px-3 py-1 text-xs hover:border-slate-400"
                >
                  Lock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    navigate("/login");
                  }}
                  className="rounded-full border border-slate-600 px-3 py-1 text-xs hover:border-slate-400"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}



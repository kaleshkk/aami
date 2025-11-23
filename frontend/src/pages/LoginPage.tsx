import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useSession } from "../state/SessionProvider";
import { deriveMasterContext, fromBase64 } from "../crypto/crypto";
import { api } from "../api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [masterPassphrase, setMasterPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", email);
      form.append("password", password);
      form.append("grant_type", "password");
      const res = await api.post("/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      const token = res.data.access_token as string;

      const me = await api.get("/user/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const masterSaltB64 = me.data.master_salt as string | null;
      if (!masterSaltB64) {
        throw new Error("Master salt not found for user");
      }
      const masterSalt = fromBase64(masterSaltB64);
      const master = await deriveMasterContext(masterPassphrase, masterSalt);

      setSession({ token, master });
      navigate("/vault");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <img
          src="/logo.png"
          alt="Aami logo"
          className="h-16 w-16 rounded-3xl border border-cyan-500/50 shadow-lg shadow-cyan-500/40 mb-3"
        />
        <h1 className="text-2xl font-semibold">Sign in</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Account password</label>
          <input
            type="password"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Master passphrase</label>
          <input
            type="password"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            value={masterPassphrase}
            onChange={e => setMasterPassphrase(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Never sent to the server. Used only to derive your vault encryption keys in the browser.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-cyan-400 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-sm text-slate-400">
          No account?{" "}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}



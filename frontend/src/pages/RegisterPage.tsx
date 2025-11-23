import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useSession } from "../state/SessionProvider";
import { deriveMasterContext, getRandomBytes, toBase64 } from "../crypto/crypto";
import { api } from "../api/client";

export function RegisterPage() {
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
      const masterSalt = getRandomBytes(16);
      const masterSaltB64 = toBase64(masterSalt);

      const res = await api.post("/auth/register", {
        email,
        password,
        master_salt: masterSaltB64
      });
      const token = res.data.access_token as string;

      const master = await deriveMasterContext(masterPassphrase, masterSalt);
      setSession({ token, master });
      navigate("/vault");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Create account</h1>
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
            Used only in your browser to derive encryption keys for your vault.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-cyan-400 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}



import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { decryptOneTimePayload } from "../crypto/crypto";
import { api } from "../api/client";

type OTLinkResponse = {
  encrypted_payload: string;
  salt: string;
  iv: string;
};

type SecretField = {
  label: string;
  value: string;
  sensitive?: boolean;
};

export function OTViewPage() {
  const { id } = useParams<{ id: string }>();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [fields, setFields] = useState<SecretField[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setLoading(true);
    setTitle(null);
    setFields([]);
    try {
      const res = await api.get<OTLinkResponse>(`/ot-links/${id}`);
      const decrypted = await decryptOneTimePayload(
        res.data.encrypted_payload,
        res.data.salt,
        res.data.iv,
        passphrase
      );

      try {
        const parsed = JSON.parse(decrypted) as {
          title?: string;
          value?: string;
          fields?: SecretField[];
        };
        const otTitle = parsed.title ?? "Shared secret";
        let otFields: SecretField[] = [];
        if (parsed.fields && Array.isArray(parsed.fields)) {
          otFields = parsed.fields;
        } else if (parsed.value != null) {
          otFields = [{ label: otTitle, value: parsed.value, sensitive: true }];
        } else {
          otFields = [{ label: otTitle, value: decrypted, sensitive: true }];
        }
        setTitle(otTitle);
        setFields(otFields);
      } catch {
        setTitle("Shared secret");
        setFields([{ label: "Secret", value: decrypted, sensitive: true }]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to open link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold">One-time link</h1>
      <p className="text-sm text-slate-400">
        Enter the shared passphrase to decrypt the contents of this one-time link. Decryption happens only in your
        browser.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 border border-slate-800 rounded-lg p-4 text-sm">
        <div>
          <label className="block text-xs mb-1">Passphrase</label>
          <input
            type="password"
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
            value={passphrase}
            onChange={e => setPassphrase(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
        >
          {loading ? "Decrypting..." : "Decrypt"}
        </button>
      </form>

      {fields.length > 0 && (
        <div className="border border-slate-800 rounded-lg p-4 text-sm space-y-2">
          <div className="text-xs text-slate-400 mb-1">Decrypted secret</div>
          <div className="text-sm text-slate-200 font-semibold">{title}</div>
          <div className="mt-2 space-y-1 text-xs">
            {fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-20 text-slate-400">{field.label}</span>
                <span className="text-slate-100 font-mono break-all">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

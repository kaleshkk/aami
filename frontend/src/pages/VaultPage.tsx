import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSession } from "../state/SessionProvider";
import {
  computeTitleHmac,
  decryptSecret,
  deriveMasterContext,
  encryptSecret,
  encryptOneTimePayload,
  fromBase64,
  toBase64
} from "../crypto/crypto";
import { api } from "../api/client";

type ItemMeta = {
  id: string;
  title_hmac?: string | null;
  tags?: string[] | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type ItemDetail = ItemMeta & {
  encrypted_blob: string;
  iv: string;
  salt: string;
};

type SecretField = {
  label: string;
  value: string;
  sensitive?: boolean;
};

export function VaultPage() {
  const { session, setSession, clearSession } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [allItems, setAllItems] = useState<ItemMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ItemDetail | null>(null);
  const [decryptedFields, setDecryptedFields] = useState<SecretField[] | null>(null);
  const [decryptedTitle, setDecryptedTitle] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formFields, setFormFields] = useState<SecretField[]>([
    { label: "Username", value: "", sensitive: false },
    { label: "Password", value: "", sensitive: true }
  ]);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRevealed, setBulkRevealed] = useState<
    { id: string; title: string; fields: SecretField[] }
  >([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkPassphrase, setLinkPassphrase] = useState("");
  const [linkExpiryMinutes, setLinkExpiryMinutes] = useState(10);
  const [linkResult, setLinkResult] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [shareFieldIndexes, setShareFieldIndexes] = useState<Set<number>>(new Set());
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!session.token) {
      navigate("/login");
      return;
    }
    void loadItems();
  }, [session.token]);

  useEffect(() => {
    if (!session.master || items.length === 0) return;
    void hydrateTitles();
  }, [session.master, items]);

  async function loadItems(): Promise<ItemMeta[]> {
    try {
      setLoading(true);
      const res = await api.get<ItemMeta[]>("/items", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      setAllItems(res.data);
      setItems(res.data);
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to load items");
    } finally {
      setLoading(false);
    }
    return [];
  }

  async function hydrateTitles() {
    const missing = allItems.filter(item => !titles[item.id]);
    if (!missing.length || !session.master || !session.token) return;

    try {
      const responses = await Promise.all(
        missing.map(item =>
          api.get<ItemDetail>(`/items/${item.id}`, {
            headers: { Authorization: `Bearer ${session.token}` }
          })
        )
      );
      const next: Record<string, string> = {};
      for (const res of responses) {
        const item = res.data;
        try {
          const plaintext = await decryptSecret(
            item.encrypted_blob,
            item.iv,
            item.salt,
            session.master!
          );
          const parsed = JSON.parse(plaintext) as { title?: string };
          next[item.id] = parsed.title ?? "(untitled)";
        } catch {
          next[item.id] = "(encrypted)";
        }
      }
      setTitles(prev => ({ ...prev, ...next }));
    } catch {
      // ignore title hydration errors; list still works
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!session.master || !session.token) {
      setError("Vault is locked; unlock before creating secrets.");
      return;
    }
    setCreating(true);
    try {
      const cleanedFields = formFields.filter(f => f.label.trim() && f.value.trim());
      const payload = JSON.stringify({
        title: formTitle,
        fields: cleanedFields
      });
      const { ciphertext, iv, salt } = await encryptSecret(payload, session.master);
      const titleHmac = await computeTitleHmac(formTitle, session.master);

      await api.post(
        "/items",
        {
          encrypted_blob: ciphertext,
          iv,
          salt,
          title_hmac: titleHmac,
          tags: []
        },
        {
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );
      setFormTitle("");
      setFormFields([
        { label: "Username", value: "", sensitive: false },
        { label: "Password", value: "", sensitive: true }
      ]);
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create secret");
    } finally {
      setCreating(false);
    }
  }

  async function openItem(id: string) {
    if (!session.token) return;
    setError(null);
    setSelected(null);
    setDecryptedFields(null);
    setDecryptedTitle(null);
    setRevealed(false);
    setEditing(false);
    try {
      const res = await api.get<ItemDetail>(`/items/${id}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const item = res.data;
      setSelected(item);
      if (session.master) {
        await decryptIntoState(item);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to load secret");
    }
  }

  async function decryptIntoState(item: ItemDetail) {
    if (!session.master) return;
    const plaintext = await decryptSecret(item.encrypted_blob, item.iv, item.salt, session.master);
    try {
      const parsed = JSON.parse(plaintext) as {
        title?: string;
        value?: string;
        fields?: SecretField[];
      };
      setDecryptedTitle(parsed.title ?? "(untitled)");
      if (parsed.fields && Array.isArray(parsed.fields)) {
        setDecryptedFields(parsed.fields);
        setShareFieldIndexes(new Set(parsed.fields.map((_, idx) => idx)));
      } else if (parsed.value != null) {
        const fallback = [{ label: parsed.title ?? "Secret", value: parsed.value, sensitive: true }];
        setDecryptedFields(fallback);
        setShareFieldIndexes(new Set(fallback.map((_, idx) => idx)));
      } else {
        const fallback = [{ label: parsed.title ?? "Secret", value: plaintext, sensitive: true }];
        setDecryptedFields(fallback);
        setShareFieldIndexes(new Set(fallback.map((_, idx) => idx)));
      }
    } catch {
      setDecryptedTitle("(decrypted)");
      const fallback = [{ label: "Secret", value: plaintext, sensitive: true }];
      setDecryptedFields(fallback);
      setShareFieldIndexes(new Set(fallback.map((_, idx) => idx)));
    }
    setRevealed(false);
    window.setTimeout(() => {
      setDecryptedFields(null);
      setDecryptedTitle(null);
      setRevealed(false);
      setShareFieldIndexes(new Set());
    }, 30_000);
  }

  async function handleCopy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    window.setTimeout(async () => {
      const blank = fromBase64(toBase64(new Uint8Array(0)));
      void blank;
      await navigator.clipboard.writeText("");
    }, 10_000);
  }

  async function createOneTimeLink(e: FormEvent) {
    e.preventDefault();
    if (!selected || !session.master || !session.token) {
      setError("Select and decrypt a secret before creating an OT link.");
      return;
    }
    if (!decryptedFields || decryptedFields.length === 0) {
      setError("Secret must be visible to create an OT link.");
      return;
    }
    const indices = Array.from(shareFieldIndexes);
    if (!indices.length) {
      setError("Select at least one field to share.");
      return;
    }
    try {
      setCreatingLink(true);
      const fieldsToShare = indices
        .map(idx => decryptedFields[idx])
        .filter((f): f is SecretField => !!f);
      const payload = JSON.stringify({
        title: decryptedTitle,
        fields: fieldsToShare
      });
      const enc = await encryptOneTimePayload(payload, linkPassphrase);
      const expiry = new Date(Date.now() + linkExpiryMinutes * 60_000).toISOString();
      const res = await api.post(
        "/ot-links",
        {
          encrypted_payload: enc.payload,
          salt: enc.salt,
          iv: enc.iv,
          expiry,
          single_use: true
        },
        {
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );
      const id = res.data.id as string;
      setLinkResult(`${window.location.origin}/ot/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create OT link");
    } finally {
      setCreatingLink(false);
    }
  }

  async function saveEdit() {
    if (!selected || !session.master || !session.token || !decryptedFields) {
      setError("Nothing to save. Decrypt a secret before editing.");
      return;
    }
    setSavingEdit(true);
    try {
      const cleanedFields = decryptedFields.filter(f => f.label.trim());
      const payload = JSON.stringify({
        title: decryptedTitle ?? "",
        fields: cleanedFields
      });
      const { ciphertext, iv, salt } = await encryptSecret(payload, session.master);
      const titleHmac = await computeTitleHmac(decryptedTitle ?? "", session.master);

      await api.put(
        `/items/${selected.id}`,
        {
          encrypted_blob: ciphertext,
          iv,
          salt,
          title_hmac: titleHmac,
          tags: selected.tags ?? [],
          version: (selected.version ?? 1) + 1
        },
        {
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );

      setEditing(false);
      setSelected(null);
      setDecryptedFields(null);
      setDecryptedTitle(null);
      setRevealed(false);
      setShareFieldIndexes(new Set());
      await loadItems();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !search) {
      await loadItems();
      return;
    }
    if (!session.master) {
      setError("Unlock the vault to search by title.");
      return;
    }
    setError(null);
    setSearching(true);
    const term = search.toLowerCase();
    try {
      // Ensure we have a fresh list from the server, then filter from allItems
      let source = allItems;
      if (!source.length) {
        source = await loadItems();
      }
      const filtered = source.filter(item => {
        const title = (titles[item.id] ?? "").toLowerCase();
        // If we don't have a decrypted title yet, keep the item in results
        if (!title) return true;
        return title.includes(term);
      });
      setItems(filtered);
    } finally {
      setSearching(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function revealSelected() {
    if (!session.master || !session.token) {
      setError("Vault is locked; unlock before revealing secrets.");
      return;
    }
    try {
      const ids = Array.from(selectedIds);
      const responses = await Promise.all(
        ids.map(id =>
          api.get<ItemDetail>(`/items/${id}`, {
            headers: { Authorization: `Bearer ${session.token}` }
          })
        )
      );
      const decryptedList: { id: string; title: string; fields: SecretField[] }[] = [];
      for (const res of responses) {
        const item = res.data;
        const plaintext = await decryptSecret(item.encrypted_blob, item.iv, item.salt, session.master);
        try {
          const parsed = JSON.parse(plaintext) as {
            title?: string;
            value?: string;
            fields?: SecretField[];
          };
          const title = parsed.title ?? "(untitled)";
          const fields =
            parsed.fields && Array.isArray(parsed.fields)
              ? parsed.fields
              : parsed.value != null
              ? [{ label: title, value: parsed.value, sensitive: true }]
              : [{ label: title, value: plaintext, sensitive: true }];
          decryptedList.push({ id: item.id, title, fields });
        } catch {
          decryptedList.push({
            id: item.id,
            title: "(decrypted)",
            fields: [{ label: "Secret", value: plaintext, sensitive: true }]
          });
        }
      }
      setBulkRevealed(decryptedList);
      window.setTimeout(() => {
        setBulkRevealed([]);
      }, 30_000);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Bulk reveal failed");
    }
  }

  const locked = !!session.token && !session.master;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vault</h1>
          <p className="text-sm text-slate-400">Encrypted secrets. Only decrypted in your browser.</p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Search by title"
            className="rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-md border border-slate-600 px-3 py-1.5 hover:border-slate-400"
            disabled={searching}
          >
            {searching ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-100"
            onClick={() => {
              setSearch("");
              void loadItems();
            }}
          >
            Clear
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {locked && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-yellow-400">
            Vault is locked. Enter your master passphrase to unlock without logging out.
          </p>
          <form
            className="flex flex-col gap-2 text-xs"
            onSubmit={async e => {
              e.preventDefault();
              if (!session.token) return;
              setUnlockError(null);
              setUnlockLoading(true);
              try {
                const me = await api.get("/user/me", {
                  headers: { Authorization: `Bearer ${session.token}` }
                });
                const masterSaltB64 = me.data.master_salt as string | null;
                if (!masterSaltB64) {
                  throw new Error("No master salt stored for this user");
                }
                const masterSalt = fromBase64(masterSaltB64);
                const master = await deriveMasterContext(unlockPassphrase, masterSalt);
                setSession({ token: session.token, master });
                setUnlockPassphrase("");
              } catch (err: any) {
                const status = err?.response?.status as number | undefined;
                const detail = err?.response?.data?.detail as string | undefined;
                if (status === 401) {
                  // Session expired or invalid token – force re-login
                  clearSession();
                  setUnlockError(detail ?? "Session expired. Please sign in again.");
                  navigate("/login");
                } else {
                  setUnlockError(detail ?? err.message ?? "Failed to unlock");
                }
              } finally {
                setUnlockLoading(false);
              }
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="password"
                className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
                placeholder="Master passphrase"
                value={unlockPassphrase}
                onChange={e => setUnlockPassphrase(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={unlockLoading}
                className="rounded-md border border-slate-600 px-3 py-2 text-xs hover:border-slate-400 disabled:opacity-60"
              >
                {unlockLoading ? "Unlocking…" : "Unlock"}
              </button>
            </div>
            {unlockError && <p className="text-xs text-red-400">{unlockError}</p>}
          </form>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">New secret</h2>
            <p className="text-xs text-slate-400">Encrypted with your master key before leaving the browser.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1">Title</label>
            <input
              type="text"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              disabled={creating || locked}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs mb-1">Fields</label>
            {formFields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Label"
                  className="w-32 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                  value={field.label}
                  onChange={e => {
                    const next = [...formFields];
                    next[idx] = { ...field, label: e.target.value };
                    setFormFields(next);
                  }}
                  disabled={creating || locked}
                />
                <input
                  type={field.sensitive ? "password" : "text"}
                  placeholder="Value"
                  className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                  value={field.value}
                  onChange={e => {
                    const next = [...formFields];
                    next[idx] = { ...field, value: e.target.value };
                    setFormFields(next);
                  }}
                  disabled={creating || locked}
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={!!field.sensitive}
                    onChange={e => {
                      const next = [...formFields];
                      next[idx] = { ...field, sensitive: e.target.checked };
                      setFormFields(next);
                    }}
                    disabled={creating || locked}
                  />
                  Sensitive
                </label>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-red-400"
                  onClick={() => {
                    setFormFields(prev => prev.filter((_, i) => i !== idx));
                  }}
                  disabled={creating || locked || formFields.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-md border border-dashed border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-400"
              onClick={() =>
                setFormFields(prev => [...prev, { label: "Field", value: "", sensitive: false }])
              }
              disabled={creating || locked}
            >
              + Add field
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || locked}
          className="inline-flex items-center rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
        >
          {creating ? "Saving..." : "Save secret"}
        </button>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Secrets</span>
          <div className="flex items-center gap-3">
            {session.master && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={revealSelected}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs hover:border-slate-400"
              >
                Reveal selected
              </button>
            )}
            {loading && <span>Loading…</span>}
          </div>
        </div>
        <div className="border border-slate-800 rounded-lg divide-y divide-slate-800">
          {items.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">No items yet. Create your first secret above.</div>
          )}
          {items.map(item => {
            const checked = selectedIds.has(item.id);
            const title = titles[item.id] ?? "Encrypted secret";
            return (
              <div
                key={item.id}
                className="w-full px-4 py-3 text-sm hover:bg-slate-900 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                    checked={checked}
                    onChange={() => toggleSelected(item.id)}
                  />
                  <button
                    type="button"
                    onClick={() => openItem(item.id)}
                    className="flex-1 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-medium text-slate-100">{title}</div>
                      <div className="text-xs text-slate-500">
                        Version {item.version} • {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs text-cyan-400 ml-4">View</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bulkRevealed.length > 0 && (
        <div className="border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Bulk reveal (clears automatically)</span>
          </div>
          {bulkRevealed.map(item => (
            <div key={item.id} className="space-y-1 text-xs">
              <div className="text-slate-300">{item.title}</div>
              {item.fields.map((field, idx) => (
                <div key={idx} className="ml-2 flex items-center gap-2">
                  <span className="w-20 text-slate-400">{field.label}</span>
                  <span className="text-slate-200 font-mono">{field.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-20">
          <div className="w-full max-w-md rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Secret</h2>
                <p className="text-xs text-slate-500">
                  Decrypted locally and cleared from memory after 30 seconds.
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => {
                  setSelected(null);
                  setDecryptedFields(null);
                  setDecryptedTitle(null);
                  setRevealed(false);
                  setShareFieldIndexes(new Set());
                }}
              >
                Close
              </button>
            </div>

            {!session.master && (
              <p className="text-xs text-yellow-400">Vault locked. Unlock from login to view this secret.</p>
            )}

            {session.master && decryptedFields && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400">{decryptedTitle}</div>
                  <div className="flex items-center gap-2 text-xs">
                    {!editing && (
                      <button
                        type="button"
                        className="rounded-md border border-slate-600 px-2 py-1 hover:border-slate-400"
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </button>
                    )}
                    {editing && (
                      <>
                        <button
                          type="button"
                          className="rounded-md border border-slate-600 px-2 py-1 hover:border-slate-400 disabled:opacity-60"
                          onClick={() => void saveEdit()}
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-slate-600 px-2 py-1 hover:border-slate-400"
                          onClick={() => {
                            setEditing(false);
                            if (selected) {
                              void decryptIntoState(selected);
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {decryptedFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {editing ? (
                        <>
                          <input
                            type="text"
                            className="w-24 rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
                            value={field.label}
                            onChange={e => {
                              const next = [...decryptedFields];
                              next[idx] = { ...field, label: e.target.value };
                              setDecryptedFields(next);
                            }}
                          />
                          <input
                            type={field.sensitive ? "password" : "text"}
                            className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono"
                            value={field.value}
                            onChange={e => {
                              const next = [...decryptedFields];
                              next[idx] = { ...field, value: e.target.value };
                              setDecryptedFields(next);
                            }}
                          />
                          <label className="flex items-center gap-1 text-[11px] text-slate-400 ml-1">
                            <input
                              type="checkbox"
                              checked={!!field.sensitive}
                              onChange={e => {
                                const next = [...decryptedFields];
                                next[idx] = { ...field, sensitive: e.target.checked };
                                setDecryptedFields(next);
                              }}
                            />
                            Sensitive
                          </label>
                        </>
                      ) : (
                        <>
                          <span className="w-20 text-xs text-slate-400">{field.label}</span>
                          <div className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono">
                            {revealed && field.value ? field.value : "••••••••••••••••"}
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                            onClick={() => setRevealed(r => !r)}
                          >
                            {revealed ? "Hide" : "Reveal"}
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-slate-100 text-slate-950 px-2 py-1 text-xs hover:bg-white"
                            onClick={() => handleCopy(field.value)}
                          >
                            Copy
                          </button>
                          <label className="flex items-center gap-1 text-[11px] text-slate-400 ml-2">
                            <input
                              type="checkbox"
                              checked={shareFieldIndexes.has(idx)}
                              onChange={e => {
                                setShareFieldIndexes(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) {
                                    next.add(idx);
                                  } else {
                                    next.delete(idx);
                                  }
                                  return next;
                                });
                              }}
                            />
                            Share
                          </label>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={createOneTimeLink} className="space-y-2 border-t border-slate-800 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="One-time link passphrase"
                      className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5"
                      value={linkPassphrase}
                      onChange={e => setLinkPassphrase(e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      className="w-20 rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5"
                      value={linkExpiryMinutes}
                      onChange={e => setLinkExpiryMinutes(Number(e.target.value) || 10)}
                    />
                    <span className="text-slate-500">min</span>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingLink}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs hover:border-slate-400 disabled:opacity-60"
                  >
                    {creatingLink ? "Creating link…" : "Create one-time link"}
                  </button>
                  {linkResult && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      <div className="mb-1">Share this URL and passphrase out-of-band:</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-slate-100 break-all flex-1">{linkResult}</div>
                        <button
                          type="button"
                          className="rounded-md border border-slate-600 px-2 py-1 text-[11px] hover:border-slate-400"
                          onClick={() => handleCopy(linkResult)}
                        >
                          Copy link
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



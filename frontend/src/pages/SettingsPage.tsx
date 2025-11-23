export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-slate-400">
        Future work: account password changes, 2FA management, and recovery key generation. All flows will keep your
        master key entirely client-side.
      </p>

      <section className="space-y-2 border border-slate-800 rounded-lg p-4 text-sm">
        <h2 className="text-sm font-semibold">Two-factor authentication</h2>
        <p className="text-xs text-slate-400">
          Backend endpoints exist for 2FA but the UI wiring is intentionally minimal in this prototype. In production,
          you&apos;d scan a TOTP QR code, verify a code, and then require it at login.
        </p>
      </section>

      <section className="space-y-2 border border-slate-800 rounded-lg p-4 text-sm">
        <h2 className="text-sm font-semibold">Recovery key</h2>
        <p className="text-xs text-slate-400">
          A recovery key allows you to re-derive your master key if the master passphrase is lost. The server will only
          ever store vault data encrypted under this recovery key, never the key itself.
        </p>
      </section>
    </div>
  );
}

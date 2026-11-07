"use client";

import { useState } from "react";
import { EmailAuthError, loginWithEmail, registerWithEmail } from "@/lib/auth/emailAuth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { Icon } from "@/components/ui/Icon";

/**
 * Panel Daftar / Masuk — ditampilkan di halaman /admin bagi pengunjung yang
 * belum punya role admin/owner. Pendaftaran manual selalu ber-role "user";
 * perubahan role dilakukan owner lewat server.
 */
export function AuthAccountPanel() {
  const { toast } = useToast();
  const { uid } = useAuth();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "register") {
        if (password.length < 6) {
          setError("Password minimal 6 karakter.");
          return;
        }
        if (confirm !== password) {
          setError("Konfirmasi password tidak cocok.");
          return;
        }
        setBusy(true);
        await registerWithEmail(email, password, name);
        toast("success", "Akun terdaftar sebagai pengguna biasa. Silakan login.");
        setMode("login");
      } else {
        setBusy(true);
        await loginWithEmail(email, password);
        toast("success", "Berhasil masuk.");
      }
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof EmailAuthError ? err.message : "Operasi akun gagal. Coba lagi."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="auth-title" className="card mt-6 p-5">
      <h2 id="auth-title" className="flex items-center gap-2 text-base font-bold text-ink">
        <Icon name={mode === "register" ? "pencil" : "key"} className="h-4 w-4 text-primary" />
        {mode === "register" ? "Daftar akun" : "Masuk"}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {mode === "register" ? (
          <>
            Pendaftaran baru otomatis ber-role <strong>user biasa</strong>{" "}
            (akses confession/komentar saja). Role <strong>admin</strong> dan{" "}
            <strong>owner</strong> diberikan oleh owner setelah akunmu
            disetujui.
          </>
        ) : (
          <>Masuk menggunakan email yang sudah terdaftar.</>
        )}
      </p>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        {mode === "register" && (
          <div>
            <label htmlFor="auth-name" className="label">
              Nama (opsional)
            </label>
            <input
              id="auth-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="label">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="auth-pass" className="label">
            Password
          </label>
          <input
            id="auth-pass"
            type="password"
            required
            minLength={6}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </div>
        {mode === "register" && (
          <div>
            <label htmlFor="auth-confirm" className="label">
              Ulangi password
            </label>
            <input
              id="auth-confirm"
              type="password"
              required
              minLength={6}
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-ink">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Memproses…" : mode === "register" ? "Daftar" : "Masuk"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setError(null);
            }}
          >
            {mode === "register" ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
          </button>
        </div>
      </form>

      {uid && (
        <p className="mt-4 rounded-xl bg-surface p-3 font-mono text-[11px] text-muted">
          Sesi UID: {uid.slice(0, 10)}…{uid.slice(-4)}
        </p>
      )}
    </section>
  );
}

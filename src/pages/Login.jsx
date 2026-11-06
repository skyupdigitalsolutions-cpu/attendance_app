import { useState } from "react";
import { ArrowLeft, Clock, KeyRound, LogIn, Mail } from "lucide-react";
import { api } from "../lib/core";
import { useApp } from "../lib/app";
import { Button, Card, Field, Input, Muted } from "../components/ui";

// Three steps on one screen: sign in → request a code → set a new password.
export default function Login() {
  const { signIn, loginNote } = useApp();
  const [step, setStep] = useState("signin"); // signin | request | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState(loginNote);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setErr(""); setBusy(true);
    try { await fn(); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const submitSignIn = (e) => {
    e.preventDefault();
    run(async () => { try { await signIn(email.trim(), password); } catch (ex) { setPassword(""); throw ex; } });
  };
  const submitRequest = (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr("Enter your email.");
    run(async () => {
      const j = await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setInfo(j.message); setStep("reset");
    });
  };
  const submitReset = (e) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return setErr("Enter the 6-digit code from the email.");
    if (newPass.length < 8) return setErr("The new password must be at least 8 characters.");
    if (newPass !== confirm) return setErr("The two passwords don't match.");
    run(async () => {
      const j = await api("/auth/reset-password", { method: "POST", body: { email: email.trim(), code, password: newPass } });
      setInfo(j.message); setStep("signin"); setPassword(""); setCode(""); setNewPass(""); setConfirm("");
    });
  };
  const goSignIn = () => { setStep("signin"); setErr(""); setInfo(""); };

  return (
    <main className="grid min-h-dvh place-items-center px-4 pt-[env(safe-area-inset-top)]">
      <Card className="w-full max-w-sm p-7 shadow-xl shadow-zinc-900/5">
        {step === "signin" && (
          <form onSubmit={submitSignIn} noValidate className="flex flex-col gap-4">
            <Clock className="size-11 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Attendance Admin</h1>
              <Muted className="mt-1 text-[15px]">Sign in with your admin account for the company portal.</Muted>
            </div>
            {info && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{info}</p>}
            <Field label="Email">
              <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="-mt-2 flex justify-end">
              <button type="button" onClick={() => { setStep("request"); setErr(""); setInfo(""); }}
                className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">Forgot password?</button>
            </div>
            <p role="alert" className="min-h-5 text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>
            <Button variant="primary" size="lg" type="submit" loading={busy} icon={LogIn}>Sign in</Button>
          </form>
        )}

        {step === "request" && (
          <form onSubmit={submitRequest} noValidate className="flex flex-col gap-4">
            <Mail className="size-11 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Forgot password</h1>
              <Muted className="mt-1 text-[15px]">Enter your email. We'll send you a 6-digit code to set a new password.</Muted>
            </div>
            <Field label="Email">
              <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <p role="alert" className="min-h-5 text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>
            <Button variant="primary" size="lg" type="submit" loading={busy} icon={Mail}>Send code</Button>
            <Button variant="ghost" icon={ArrowLeft} onClick={goSignIn}>Back to sign in</Button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={submitReset} noValidate className="flex flex-col gap-4">
            <KeyRound className="size-11 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Set a new password</h1>
              <Muted className="mt-1 text-[15px]">{info || "Enter the code from the email."} Check your spam folder if it isn't in your inbox.</Muted>
            </div>
            <Field label="6-digit code">
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-xl font-bold tracking-[0.5em] tabular-nums" autoFocus />
            </Field>
            <Field label="New password" hint="(at least 8 characters)">
              <Input type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={Boolean(confirm) && confirm !== newPass} />
            </Field>
            <p role="alert" className="min-h-5 text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>
            <Button variant="primary" size="lg" type="submit" loading={busy} icon={KeyRound}>Change password</Button>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setStep("request"); setErr(""); }}>Send a new code</Button>
              <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={goSignIn}>Sign in</Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
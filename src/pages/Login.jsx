import { useState } from "react";
import { Clock, LogIn } from "lucide-react";
import { useApp } from "../lib/app";
import { Button, Card, Field, Input, Muted } from "../components/ui";

export default function Login() {
  const { signIn, loginNote } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(loginNote);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await signIn(email.trim(), password); }
    catch (ex) { setErr(ex.message); setPassword(""); }
    finally { setBusy(false); }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 pt-[env(safe-area-inset-top)]">
      <Card as="form" onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-4 p-7 shadow-xl shadow-zinc-900/5">
        <Clock className="size-11 text-brand-600 dark:text-brand-400" strokeWidth={1.75} aria-hidden />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Attendance Admin</h1>
          <Muted className="mt-1 text-[15px]">Sign in with your admin account for the company portal.</Muted>
        </div>
        <Field label="Email">
          <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <p role="alert" className="min-h-5 text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>
        <Button variant="primary" size="lg" type="submit" loading={busy} icon={LogIn}>Sign in</Button>
      </Card>
    </main>
  );
}

// Send an email to one employee through the backend's existing POST /api/email/send
// (Brevo, company template, up to 5 attachments of 10 MB).
import { useEffect, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { apiForm } from "../lib/core";
import { Button, Dialog, Field, Input, Muted, Textarea, useToast } from "./ui";

const PRESETS = [
  ["Missing punch", (n) => [`Missing punch`, `Hi ${n},\n\nOur records show a missing punch on the fingerprint machine. Please make sure you punch in and out every day, or let HR know if you were on duty.\n\nThank you.`]],
  ["Late arrival", (n) => [`Late arrival`, `Hi ${n},\n\nWe noticed late logins recently. Please plan to arrive before the start time.\n\nThank you.`]],
  ["Leave update", (n) => [`About your leave`, `Hi ${n},\n\n`]],
];

export default function SendEmail({ open, onClose, person }) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSubject(""); setBody(""); setFiles([]); setErr(""); } }, [open]);
  if (!person) return null;
  const first = (person.name || "").split(" ")[0];

  const addFiles = (list) => {
    const next = [...files, ...list].slice(0, 5);
    const big = next.find((f) => f.size > 10 * 1024 * 1024);
    if (big) return setErr(`${big.name} is larger than 10 MB.`);
    setErr(""); setFiles(next);
  };
  const send = async (e) => {
    e.preventDefault();
    if (!subject.trim()) return setErr("Enter a subject.");
    if (!body.trim()) return setErr("Write a message.");
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("user_ids", JSON.stringify([person._id]));
      fd.append("subject", subject.trim());
      fd.append("body", body.trim());
      files.forEach((f) => fd.append("attachments", f));
      const j = await apiForm("/email/send", fd);
      if (j.data?.failed) throw new Error("The email couldn't be delivered. Check the address and try again.");
      toast(`Email sent to ${person.name} (${person.email}).`);
      onClose();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Email ${person.name}`} subtitle={`To ${person.email}`} className="w-[min(620px,calc(100vw-1.5rem))]!">
      <form onSubmit={send} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([label, make]) => (
            <Button key={label} size="sm" variant="ghost" onClick={() => { const [s, b] = make(first); setSubject(s); setBody(b); }}>{label}</Button>
          ))}
        </div>
        <Field label="Subject"><Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message"><Textarea rows={8} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="flex flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            <Paperclip className="size-4" aria-hidden /> Attach files
            <input type="file" multiple className="sr-only" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-800">
                  {f.name}
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <Muted className="text-xs">Up to 5 files, 10 MB each. Sent with your company email design, from the company address.</Muted>
        </div>
        {err && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" icon={Send} loading={busy}>Send email</Button>
        </div>
      </form>
    </Dialog>
  );
}
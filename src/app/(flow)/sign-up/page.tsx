"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export default function SignUp() {
  const router = useRouter();
  const config = useQuery({ queryKey: ["config"], queryFn: () => api<{ inviteRequired: boolean }>("/config") });
  const [f, setF] = useState({ name: "", username: "", email: "", password: "", inviteCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      setBusy(false);
      return setError("Usernames are 3 to 30 characters: letters, numbers, underscores, and dots.");
    }
    const res = await authClient.signUp.email({ name: f.name.trim(), email: f.email.trim(), password: f.password, username, inviteCode: f.inviteCode.trim() } as Parameters<typeof authClient.signUp.email>[0]);
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "Couldn't create your account. Try again.");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <>
      <div className="space-y-2">
        <Logo />
        <h1 className="text-[32px] leading-tight">Create your account</h1>
        <p className="text-muted">Track food, log lifts, and train with friends.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Your name"><Input value={f.name} onChange={set("name")} autoComplete="name" required maxLength={60} /></Field>
          <Field label="Username" hint="Friends find you by this."><Input value={f.username} onChange={set("username")} autoComplete="username" autoCapitalize="none" required /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></Field>
          <Field label="Password" hint="At least 8 characters."><Input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" minLength={8} required /></Field>
          {config.data?.inviteRequired ? <Field label="Invite code" hint="Ask whoever invited you."><Input value={f.inviteCode} onChange={set("inviteCode")} autoCapitalize="none" required /></Field> : null}
          <ErrorNote error={error ? new Error(error) : null} />
          <Button type="submit" loading={busy} className="w-full">Create account</Button>
        </form>
      </Card>
      <p className="text-center text-sm text-muted">Already have an account? <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">Sign in</Link></p>
    </>
  );
}

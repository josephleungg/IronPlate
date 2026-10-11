"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function SignIn() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const value = id.trim();
    const res = value.includes("@")
      ? await authClient.signIn.email({ email: value, password })
      : await authClient.signIn.username({ username: value.toLowerCase(), password });
    setBusy(false);
    if (res.error) return setError(res.error.message ?? "That didn't work. Check your details and try again.");
    router.push("/diary");
    router.refresh();
  }

  return (
    <>
      <div className="space-y-2">
        <Logo />
        <h1 className="text-[32px] leading-tight">Welcome back</h1>
        <p className="text-muted">Pick up where you left off.</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email or username"><Input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
          <ErrorNote error={error ? new Error(error) : null} />
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
      </Card>
      <p className="text-center text-sm text-muted">New here? <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-4">Create an account</Link></p>
    </>
  );
}

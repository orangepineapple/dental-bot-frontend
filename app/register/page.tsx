"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard, buttonClass, Field } from "@/components/AuthCard";
import { login, register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const email = get("email");
    const password = String(form.get("password") ?? ""); // never trimmed
    setBusy(true);
    setError(null);
    try {
      await register({
        email,
        password,
        first_name: get("first_name"),
        last_name: get("last_name"),
        birth_date: get("birth_date"),
        phone_number: get("phone_number") || undefined,
      });
      await login(email, password);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your patient account">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" name="first_name" autoComplete="given-name" required />
          <Field label="Last name" name="last_name" autoComplete="family-name" required />
        </div>
        <Field label="Date of birth" name="birth_date" type="date" required />
        <Field label="Phone (optional)" name="phone_number" type="tel" autoComplete="tel" />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className={buttonClass} disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-500">
        Already registered?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

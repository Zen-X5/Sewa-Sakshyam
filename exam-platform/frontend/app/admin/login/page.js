"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiRequest } from "../../../lib/api";
import { saveAuth } from "../../../lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await apiRequest("/auth/login", {
        method: "POST",
        body: { ...form, role: "admin" },
        skipAuth: true,
      });

      saveAuth(payload);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-wrapper">
      <form className="card auth-card stack" onSubmit={handleSubmit}>
        <h1 className="title">Admin Login</h1>

        <input
          className="input"
          type="email"
          placeholder="Admin email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />

        <input
          className="input"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />

        <button className="button" disabled={loading} type="submit">
          {loading ? "Logging in..." : "Login"}
        </button>

        {error ? <p className="error">{error}</p> : null}

        <Link href="/">Back to home</Link>
      </form>
    </main>
  );
}

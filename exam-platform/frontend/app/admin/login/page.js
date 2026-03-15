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
    <main className="gov-login-wrapper">
      <div className="gov-login-box">

        {/* Header strip */}
        <div className="gov-login-header">
          <span className="gov-login-brand">Sewa Sakshyam</span>
          <span className="gov-login-badge">ADMIN</span>
        </div>

        {/* Form body */}
        <div className="gov-login-body">
          <h1 className="gov-login-title">Administrator Login</h1>
          <p className="gov-login-sub">Restricted access. Authorised personnel only.</p>

          <form className="stack" onSubmit={handleSubmit}>
            <div className="gov-field">
              <label className="gov-label" htmlFor="admin-email">Official Email</label>
              <input
                className="input"
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </div>

            <div className="gov-field">
              <label className="gov-label" htmlFor="admin-password">Password</label>
              <input
                className="input"
                id="admin-password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </div>

            {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}

            <button className="button gov-login-btn" disabled={loading} type="submit">
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="gov-login-footer">
          <Link href="/">← Back to Home</Link>
        </div>
      </div>
    </main>
  );
}

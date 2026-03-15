"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginDeprecatedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);

  return (
    <div className="stu-shell">
      <header className="stu-header">
        <div className="stu-header-inner">
          <div>
            <div className="stu-brand">Sewa Sakshyam</div>
            <div className="stu-brand-sub">Candidate Examination Portal</div>
          </div>
        </div>
      </header>
      <main className="stu-main">
        <div className="stu-card">
          <p className="stu-muted">Student login is no longer required. Redirecting...</p>
        </div>
      </main>
    </div>
  );
}

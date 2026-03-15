"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InstructionsRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/student/start/${params.examId}`);
  }, [params.examId, router]);

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
          <p className="stu-muted">Redirecting to exam start page...</p>
        </div>
      </main>
    </div>
  );
}

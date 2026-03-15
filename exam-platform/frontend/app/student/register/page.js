"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentRegisterDeprecatedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);

  return (
    <main className="container">
      <p>Student registration page is replaced by Start Exam flow. Redirecting...</p>
    </main>
  );
}

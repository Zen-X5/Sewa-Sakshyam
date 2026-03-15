"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginDeprecatedPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);

  return (
    <main className="container">
      <p>Student login is no longer required. Redirecting...</p>
    </main>
  );
}

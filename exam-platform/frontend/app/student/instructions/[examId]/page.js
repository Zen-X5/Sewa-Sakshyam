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
    <main className="container">
      <p>Redirecting to start page...</p>
    </main>
  );
}

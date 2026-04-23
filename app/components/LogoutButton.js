"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className, returnTo = "/auth" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push(returnTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button className={className} onClick={handleLogout} type="button">
      {pending ? "처리 중..." : "로그아웃"}
    </button>
  );
}

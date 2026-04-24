"use client";

import { useState } from "react";

export default function LogoutButton({ className, returnTo = "/auth" }) {
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
    } finally {
      if (typeof window !== "undefined") {
        window.location.assign(returnTo);
      }
    }
  }

  return (
    <button className={className} onClick={handleLogout} type="button">
      {pending ? "처리 중..." : "로그아웃"}
    </button>
  );
}

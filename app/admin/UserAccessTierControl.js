"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./user-access-tier-control.module.css";

export default function UserAccessTierControl({ user }) {
  const router = useRouter();
  const [value, setValue] = useState(user.accessTier || "member");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  if (user.role === "admin") {
    return <span className={styles.fixedTier}>관리자 전체 기능</span>;
  }

  async function handleSave() {
    if (pending) {
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}/access-tier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessTier: value,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "저장하지 못했습니다.");
        return;
      }

      setMessage("저장됨");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.control}>
      <select
        className={styles.select}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      >
        <option value="member">회원</option>
        <option value="paid">유료</option>
      </select>
      <button
        className={styles.button}
        disabled={pending}
        onClick={handleSave}
        type="button"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
      {message ? <span className={styles.message}>{message}</span> : null}
    </div>
  );
}

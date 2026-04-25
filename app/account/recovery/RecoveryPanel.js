"use client";

import { useState } from "react";
import styles from "./recovery.module.css";

const INITIAL_FIND_FORM = {
  name: "",
};

const INITIAL_RESET_FORM = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function formatRole(role) {
  return role === "admin" ? "관리자" : "회원";
}

function formatDate(value) {
  if (!value) {
    return "가입일 기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function RecoveryPanel() {
  const [findForm, setFindForm] = useState(INITIAL_FIND_FORM);
  const [resetForm, setResetForm] = useState(INITIAL_RESET_FORM);
  const [findPending, setFindPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [findError, setFindError] = useState("");
  const [resetError, setResetError] = useState("");
  const [findResult, setFindResult] = useState(null);
  const [resetMessage, setResetMessage] = useState("");

  async function handleFindSubmit(event) {
    event.preventDefault();

    if (findPending) {
      return;
    }

    setFindPending(true);
    setFindError("");
    setFindResult(null);

    try {
      const response = await fetch("/api/auth/find-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(findForm),
      });
      const result = await response.json();

      if (!response.ok) {
        setFindError(result.error || "아이디를 찾지 못했습니다.");
        return;
      }

      setFindResult(result.matches || []);
    } catch (error) {
      console.error(error);
      setFindError("서버에 연결하지 못했습니다.");
    } finally {
      setFindPending(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();

    if (resetPending) {
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setResetError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    setResetPending(true);
    setResetError("");
    setResetMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: resetForm.name,
          email: resetForm.email,
          password: resetForm.password,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setResetError(result.error || "비밀번호를 재설정하지 못했습니다.");
        return;
      }

      setResetMessage(result.message || "비밀번호가 재설정되었습니다.");
      setResetForm(INITIAL_RESET_FORM);
    } catch (error) {
      console.error(error);
      setResetError("서버에 연결하지 못했습니다.");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardEyebrow}>아이디 찾기</p>
          <h2 className={styles.cardTitle}>가입한 이름을 입력하세요</h2>
        </div>

        <form className={styles.form} onSubmit={handleFindSubmit}>
          <label className={styles.field}>
            <span>이름</span>
            <input
              autoComplete="name"
              name="find-name"
              onChange={(event) =>
                setFindForm({ ...findForm, name: event.target.value })
              }
              placeholder="가입한 이름"
              required
              type="text"
              value={findForm.name}
            />
          </label>

          {findError ? <p className={styles.error}>{findError}</p> : null}

          <button className={styles.primaryButton} disabled={findPending} type="submit">
            {findPending ? "확인 중..." : "아이디 찾기"}
          </button>
        </form>

        {Array.isArray(findResult) ? (
          <div className={styles.resultBox}>
            {findResult.length === 0 ? (
              <p className={styles.muted}>일치하는 계정이 없습니다.</p>
            ) : (
              <ul className={styles.resultList}>
                {findResult.map((item, index) => (
                  <li key={`${item.maskedEmail}-${index}`}>
                    <strong>{item.maskedEmail}</strong>
                    <span>
                      {formatRole(item.role)} · {formatDate(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardEyebrow}>비밀번호 찾기</p>
          <h2 className={styles.cardTitle}>새 비밀번호를 설정하세요</h2>
        </div>

        <form className={styles.form} onSubmit={handleResetSubmit}>
          <label className={styles.field}>
            <span>이름</span>
            <input
              autoComplete="name"
              name="reset-name"
              onChange={(event) =>
                setResetForm({ ...resetForm, name: event.target.value })
              }
              placeholder="가입한 이름"
              required
              type="text"
              value={resetForm.name}
            />
          </label>

          <label className={styles.field}>
            <span>이메일</span>
            <input
              autoComplete="email"
              name="reset-email"
              onChange={(event) =>
                setResetForm({ ...resetForm, email: event.target.value })
              }
              placeholder="name@example.com"
              required
              type="email"
              value={resetForm.email}
            />
          </label>

          <label className={styles.field}>
            <span>새 비밀번호</span>
            <input
              autoComplete="new-password"
              name="reset-password"
              onChange={(event) =>
                setResetForm({ ...resetForm, password: event.target.value })
              }
              placeholder="영문, 숫자, 특수문자 포함 10자 이상"
              required
              type="password"
              value={resetForm.password}
            />
          </label>

          <label className={styles.field}>
            <span>새 비밀번호 확인</span>
            <input
              autoComplete="new-password"
              name="reset-confirm-password"
              onChange={(event) =>
                setResetForm({
                  ...resetForm,
                  confirmPassword: event.target.value,
                })
              }
              placeholder="새 비밀번호 다시 입력"
              required
              type="password"
              value={resetForm.confirmPassword}
            />
          </label>

          {resetError ? <p className={styles.error}>{resetError}</p> : null}
          {resetMessage ? <p className={styles.success}>{resetMessage}</p> : null}

          <button className={styles.primaryButton} disabled={resetPending} type="submit">
            {resetPending ? "변경 중..." : "비밀번호 재설정"}
          </button>
        </form>
      </section>
    </div>
  );
}

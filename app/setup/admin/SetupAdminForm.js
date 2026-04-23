"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./setup.module.css";

export default function SetupAdminForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (pending) {
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/setup/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "관리자 설정을 완료하지 못했습니다.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (networkError) {
      console.error(networkError);
      setError("서버와 통신하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.eyebrow}>Administrator Bootstrap</div>
        <h1 className={styles.title}>첫 관리자 계정을 생성합니다.</h1>
        <p className={styles.text}>
          이 단계는 한 번만 열립니다. 생성된 계정은 관리자 페이지 접근, 가입자 조회, 운영 보안 점검에 사용됩니다.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-name">
              관리자 이름
            </label>
            <input
              className={styles.input}
              id="setup-name"
              name="name"
              onChange={handleChange}
              required
              value={form.name}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-email">
              관리자 이메일
            </label>
            <input
              className={styles.input}
              id="setup-email"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={form.email}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-password">
              비밀번호
            </label>
            <input
              className={styles.input}
              id="setup-password"
              name="password"
              onChange={handleChange}
              placeholder="영문, 숫자, 특수문자 포함 10자 이상"
              required
              type="password"
              value={form.password}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="setup-password-confirm">
              비밀번호 확인
            </label>
            <input
              className={styles.input}
              id="setup-password-confirm"
              name="confirmPassword"
              onChange={handleChange}
              required
              type="password"
              value={form.confirmPassword}
            />
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.actions}>
            <button className={styles.submit} disabled={pending} type="submit">
              {pending ? "생성 중..." : "관리자 계정 만들기"}
            </button>
            <Link className={styles.linkButton} href="/auth">
              계정 센터로
            </Link>
          </div>
        </form>

        <div className={styles.notes}>
          비밀번호는 해시로 저장되고, 로그인 세션은 HttpOnly 쿠키로 발급됩니다. 관리자 계정 생성이 끝나면 이 초기 설정 화면은 더 이상 열리지 않습니다.
        </div>
      </section>
    </main>
  );
}

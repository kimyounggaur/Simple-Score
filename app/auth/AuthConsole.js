"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import LogoutButton from "../components/LogoutButton";
import styles from "./auth.module.css";

const MODE_LABELS = {
  register: "회원가입",
  member: "회원 로그인",
  admin: "관리자 로그인",
};

function getInitialState() {
  return {
    name: "",
    email: "",
    password: "",
  };
}

export default function AuthConsole({
  adminSetupRequired,
  currentUser,
  initialMode,
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registerForm, setRegisterForm] = useState(getInitialState());
  const [memberForm, setMemberForm] = useState(getInitialState());
  const [adminForm, setAdminForm] = useState(getInitialState());

  const activeForm = useMemo(() => {
    if (mode === "register") {
      return registerForm;
    }

    return mode === "admin" ? adminForm : memberForm;
  }, [adminForm, memberForm, mode, registerForm]);

  function updateForm(nextValue) {
    if (mode === "register") {
      setRegisterForm(nextValue);
      return;
    }

    if (mode === "admin") {
      setAdminForm(nextValue);
      return;
    }

    setMemberForm(nextValue);
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    updateForm({
      ...activeForm,
      [name]: value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (pending) {
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");

    const endpoint =
      mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      mode === "register"
        ? registerForm
        : {
            email: activeForm.email,
            password: activeForm.password,
            loginType: mode === "admin" ? "admin" : "member",
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "요청을 처리하지 못했습니다.");
        return;
      }

      setSuccess(result.message || "완료되었습니다.");
      router.push(result.user?.role === "admin" ? "/admin" : "/");
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
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>Lesson Designer Access</div>
          <h1 className={styles.heroTitle}>
            회원 로그인, 관리자 로그인, 가입자 관리까지 한 흐름으로 묶었습니다.
          </h1>
          <p className={styles.heroText}>
            일반 사용자는 회원가입 후 바로 악보 편집기에 들어갈 수 있고, 관리자 계정은 별도 권한으로 가입자 현황과 보안 상태를 확인할 수 있습니다.
          </p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.featureTitle}>회원 전용 접근</span>
              로그인하지 않으면 편집기로 바로 들어가지 않도록 막아 두었습니다.
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureTitle}>가입자 DB</span>
              가입자 정보는 로컬 DB 파일에 저장되고, 비밀번호는 해시로만 보관됩니다.
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureTitle}>관리자 보호</span>
              첫 관리자만 초기 설정으로 만들고, 이후에는 관리자 로그인으로만 접근합니다.
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.eyebrow}>Account Console</div>
          <h2 className={styles.panelTitle}>보안 계정 센터</h2>
          <p className={styles.panelText}>
            회원은 편집기 접근용 계정, 관리자는 운영 전용 계정으로 분리되어 있습니다.
          </p>

          {currentUser ? (
            <div className={styles.sessionCard}>
              <h3 className={styles.sessionTitle}>
                현재 {currentUser.name} 님으로 로그인되어 있습니다.
              </h3>
              <p className={styles.panelText}>
                권한: {currentUser.role === "admin" ? "관리자" : "회원"} / 이메일:{" "}
                {currentUser.email}
              </p>
              <div className={styles.sessionActions}>
                <Link className={styles.submit} href="/">
                  편집기 열기
                </Link>
                {currentUser.role === "admin" ? (
                  <Link className={styles.linkButton} href="/admin">
                    관리자 페이지
                  </Link>
                ) : null}
                <LogoutButton className={styles.logout} returnTo="/auth" />
              </div>
            </div>
          ) : (
            <>
              <div className={styles.tabs}>
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    className={`${styles.tab} ${
                      mode === value ? styles.tabActive : ""
                    }`}
                    onClick={() => {
                      setMode(value);
                      setError("");
                      setSuccess("");
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form className={styles.form} onSubmit={handleSubmit}>
                {mode === "register" ? (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="register-name">
                      이름
                    </label>
                    <input
                      className={styles.input}
                      id="register-name"
                      name="name"
                      onChange={handleFieldChange}
                      placeholder="홍길동"
                      required
                      value={registerForm.name}
                    />
                  </div>
                ) : null}

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="auth-email">
                    이메일
                  </label>
                  <input
                    autoComplete="email"
                    className={styles.input}
                    id="auth-email"
                    name="email"
                    onChange={handleFieldChange}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={activeForm.email}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="auth-password">
                    비밀번호
                  </label>
                  <input
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    className={styles.input}
                    id="auth-password"
                    name="password"
                    onChange={handleFieldChange}
                    placeholder="영문, 숫자, 특수문자 포함 10자 이상"
                    required
                    type="password"
                    value={activeForm.password}
                  />
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}
                {success ? <div className={styles.success}>{success}</div> : null}

                <div className={styles.submitRow}>
                  <button className={styles.submit} disabled={pending} type="submit">
                    {pending ? "처리 중..." : MODE_LABELS[mode]}
                  </button>
                  <Link className={styles.linkButton} href="/">
                    편집기 홈
                  </Link>
                </div>
              </form>
            </>
          )}

          <div className={styles.hintList}>
            <div className={styles.hintItem}>
              일반 회원은 로그인 후 편집기로 이동합니다.
            </div>
            <div className={styles.hintItem}>
              관리자 계정은 가입자 목록과 운영 현황을 볼 수 있습니다.
            </div>
            <div className={styles.hintItem}>
              {adminSetupRequired ? (
                <>
                  아직 관리자 계정이 없습니다.{" "}
                  <Link href="/setup/admin">첫 관리자 계정 만들기</Link>
                </>
              ) : (
                "첫 관리자 계정은 이미 생성되어 있습니다."
              )}
            </div>
          </div>

          <p className={styles.smallPrint}>
            비밀번호는 PBKDF2 해시로 저장하고, 로그인 세션은 HttpOnly 쿠키로 관리합니다. 로그인 시도는 기본적으로 횟수 제한이 걸려 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}

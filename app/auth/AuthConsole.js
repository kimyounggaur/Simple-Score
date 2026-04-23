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
      <section className={styles.stage}>
        <div className={styles.backdrop} />

        <div className={styles.topbar}>
          <div className={styles.brandLockup}>
            <div className={styles.brandMark}>
              <span className={styles.brandRing} />
              <span className={styles.brandDot} />
            </div>
            <div>
              <p className={styles.brandName}>Simple Score</p>
              <p className={styles.brandMeta}>Secure music workspace</p>
            </div>
          </div>

          <div className={styles.topActions}>
            {currentUser ? (
              <>
                <Link className={styles.ghostLink} href="/">
                  편집기
                </Link>
                {currentUser.role === "admin" ? (
                  <Link className={styles.ghostLink} href="/admin">
                    관리자
                  </Link>
                ) : null}
              </>
            ) : adminSetupRequired ? (
              <Link className={styles.ghostLink} href="/setup/admin">
                관리자 초기설정
              </Link>
            ) : null}
          </div>
        </div>

        <div className={styles.content}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Simple Score Access</p>
            <h1 className={styles.heroTitle}>
              악보 작업을 시작하는 순간부터 분위기가 달라지는 입구.
            </h1>
            <p className={styles.heroText}>
              정돈된 편집 환경, 분리된 관리자 접근, 조용한 보안 흐름을 한 화면에
              담았습니다.
            </p>

            <div className={styles.signalRow}>
              <div className={styles.signalItem}>
                <span className={styles.signalLabel}>Workspace</span>
                <strong className={styles.signalValue}>Score Editor</strong>
              </div>
              <div className={styles.signalItem}>
                <span className={styles.signalLabel}>Access</span>
                <strong className={styles.signalValue}>Member + Admin</strong>
              </div>
              <div className={styles.signalItem}>
                <span className={styles.signalLabel}>Session</span>
                <strong className={styles.signalValue}>Protected</strong>
              </div>
            </div>

            <div className={styles.heroFooter}>
              <p className={styles.heroHint}>
                로그인 후 편집기로 바로 이동합니다.
              </p>
              <p className={styles.heroHint}>
                관리자 계정은 운영 화면으로 연결됩니다.
              </p>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelInner}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Account Console</p>
                  <h2 className={styles.panelTitle}>보안 계정 센터</h2>
                </div>
                <div className={styles.statusPill}>
                  {currentUser
                    ? currentUser.role === "admin"
                      ? "관리자 세션"
                      : "회원 세션"
                    : "로그인 필요"}
                </div>
              </div>

              {currentUser ? (
                <div className={styles.sessionBlock}>
                  <p className={styles.sessionLead}>
                    현재 {currentUser.name} 님으로 접속 중입니다.
                  </p>
                  <p className={styles.sessionMeta}>
                    {currentUser.email} ·{" "}
                    {currentUser.role === "admin" ? "관리자" : "회원"}
                  </p>
                  <div className={styles.sessionActions}>
                    <Link className={styles.primaryAction} href="/">
                      편집기 열기
                    </Link>
                    {currentUser.role === "admin" ? (
                      <Link className={styles.secondaryAction} href="/admin">
                        관리자 페이지
                      </Link>
                    ) : null}
                    <LogoutButton className={styles.logoutAction} returnTo="/auth" />
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
                      <button
                        className={styles.primaryAction}
                        disabled={pending}
                        type="submit"
                      >
                        {pending ? "처리 중..." : MODE_LABELS[mode]}
                      </button>
                      <Link className={styles.secondaryAction} href="/">
                        편집기 홈
                      </Link>
                    </div>
                  </form>

                  <div className={styles.notes}>
                    <p className={styles.noteLine}>
                      비밀번호는 PBKDF2 해시로 저장되고 세션은 HttpOnly 쿠키로
                      관리됩니다.
                    </p>
                    <p className={styles.noteLine}>
                      {adminSetupRequired ? (
                        <>
                          첫 관리자 계정이 아직 없습니다.{" "}
                          <Link className={styles.inlineLink} href="/setup/admin">
                            관리자 초기설정
                          </Link>
                        </>
                      ) : (
                        "첫 관리자 계정은 이미 설정되어 있습니다."
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

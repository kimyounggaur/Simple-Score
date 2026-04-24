"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { normalizeLandingPageDesign } from "../../lib/design-config";
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
  landingPageDesign,
  previewMode = false,
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registerForm, setRegisterForm] = useState(getInitialState());
  const [memberForm, setMemberForm] = useState(getInitialState());
  const [adminForm, setAdminForm] = useState(getInitialState());

  const design = useMemo(
    () => normalizeLandingPageDesign(landingPageDesign),
    [landingPageDesign],
  );

  const activeForm = useMemo(() => {
    if (mode === "register") {
      return registerForm;
    }

    return mode === "admin" ? adminForm : memberForm;
  }, [adminForm, memberForm, mode, registerForm]);

  const pageStyle = {
    "--landing-page-bg": design.colors.pageBg,
    "--landing-accent": design.colors.accent,
    "--landing-text-primary": design.colors.textPrimary,
    "--landing-text-secondary": design.colors.textSecondary,
    "--landing-text-muted": design.colors.mutedText,
    "--landing-top-button-bg": design.colors.topButtonBg,
    "--landing-top-button-border": design.colors.topButtonBorder,
    "--landing-panel-bg": design.colors.panelBg,
    "--landing-panel-border": design.colors.panelBorder,
    "--landing-panel-text": design.colors.panelText,
    "--landing-input-bg": design.colors.inputBg,
    "--landing-input-text": design.colors.inputText,
    "--landing-primary-button-bg": design.colors.primaryButtonBg,
    "--landing-primary-button-text": design.colors.primaryButtonText,
    "--landing-secondary-button-bg": design.colors.secondaryButtonBg,
    "--landing-secondary-button-text": design.colors.secondaryButtonText,
    "--landing-signal-bg": design.colors.signalCardBg,
    "--landing-signal-border": design.colors.signalCardBorder,
    "--landing-content-max-width": `${design.layout.contentMaxWidth}px`,
    "--landing-content-gap": `${design.layout.contentGap}px`,
    "--landing-hero-title-max-width": `${design.layout.heroTitleMaxWidth}px`,
    "--landing-hero-text-max-width": `${design.layout.heroTextMaxWidth}px`,
    "--landing-panel-width": `${design.layout.panelWidth}px`,
  };

  const stageStyle = {
    backgroundImage: `linear-gradient(90deg, rgba(5, 7, 11, 0.9) 0%, rgba(5, 7, 11, 0.62) 44%, rgba(5, 7, 11, 0.88) 100%), url("${design.backgroundImage}")`,
  };

  const heroStyle = {
    transform: `translate(${design.layout.heroOffsetX}px, ${design.layout.heroOffsetY}px)`,
  };

  const panelStyle = {
    transform: `translate(${design.layout.panelOffsetX}px, ${design.layout.panelOffsetY}px)`,
  };

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
    if (previewMode) {
      return;
    }

    const { name, value } = event.target;
    updateForm({
      ...activeForm,
      [name]: value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (previewMode || pending) {
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
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  const emailValue = previewMode ? design.previewEmail : activeForm.email;
  const passwordValue = previewMode ? design.previewPassword : activeForm.password;

  return (
    <main className={styles.page} style={pageStyle}>
      <section className={styles.stage} style={stageStyle}>
        <div className={styles.backdrop} />

        <div className={styles.topbar}>
          <div className={styles.brandLockup}>
            <div className={styles.brandMark}>
              <span className={styles.brandRing} />
              <span className={styles.brandDot} />
            </div>
            <div>
              <p className={styles.brandName}>{design.brandName}</p>
              <p className={styles.brandMeta}>{design.brandMeta}</p>
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
                관리자 초기 설정
              </Link>
            ) : null}
          </div>
        </div>

        <div className={styles.content}>
          <section className={styles.hero} style={heroStyle}>
            <p className={styles.eyebrow}>{design.heroEyebrow}</p>
            <h1 className={styles.heroTitle}>{design.heroTitle}</h1>
            <p className={styles.heroText}>{design.heroText}</p>

            <div className={styles.signalRow}>
              {design.signals.map((signal, index) => (
                <div className={styles.signalItem} key={index}>
                  <span className={styles.signalLabel}>{signal.label}</span>
                  <strong className={styles.signalValue}>{signal.value}</strong>
                </div>
              ))}
            </div>

            <div className={styles.heroFooter}>
              {design.hints.map((hint, index) => (
                <p className={styles.heroHint} key={index}>
                  {hint}
                </p>
              ))}
            </div>
          </section>

          <section className={styles.panel} style={panelStyle}>
            <div className={styles.panelInner}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>{design.panelEyebrow}</p>
                  <h2 className={styles.panelTitle}>{design.panelTitle}</h2>
                </div>
                <div className={styles.statusPill}>
                  {currentUser
                    ? currentUser.role === "admin"
                      ? "관리자 세션"
                      : "회원 세션"
                    : design.panelStatusLabel}
                </div>
              </div>

              {currentUser ? (
                <div className={styles.sessionBlock}>
                  <p className={styles.sessionLead}>
                    현재 {currentUser.name} 계정으로 로그인 중입니다.
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
                          readOnly={previewMode}
                          required
                          value={previewMode ? "김심플" : registerForm.name}
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
                        readOnly={previewMode}
                        required
                        type="email"
                        value={emailValue}
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
                        readOnly={previewMode}
                        required
                        type="password"
                        value={passwordValue}
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
                        {pending ? "처리 중..." : design.primaryActionLabel}
                      </button>
                      <Link className={styles.secondaryAction} href="/">
                        {design.secondaryActionLabel}
                      </Link>
                    </div>
                  </form>

                  <div className={styles.notes}>
                    <p className={styles.noteLine}>
                      비밀번호는 PBKDF2 해시로 저장되며 세션은 HttpOnly 쿠키로
                      관리됩니다.
                    </p>
                    <p className={styles.noteLine}>
                      {adminSetupRequired ? (
                        <>
                          아직 관리자 계정이 없습니다.{" "}
                          <Link className={styles.inlineLink} href="/setup/admin">
                            첫 관리자 만들기
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

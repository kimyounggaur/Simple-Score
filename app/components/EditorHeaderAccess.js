"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./editor-header-access.module.css";

const MODES = {
  register: "회원가입",
  member: "회원 로그인",
  admin: "관리자 로그인",
};

function createEmptyForms() {
  return {
    register: {
      name: "",
      email: "",
      password: "",
    },
    member: {
      email: "",
      password: "",
    },
    admin: {
      email: "",
      password: "",
    },
  };
}

export default function EditorHeaderAccess({
  currentUser,
  adminSetupRequired,
  accessProfile,
}) {
  const router = useRouter();
  const panelRef = useRef(null);
  const [mountNode, setMountNode] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("member");
  const [forms, setForms] = useState(createEmptyForms());
  const [pending, setPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setMountNode(document.getElementById("editor-access-slot"));
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!mountNode) {
    return null;
  }

  function openMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setOpen(true);
  }

  function updateField(targetMode, field, value) {
    setForms((current) => ({
      ...current,
      [targetMode]: {
        ...current[targetMode],
        [field]: value,
      },
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (pending) {
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      mode === "register"
        ? forms.register
        : {
            email: forms[mode].email,
            password: forms[mode].password,
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

      setSuccess(result.message || "처리가 완료되었습니다.");
      setOpen(false);

      if (result.user?.role === "admin") {
        router.push("/admin");
      } else {
        router.refresh();
      }
    } catch (networkError) {
      console.error(networkError);
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    if (logoutPending) {
      return;
    }

    setLogoutPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  const content = (
    <div className={styles.shell}>
      <div className={styles.summary}>
        <span
          className={`${styles.badge} ${
            accessProfile.isAdmin
              ? styles.adminBadge
              : accessProfile.level === "paid"
                ? styles.paidBadge
                : accessProfile.level === "member"
                  ? styles.memberBadge
                  : styles.guestBadge
          }`}
        >
          {accessProfile.isAdmin ? "관리자" : accessProfile.labels.badge}
        </span>
        <span className={styles.summaryText}>{accessProfile.labels.summary}</span>
      </div>

      {currentUser ? (
        <div className={styles.userActions}>
          <span className={styles.userName}>{currentUser.name}</span>
          {currentUser.role === "admin" ? (
            <Link className={styles.secondaryButton} href="/admin">
              관리자
            </Link>
          ) : null}
          <button
            className={styles.primaryButton}
            onClick={handleLogout}
            type="button"
          >
            {logoutPending ? "처리 중..." : "로그아웃"}
          </button>
        </div>
      ) : (
        <div className={styles.guestActions} ref={panelRef}>
          <button
            className={styles.secondaryButton}
            onClick={() => openMode("register")}
            type="button"
          >
            회원가입
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => openMode("member")}
            type="button"
          >
            회원 로그인
          </button>
          <button
            className={styles.primaryButton}
            onClick={() => openMode("admin")}
            type="button"
          >
            관리자 로그인
          </button>
          {adminSetupRequired ? (
            <Link className={styles.inlineLink} href="/setup/admin">
              관리자 최초 설정
            </Link>
          ) : null}

          {open ? (
            <div className={styles.panel}>
              <div className={styles.tabs}>
                {Object.entries(MODES).map(([value, label]) => (
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

              <form className={styles.form} onSubmit={handleAuthSubmit}>
                {mode === "register" ? (
                  <label className={styles.field}>
                    <span>이름</span>
                    <input
                      name="name"
                      onChange={(event) =>
                        updateField("register", "name", event.target.value)
                      }
                      placeholder="사용자 이름"
                      required
                      type="text"
                      value={forms.register.name}
                    />
                  </label>
                ) : null}

                <label className={styles.field}>
                  <span>이메일</span>
                  <input
                    autoComplete="email"
                    name="email"
                    onChange={(event) =>
                      updateField(mode, "email", event.target.value)
                    }
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={forms[mode].email}
                  />
                </label>

                <label className={styles.field}>
                  <span>비밀번호</span>
                  <input
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    name="password"
                    onChange={(event) =>
                      updateField(mode, "password", event.target.value)
                    }
                    placeholder="영문, 숫자, 특수문자 포함 10자 이상"
                    required
                    type="password"
                    value={forms[mode].password}
                  />
                </label>

                {error ? <p className={styles.error}>{error}</p> : null}
                {success ? <p className={styles.success}>{success}</p> : null}

                <button
                  className={styles.submitButton}
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "처리 중..." : MODES[mode]}
                </button>
              </form>

              <div className={styles.panelNote}>
                <strong>현재 사용 가능</strong>
                <ul className={styles.featureList}>
                  {accessProfile.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return createPortal(content, mountNode);
}

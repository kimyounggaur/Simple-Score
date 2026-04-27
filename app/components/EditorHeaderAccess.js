"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function getBillingStatusLabel(status) {
  switch (status) {
    case "active":
      return "활성";
    case "trialing":
      return "체험중";
    case "past_due":
      return "미납";
    case "canceled":
      return "해지";
    case "unpaid":
      return "미결제";
    default:
      return "미연결";
  }
}

function clearBillingParam() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (!url.searchParams.has("billing")) {
    return;
  }

  url.searchParams.delete("billing");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export default function EditorHeaderAccess({
  currentUser,
  adminSetupRequired,
  accessProfile,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panelRef = useRef(null);
  const billingEffectHandledRef = useRef("");
  const [mountNode, setMountNode] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("member");
  const [forms, setForms] = useState(createEmptyForms());
  const [pending, setPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [billingPending, setBillingPending] = useState("");
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

  async function syncBillingState(successMessage) {
    if (billingPending) {
      return;
    }

    setBillingPending("refresh");
    setError("");

    try {
      const response = await fetch("/api/billing/refresh", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "결제 상태를 불러오지 못했습니다.");
        return;
      }

      setSuccess(result.message || successMessage || "결제 상태를 새로고침했습니다.");
      router.refresh();
    } catch (networkError) {
      console.error(networkError);
      setError("결제 서버에 연결하지 못했습니다.");
    } finally {
      setBillingPending("");
    }
  }

  useEffect(() => {
    const billingState = searchParams.get("billing");

    if (!billingState || billingEffectHandledRef.current === billingState) {
      return;
    }

    billingEffectHandledRef.current = billingState;
    clearBillingParam();

    if (billingState === "cancel") {
      setError("결제가 취소되었습니다.");
      setSuccess("");
      return;
    }

    if (!currentUser || currentUser.role === "admin") {
      setSuccess(
        billingState === "success"
          ? "결제가 완료되었습니다."
          : "결제 관리 화면에서 돌아왔습니다.",
      );
      setError("");
      return;
    }

    if (!currentUser.stripeCustomerId) {
      setSuccess(
        billingState === "success"
          ? "결제가 완료되었습니다. 잠시 뒤 상태를 다시 확인해 주세요."
          : "결제 관리 화면에서 돌아왔습니다.",
      );
      setError("");
      return;
    }

    void syncBillingState(
      billingState === "success"
        ? "결제 완료를 확인하고 권한을 새로고침했습니다."
        : "결제 상태를 다시 확인했습니다.",
    );
  }, [currentUser, searchParams]);

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

  async function handleBillingAction(action) {
    if (billingPending) {
      return;
    }

    if (action === "refresh") {
      await syncBillingState("결제 상태를 새로고침했습니다.");
      return;
    }

    setBillingPending(action);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "결제 페이지를 열지 못했습니다.");
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (networkError) {
      console.error(networkError);
      setError("결제 서버에 연결하지 못했습니다.");
    } finally {
      setBillingPending("");
    }
  }

  const showUpgradeButton =
    currentUser && currentUser.role !== "admin" && accessProfile.level !== "paid";
  const showPortalButton =
    currentUser &&
    currentUser.role !== "admin" &&
    Boolean(currentUser.stripeCustomerId);
  const showRefreshButton = showPortalButton;

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
        <div className={styles.userBlock}>
          <div className={styles.userActions}>
            <span className={styles.userName}>{currentUser.name}</span>
            {showUpgradeButton ? (
              <button
                className={styles.secondaryButton}
                onClick={() => handleBillingAction("checkout")}
                type="button"
              >
                {billingPending === "checkout" ? "연결 중..." : "업그레이드"}
              </button>
            ) : null}
            {showPortalButton ? (
              <button
                className={styles.secondaryButton}
                onClick={() => handleBillingAction("portal")}
                type="button"
              >
                {billingPending === "portal" ? "열는 중..." : "결제 관리"}
              </button>
            ) : null}
            {showRefreshButton ? (
              <button
                className={styles.secondaryButton}
                onClick={() => handleBillingAction("refresh")}
                type="button"
              >
                {billingPending === "refresh" ? "확인 중..." : "상태 새로고침"}
              </button>
            ) : null}
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

          {currentUser.role !== "admin" ? (
            <div className={styles.userMeta}>
              <span>결제 상태: {getBillingStatusLabel(currentUser.billingStatus)}</span>
              <span>
                현재 권한: {accessProfile.level === "paid" ? "유료 플랜" : "회원 플랜"}
              </span>
            </div>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}
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
                    onChange={(event) => updateField(mode, "email", event.target.value)}
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

              <div className={styles.recoveryLinks}>
                <Link className={styles.textLink} href="/account/recovery">
                  아이디 찾기
                </Link>
                <Link className={styles.textLink} href="/account/recovery">
                  비밀번호 찾기
                </Link>
              </div>

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

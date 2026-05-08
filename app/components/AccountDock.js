import Link from "next/link";
import LogoutButton from "./LogoutButton";
import styles from "./account-dock.module.css";

function roleLabel(role) {
  return role === "admin" ? "관리자" : "회원";
}

export default function AccountDock({ user, adminSetupRequired }) {
  return (
    <aside className={styles.dock}>
      <div className={styles.eyebrow}>보안 접속</div>
      <h2 className={styles.title}>
        {user ? `${user.name} 님으로 로그인됨` : "로그인이 필요합니다"}
      </h2>
      <p className={styles.meta}>
        {user
          ? `${roleLabel(user.role)} 계정으로 편집기를 사용 중입니다.`
          : "회원가입 후 바로 편집기를 사용할 수 있고, 관리자는 별도 로그인으로 접근합니다."}
      </p>

      <div className={styles.actions}>
        {user ? (
          <>
            <Link className={styles.primary} href="/">
              편집기
            </Link>
            {user.role === "admin" ? (
              <Link className={styles.secondary} href="/admin">
                관리자 페이지
              </Link>
            ) : null}
            <Link className={styles.secondary} href="/auth">
              계정 화면
            </Link>
            <LogoutButton className={styles.logout} returnTo="/" />
          </>
        ) : (
          <>
            <Link className={styles.primary} href="/auth">
              회원 로그인
            </Link>
            <Link className={styles.secondary} href="/auth?mode=admin">
              관리자 로그인
            </Link>
            {adminSetupRequired ? (
              <Link className={styles.secondary} href="/setup/admin">
                관리자 초기설정
              </Link>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

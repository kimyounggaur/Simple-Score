import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import styles from "./admin.module.css";
import { getCurrentUser } from "../../lib/auth";
import { listUsers } from "../../lib/db";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "아직 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth?mode=admin");
  }

  if (currentUser.role !== "admin") {
    redirect("/");
  }

  const users = await listUsers();
  const memberCount = users.filter((user) => user.role === "member").length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeCount = users.filter((user) => user.status === "active").length;
  const latestSignup = users[0]?.createdAt || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.header}>
          <div>
            <div className={styles.eyebrow}>관리자 콘솔</div>
            <h1 className={styles.title}>회원 데이터와 운영 화면</h1>
            <p className={styles.text}>
              이 화면은 관리자만 접근할 수 있습니다. 현재 로그인 계정은{" "}
              {currentUser.name} ({currentUser.email}) 입니다.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin/design">
              랜딩 디자인
            </Link>
            <Link className={styles.primary} href="/">
              편집기 열기
            </Link>
            <Link className={styles.secondary} href="/auth">
              계정 센터
            </Link>
            <LogoutButton className={styles.logout} returnTo="/auth?mode=admin" />
          </div>
        </section>

        <section className={styles.stats}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>전체 회원</div>
            <div className={styles.statValue}>{users.length}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>일반 회원</div>
            <div className={styles.statValue}>{memberCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>관리자 계정</div>
            <div className={styles.statValue}>{adminCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>활성 계정</div>
            <div className={styles.statValue}>{activeCount}</div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>회원 목록</h2>
              <p className={styles.tableText}>최근 가입 {formatDate(latestSignup)}</p>
            </div>
          </div>

          <div className={styles.tableScroll}>
            {users.length === 0 ? (
              <div className={styles.empty}>아직 회원이 없습니다.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>권한</th>
                    <th>상태</th>
                    <th>가입일</th>
                    <th>최근 로그인</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            user.role === "admin"
                              ? styles.adminBadge
                              : styles.memberBadge
                          }`}
                        >
                          {user.role === "admin" ? "관리자" : "회원"}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.activeBadge}`}>
                          활성
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import UserAccessTierControl from "./UserAccessTierControl";
import styles from "./admin.module.css";
import { getCurrentUser } from "../../lib/auth";
import { resolveAccessLevel } from "../../lib/access";
import { listUsers } from "../../lib/db";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "기록 없음";
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
  const paidCount = users.filter(
    (user) => resolveAccessLevel(user) === "paid" || user.role === "admin",
  ).length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const latestSignup = users[0]?.createdAt || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.header}>
          <div>
            <div className={styles.eyebrow}>관리자 콘솔</div>
            <h1 className={styles.title}>심플스코어 사용자와 이용권 관리</h1>
            <p className={styles.text}>
              현재 <strong>{currentUser.name}</strong> 계정으로 로그인되어 있습니다.
              회원과 유료 이용권을 여기서 바로 조정할 수 있습니다.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin/design">
              랜딩 디자인
            </Link>
            <Link className={styles.primary} href="/">
              편집기로 이동
            </Link>
            <LogoutButton className={styles.logout} returnTo="/auth?mode=admin" />
          </div>
        </section>

        <section className={styles.stats}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>전체 사용자</div>
            <div className={styles.statValue}>{users.length}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>일반 회원</div>
            <div className={styles.statValue}>{memberCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>전체 기능 가능</div>
            <div className={styles.statValue}>{paidCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>관리자 계정</div>
            <div className={styles.statValue}>{adminCount}</div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>사용자 목록</h2>
              <p className={styles.tableText}>
                최근 가입 {formatDate(latestSignup)}
              </p>
            </div>
          </div>

          <div className={styles.tableScroll}>
            {users.length === 0 ? (
              <div className={styles.empty}>등록된 사용자가 아직 없습니다.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>역할</th>
                    <th>이용 등급</th>
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
                        <UserAccessTierControl user={user} />
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.activeBadge}`}>
                          {user.status === "active" ? "활성" : "비활성"}
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

import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import styles from "./admin.module.css";
import { getCurrentUser } from "../../lib/auth";
import { listUsers } from "../../lib/db";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "Not yet";
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
            <div className={styles.eyebrow}>Administrator Console</div>
            <h1 className={styles.title}>Members database and admin operations</h1>
            <p className={styles.text}>
              This area is only for admins. You are signed in as {currentUser.name} (
              {currentUser.email}).
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin/design">
              Landing Design
            </Link>
            <Link className={styles.primary} href="/">
              Open Editor
            </Link>
            <Link className={styles.secondary} href="/auth">
              Account Center
            </Link>
            <LogoutButton className={styles.logout} returnTo="/auth?mode=admin" />
          </div>
        </section>

        <section className={styles.stats}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>Total users</div>
            <div className={styles.statValue}>{users.length}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>Members</div>
            <div className={styles.statValue}>{memberCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>Admins</div>
            <div className={styles.statValue}>{adminCount}</div>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>Active accounts</div>
            <div className={styles.statValue}>{activeCount}</div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>User list</h2>
              <p className={styles.tableText}>Latest signup {formatDate(latestSignup)}</p>
            </div>
          </div>

          <div className={styles.tableScroll}>
            {users.length === 0 ? (
              <div className={styles.empty}>No users yet.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Last login</th>
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
                          {user.role === "admin" ? "Admin" : "Member"}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.activeBadge}`}>
                          Active
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

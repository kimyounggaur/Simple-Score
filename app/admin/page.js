import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import UserAccessTierControl from "./UserAccessTierControl";
import styles from "./admin.module.css";
import { getCurrentUser } from "../../lib/auth";
import { resolveAccessLevel } from "../../lib/access";
import { listUsers } from "../../lib/db";
import { getStripeSetupStatus } from "../../lib/stripe";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) {
    return "기록 없음";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRoleLabel(role) {
  return role === "admin" ? "관리자" : "회원";
}

function getStatusLabel(status) {
  return status === "active" ? "활성" : "비활성";
}

function formatText(value) {
  return value ? value : "-";
}

function getUsagePurposeLabel(value) {
  const labels = {
    lesson: "레슨/교육",
    church: "교회/예배",
    ensemble: "합주/공연",
    personal: "개인 연습",
    other: "기타",
  };

  return labels[value] || formatText(value);
}

function getReferralSourceLabel(value) {
  const labels = {
    search: "검색",
    social: "SNS",
    recommendation: "지인 추천",
    class: "수업/강의",
    other: "기타",
  };

  return labels[value] || formatText(value);
}

function getAccessLevelLabel(user) {
  return resolveAccessLevel(user) === "paid" ? "전체 기능 가능" : "회원 기능";
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
  const stripeSetup = getStripeSetupStatus();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.header}>
          <div>
            <div className={styles.eyebrow}>관리자 콘솔</div>
            <h1 className={styles.title}>Simple Score 사용자 및 결제 관리</h1>
            <p className={styles.text}>
              현재 <strong>{currentUser.name}</strong> 계정으로 로그인되어 있습니다.
              회원, 유료 플랜, Stripe 결제 연결 상태를 이 화면에서 함께 관리할 수
              있습니다.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin/design">
              랜딩 디자인
            </Link>
            <a className={styles.primary} href="/">
              편집기로 이동
            </a>
            <LogoutButton className={styles.logout} returnTo="/" />
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

        <section className={styles.billingPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Stripe 결제 설정 상태</h2>
              <p className={styles.sectionText}>
                Render 환경변수와 Stripe Dashboard 설정이 맞물려야 실제 결제가
                동작합니다.
              </p>
            </div>
            <div className={styles.panelPills}>
              <span
                className={`${styles.pill} ${
                  stripeSetup.checkoutReady ? styles.pillOk : styles.pillWarn
                }`}
              >
                {stripeSetup.checkoutReady
                  ? "체크아웃 준비 완료"
                  : "체크아웃 설정 필요"}
              </span>
              <span
                className={`${styles.pill} ${
                  stripeSetup.webhookReady ? styles.pillOk : styles.pillWarn
                }`}
              >
                {stripeSetup.webhookReady
                  ? "웹훅 준비 완료"
                  : "웹훅 설정 필요"}
              </span>
            </div>
          </div>

          <div className={styles.billingGrid}>
            {stripeSetup.items.map((item) => (
              <article key={item.key} className={styles.billingCard}>
                <div className={styles.billingCardTop}>
                  <strong>{item.label}</strong>
                  <span
                    className={`${styles.statusDot} ${
                      item.ready ? styles.statusOk : styles.statusMissing
                    }`}
                  >
                    {item.ready ? "완료" : "미설정"}
                  </span>
                </div>
                <p className={styles.billingHelp}>{item.help}</p>
                <code className={styles.codeLine}>{item.value || "아직 설정되지 않음"}</code>
              </article>
            ))}
          </div>

          <div className={styles.setupSteps}>
            <h3 className={styles.stepTitle}>연결 순서</h3>
            <ol className={styles.stepList}>
              <li>Stripe Dashboard에서 상품과 월간 가격을 만들고 Price ID를 복사합니다.</li>
              <li>Render 환경변수에 비밀키와 Price ID, 앱 URL을 입력합니다.</li>
              <li>
                Stripe Webhook endpoint를{" "}
                <code className={styles.inlineCode}>
                  {stripeSetup.webhookUrl || "https://your-domain/api/webhooks/stripe"}
                </code>
                로 만들고 signing secret을 Render에 넣습니다.
              </li>
              <li>Render에서 다시 배포한 뒤 회원 계정으로 업그레이드 버튼을 테스트합니다.</li>
            </ol>
          </div>
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
                    <th>결제 상태</th>
                    <th>가입일</th>
                    <th>최근 로그인</th>
                    <th>회원정보</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <Fragment key={user.id}>
                      <tr>
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
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td>
                          <UserAccessTierControl user={user} />
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles.activeBadge}`}>
                            {getStatusLabel(user.status)}
                          </span>
                        </td>
                        <td>{user.billingStatus || "-"}</td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>{formatDate(user.lastLoginAt)}</td>
                        <td className={styles.detailCell}>
                          <details className={styles.userDetails}>
                            <summary className={styles.detailToggle}>상세 보기</summary>
                            <dl className={styles.detailGrid}>
                              <div className={styles.detailItem}>
                                <dt>사용자 ID</dt>
                                <dd className={styles.monoValue}>{user.id}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>이름</dt>
                                <dd>{user.name}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>이메일</dt>
                                <dd className={styles.monoValue}>{user.email}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>연락처</dt>
                                <dd>{formatText(user.profile?.phone)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>소속</dt>
                                <dd>{formatText(user.profile?.organization)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>사용 목적</dt>
                                <dd>
                                  {getUsagePurposeLabel(user.profile?.usagePurpose)}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>가입 경로</dt>
                                <dd>
                                  {getReferralSourceLabel(
                                    user.profile?.referralSource,
                                  )}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>마케팅 수신</dt>
                                <dd>
                                  {user.profile?.marketingConsent ? "동의" : "미동의"}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>역할</dt>
                                <dd>{getRoleLabel(user.role)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>이용 권한</dt>
                                <dd>{getAccessLevelLabel(user)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>계정 상태</dt>
                                <dd>{getStatusLabel(user.status)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>결제 상태</dt>
                                <dd>{formatText(user.billingStatus)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>Stripe 고객 ID</dt>
                                <dd className={styles.monoValue}>
                                  {formatText(user.stripeCustomerId)}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>구독 ID</dt>
                                <dd className={styles.monoValue}>
                                  {formatText(user.stripeSubscriptionId)}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>Price ID</dt>
                                <dd className={styles.monoValue}>
                                  {formatText(user.stripePriceId)}
                                </dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>결제 만료일</dt>
                                <dd>{formatDate(user.billingCurrentPeriodEnd)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>결제 갱신일</dt>
                                <dd>{formatDate(user.billingUpdatedAt)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>가입일</dt>
                                <dd>{formatDate(user.createdAt)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>수정일</dt>
                                <dd>{formatDate(user.updatedAt)}</dd>
                              </div>
                              <div className={styles.detailItem}>
                                <dt>최근 로그인</dt>
                                <dd>{formatDate(user.lastLoginAt)}</dd>
                              </div>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    </Fragment>
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

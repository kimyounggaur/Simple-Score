import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./design.module.css";
import { getCurrentUser } from "../../../lib/auth";
import { getLandingPageDesign } from "../../../lib/db";
import DesignEditor from "./DesignEditor";

export const dynamic = "force-dynamic";

export default async function AdminDesignPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/auth?mode=admin");
  }

  if (currentUser.role !== "admin") {
    redirect("/");
  }

  const design = await getLandingPageDesign();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.header}>
          <div>
            <div className={styles.eyebrow}>랜딩 디자인 스튜디오</div>
            <h1 className={styles.title}>실시간 랜딩페이지 편집기</h1>
            <p className={styles.text}>
              문구, 색상, 카드 폭, 간격, 위치 값을 조절하면 오른쪽 미리보기에
              바로 반영됩니다.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin">
              관리자 홈
            </Link>
            <Link className={styles.secondary} href="/auth">
              랜딩 보기
            </Link>
            <Link className={styles.primary} href="/">
              편집기 열기
            </Link>
          </div>
        </section>

        <DesignEditor initialDesign={design} />
      </div>
    </main>
  );
}

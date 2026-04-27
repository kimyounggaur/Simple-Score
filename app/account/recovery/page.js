import Link from "next/link";
import RecoveryPanel from "./RecoveryPanel";
import styles from "./recovery.module.css";

export const dynamic = "force-dynamic";

export default function AccountRecoveryPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>계정 복구</p>
            <h1 className={styles.title}>아이디와 비밀번호 찾기</h1>
            <p className={styles.text}>
              가입한 이름으로 아이디를 확인하고, 이름과 이메일이 일치하면
              비밀번호를 새로 설정할 수 있습니다.
            </p>
          </div>
          <Link className={styles.backLink} href="/">
            편집기로 돌아가기
          </Link>
        </div>

        <RecoveryPanel />
      </section>
    </main>
  );
}

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
            <div className={styles.eyebrow}>Landing Design Studio</div>
            <h1 className={styles.title}>Real-time landing page editor</h1>
            <p className={styles.text}>
              Edit copy, colors, card width, spacing, and offsets while the preview
              updates immediately.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondary} href="/admin">
              Admin Home
            </Link>
            <Link className={styles.secondary} href="/auth">
              Open Landing
            </Link>
            <Link className={styles.primary} href="/">
              Open Editor
            </Link>
          </div>
        </section>

        <DesignEditor initialDesign={design} />
      </div>
    </main>
  );
}

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import AccountDock from "./components/AccountDock";
import LegacyScripts from "./LegacyScripts";
import { getCurrentUser } from "../lib/auth";
import { hasAdminUser } from "../lib/db";

function getLegacyBodyHtml() {
  const indexPath = path.join(process.cwd(), "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;

  return bodyHtml.replace(
    /\s*<script\s+src=["']app\.js["']\s*><\/script>\s*$/i,
    "",
  );
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUser = await getCurrentUser();
  const adminSetupRequired = !(await hasAdminUser());

  if (!currentUser) {
    redirect("/auth");
  }

  return (
    <>
      <AccountDock
        adminSetupRequired={adminSetupRequired}
        user={currentUser}
      />
      <div
        id="legacy-root"
        style={{ display: "contents" }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: getLegacyBodyHtml() }}
      />
      <LegacyScripts />
    </>
  );
}

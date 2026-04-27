import fs from "node:fs";
import path from "node:path";
import EditorHeaderAccess from "./components/EditorHeaderAccess";
import LegacyScripts from "./LegacyScripts";
import { getCurrentUser } from "../lib/auth";
import { buildAccessProfile } from "../lib/access";
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
  const accessProfile = buildAccessProfile(currentUser);

  return (
    <>
      <EditorHeaderAccess
        accessProfile={accessProfile}
        adminSetupRequired={adminSetupRequired}
        currentUser={currentUser}
      />
      <script
        id="simple-score-access-config"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(accessProfile),
        }}
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

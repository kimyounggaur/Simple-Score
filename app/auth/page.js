import AuthConsole from "./AuthConsole";
import { getCurrentUser } from "../../lib/auth";
import { getLandingPageDesign, hasAdminUser } from "../../lib/db";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }) {
  const params = (await searchParams) || {};
  const currentUser = await getCurrentUser();
  const adminSetupRequired = !(await hasAdminUser());
  const landingPageDesign = await getLandingPageDesign();
  const allowedModes = new Set(["register", "member", "admin"]);
  const initialMode = allowedModes.has(params.mode) ? params.mode : "member";

  return (
    <AuthConsole
      adminSetupRequired={adminSetupRequired}
      currentUser={currentUser}
      initialMode={initialMode}
      landingPageDesign={landingPageDesign}
    />
  );
}

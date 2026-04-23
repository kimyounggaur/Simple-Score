import { redirect } from "next/navigation";
import SetupAdminForm from "./SetupAdminForm";
import { hasAdminUser } from "../../../lib/db";

export const dynamic = "force-dynamic";

export default async function SetupAdminPage() {
  if (await hasAdminUser()) {
    redirect("/auth?mode=admin");
  }

  return <SetupAdminForm />;
}

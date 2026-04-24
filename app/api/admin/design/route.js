import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { getLandingPageDesign, saveLandingPageDesign } from "../../../../lib/db";

function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
}

async function requireAdmin() {
  const currentUser = await getCurrentUser();
  return currentUser && currentUser.role === "admin" ? currentUser : null;
}

export async function GET() {
  const currentUser = await requireAdmin();

  if (!currentUser) {
    return forbidden();
  }

  const design = await getLandingPageDesign();
  return NextResponse.json({ design });
}

export async function PUT(request) {
  const currentUser = await requireAdmin();

  if (!currentUser) {
    return forbidden();
  }

  const body = await request.json();
  const design = await saveLandingPageDesign(body?.design || {});

  return NextResponse.json({ ok: true, design });
}

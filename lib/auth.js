import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { findUserById, toPublicUser } from "./db";

const DEFAULT_DATA_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
);
const DATA_DIR = process.env.LESSON_DESIGNER_DATA_DIR || DEFAULT_DATA_DIR;
const SECRET_FILE =
  process.env.LESSON_DESIGNER_SESSION_SECRET_FILE ||
  path.join(DEFAULT_DATA_DIR, ".session-secret");
export const SESSION_COOKIE_NAME = "lesson_designer_session";
const SESSION_MAX_AGE = 60 * 60 * 24;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

async function getSessionSecret() {
  await mkdir(path.dirname(SECRET_FILE), { recursive: true });

  try {
    const existing = (await readFile(SECRET_FILE, "utf8")).trim();

    if (existing) {
      return existing;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const generated = randomBytes(32).toString("hex");

  try {
    await writeFile(SECRET_FILE, generated, { encoding: "utf8", flag: "wx" });
    return generated;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  return (await readFile(SECRET_FILE, "utf8")).trim();
}

async function signPayload(payloadPart) {
  const secret = await getSessionSecret();

  return createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
}

export async function createSessionToken(user) {
  const payloadPart = Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    }),
  ).toString("base64url");
  const signaturePart = await signPayload(payloadPart);

  return `${payloadPart}.${signaturePart}`;
}

export async function verifySessionToken(token) {
  if (!token) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split(".");

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = await signPayload(payloadPart);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signaturePart);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );

    if (!payload?.sub || !payload?.exp) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function writeSessionCookie(cookieStore, user) {
  const token = await createSessionToken(user);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(cookieStore) {
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await findUserById(session.sub);

  if (!user || user.status !== "active") {
    return null;
  }

  return toPublicUser(user);
}

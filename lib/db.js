import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LANDING_PAGE_DESIGN,
  normalizeLandingPageDesign,
} from "./design-config";
import { normalizeStoredAccessTier } from "./access";
import { normalizeEmail } from "./security";

const DEFAULT_DATA_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
);
const DATA_DIR = process.env.LESSON_DESIGNER_DATA_DIR || DEFAULT_DATA_DIR;
const DB_FILE =
  process.env.LESSON_DESIGNER_DB_FILE ||
  path.join(/* turbopackIgnore: true */ DEFAULT_DATA_DIR, "app-db.json");
const EMPTY_DB = {
  meta: {
    createdAt: null,
    updatedAt: null,
  },
  users: [],
  landingPageDesign: DEFAULT_LANDING_PAGE_DESIGN,
};

let writeQueue = Promise.resolve();

function cloneDb(db) {
  return JSON.parse(JSON.stringify(db));
}

function normalizeUserRecord(user = {}) {
  const role = user.role === "admin" ? "admin" : "member";

  return {
    ...user,
    role,
    status: user.status === "inactive" ? "inactive" : "active",
    accessTier: normalizeStoredAccessTier(role, user.accessTier),
    stripeCustomerId:
      typeof user.stripeCustomerId === "string" && user.stripeCustomerId.trim()
        ? user.stripeCustomerId.trim()
        : null,
    stripeSubscriptionId:
      typeof user.stripeSubscriptionId === "string" &&
      user.stripeSubscriptionId.trim()
        ? user.stripeSubscriptionId.trim()
        : null,
    stripePriceId:
      typeof user.stripePriceId === "string" && user.stripePriceId.trim()
        ? user.stripePriceId.trim()
        : null,
    billingStatus:
      typeof user.billingStatus === "string" && user.billingStatus.trim()
        ? user.billingStatus.trim()
        : null,
    billingCurrentPeriodEnd:
      typeof user.billingCurrentPeriodEnd === "string" &&
      user.billingCurrentPeriodEnd.trim()
        ? user.billingCurrentPeriodEnd.trim()
        : null,
    billingUpdatedAt:
      typeof user.billingUpdatedAt === "string" && user.billingUpdatedAt.trim()
        ? user.billingUpdatedAt.trim()
        : null,
  };
}

function normalizeDb(raw = {}) {
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const users = Array.isArray(raw.users)
    ? raw.users.map((user) => normalizeUserRecord(user))
    : [];

  return {
    meta: {
      createdAt: meta.createdAt || null,
      updatedAt: meta.updatedAt || null,
    },
    users,
    landingPageDesign: normalizeLandingPageDesign(raw.landingPageDesign),
  };
}

async function ensureDbFile() {
  await mkdir(path.dirname(DB_FILE), { recursive: true });

  try {
    await access(DB_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const now = new Date().toISOString();
    const seed = {
      ...EMPTY_DB,
      meta: {
        createdAt: now,
        updatedAt: now,
      },
    };

    await writeFile(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readDbFile() {
  await ensureDbFile();
  const file = await readFile(DB_FILE, "utf8");

  return normalizeDb(JSON.parse(file));
}

async function writeDbFile(nextDb) {
  const normalized = normalizeDb(nextDb);
  const now = new Date().toISOString();

  normalized.meta.createdAt ||= now;
  normalized.meta.updatedAt = now;

  await writeFile(DB_FILE, JSON.stringify(normalized, null, 2), "utf8");

  return normalized;
}

export function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, passwordSalt, ...publicUser } = user;

  return publicUser;
}

export function updateDb(updater) {
  const run = async () => {
    const currentDb = await readDbFile();
    const nextDb = await updater(cloneDb(currentDb));

    return writeDbFile(nextDb || currentDb);
  };

  const pending = writeQueue.then(run, run);
  writeQueue = pending.catch(() => undefined);

  return pending;
}

export async function getDatabaseSnapshot() {
  return readDbFile();
}

export async function hasAdminUser() {
  const db = await readDbFile();

  return db.users.some((user) => user.role === "admin");
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const db = await readDbFile();

  return (
    db.users.find((user) => normalizeEmail(user.email) === normalizedEmail) ||
    null
  );
}

export async function findUserById(id) {
  const db = await readDbFile();

  return db.users.find((user) => user.id === id) || null;
}

export async function findUserByStripeCustomerId(customerId) {
  const db = await readDbFile();

  return db.users.find((user) => user.stripeCustomerId === customerId) || null;
}

export async function createUser({
  name,
  email,
  passwordHash,
  passwordSalt,
  role = "member",
  status = "active",
  accessTier,
}) {
  let createdUser = null;

  await updateDb((db) => {
    const normalizedEmail = normalizeEmail(email);

    if (db.users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
      throw new Error("EMAIL_IN_USE");
    }

    const now = new Date().toISOString();
    createdUser = {
      id: randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      passwordSalt,
      role,
      status,
      accessTier: normalizeStoredAccessTier(role, accessTier),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    db.users.push(createdUser);

    return db;
  });

  return createdUser;
}

export async function touchUserLastLogin(id) {
  let updatedUser = null;

  await updateDb((db) => {
    const target = db.users.find((user) => user.id === id);

    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = new Date().toISOString();
    target.lastLoginAt = now;
    target.updatedAt = now;
    updatedUser = target;

    return db;
  });

  return updatedUser;
}

export async function updateUserAccessTier(id, accessTier) {
  let updatedUser = null;

  await updateDb((db) => {
    const target = db.users.find((user) => user.id === id);

    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = new Date().toISOString();
    target.accessTier = normalizeStoredAccessTier(target.role, accessTier);
    target.updatedAt = now;
    updatedUser = target;

    return db;
  });

  return toPublicUser(updatedUser);
}

export async function promoteUserToAdmin(id) {
  let updatedUser = null;

  await updateDb((db) => {
    const target = db.users.find((user) => user.id === id);

    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = new Date().toISOString();
    target.role = "admin";
    target.status = "active";
    target.accessTier = normalizeStoredAccessTier("admin", "paid");
    target.updatedAt = now;
    updatedUser = target;

    return db;
  });

  return updatedUser;
}

export async function updateUserBillingProfile(id, billingPatch = {}) {
  let updatedUser = null;

  await updateDb((db) => {
    const target = db.users.find((user) => user.id === id);

    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = new Date().toISOString();

    if (Object.prototype.hasOwnProperty.call(billingPatch, "stripeCustomerId")) {
      target.stripeCustomerId = billingPatch.stripeCustomerId || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(billingPatch, "stripeSubscriptionId")
    ) {
      target.stripeSubscriptionId = billingPatch.stripeSubscriptionId || null;
    }

    if (Object.prototype.hasOwnProperty.call(billingPatch, "stripePriceId")) {
      target.stripePriceId = billingPatch.stripePriceId || null;
    }

    if (Object.prototype.hasOwnProperty.call(billingPatch, "billingStatus")) {
      target.billingStatus = billingPatch.billingStatus || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        billingPatch,
        "billingCurrentPeriodEnd",
      )
    ) {
      target.billingCurrentPeriodEnd =
        billingPatch.billingCurrentPeriodEnd || null;
    }

    if (Object.prototype.hasOwnProperty.call(billingPatch, "accessTier")) {
      target.accessTier = normalizeStoredAccessTier(
        target.role,
        billingPatch.accessTier,
      );
    }

    target.billingUpdatedAt = now;
    target.updatedAt = now;
    updatedUser = target;

    return db;
  });

  return toPublicUser(updatedUser);
}

export async function listUsers() {
  const db = await readDbFile();

  return db.users
    .map((user) => toPublicUser(user))
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export async function getLandingPageDesign() {
  const db = await readDbFile();
  return normalizeLandingPageDesign(db.landingPageDesign);
}

export async function saveLandingPageDesign(design) {
  let savedDesign = null;

  await updateDb((db) => {
    savedDesign = normalizeLandingPageDesign(design);
    db.landingPageDesign = savedDesign;
    return db;
  });

  return savedDesign;
}

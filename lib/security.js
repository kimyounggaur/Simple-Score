import {
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

export function validateEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function validatePassword(password = "") {
  const issues = [];

  if (password.length < 10) {
    issues.push("비밀번호는 10자 이상이어야 합니다.");
  }

  if (!/[A-Za-z]/.test(password)) {
    issues.push("비밀번호에 영문자가 포함되어야 합니다.");
  }

  if (!/\d/.test(password)) {
    issues.push("비밀번호에 숫자가 포함되어야 합니다.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("비밀번호에 특수문자가 포함되어야 합니다.");
  }

  return issues;
}

export function validateDisplayName(name = "") {
  const value = name.trim();

  if (value.length < 2) {
    return "이름은 2자 이상이어야 합니다.";
  }

  if (value.length > 40) {
    return "이름은 40자 이하로 입력해 주세요.";
  }

  return null;
}

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const passwordHash = pbkdf2Sync(password, salt, 210000, 32, "sha256").toString(
    "hex",
  );

  return {
    passwordHash,
    passwordSalt: salt,
  };
}

export function verifyPassword(password, passwordHash, passwordSalt) {
  const calculated = pbkdf2Sync(
    password,
    passwordSalt,
    210000,
    32,
    "sha256",
  );
  const saved = Buffer.from(passwordHash, "hex");

  if (calculated.length !== saved.length) {
    return false;
  }

  return timingSafeEqual(calculated, saved);
}

function getRateStore() {
  if (!globalThis.__lessonDesignerRateLimitStore) {
    globalThis.__lessonDesignerRateLimitStore = new Map();
  }

  return globalThis.__lessonDesignerRateLimitStore;
}

export function takeRateLimitToken(key, { limit, windowMs }) {
  const store = getRateStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  entry.count += 1;
  store.set(key, entry);

  if (entry.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000),
      ),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "local";
}

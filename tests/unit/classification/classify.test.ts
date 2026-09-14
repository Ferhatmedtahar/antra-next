import { describe, expect, it } from "vitest";

import {
  classifySources,
  isSensitiveName,
  sensitivityFromConfig,
  type SensitivityConfig,
} from "../../../src/classification/classify.js";
import { DEFAULT_KEYWORDS } from "../../../src/config/defaults.js";

const defaults: SensitivityConfig = {
  keywords: DEFAULT_KEYWORDS,
  pinned: [],
  ignored: [],
};

describe("isSensitiveName — keywords", () => {
  it("matches longer keywords by normalized substring regardless of casing or separators", () => {
    expect(isSensitiveName("password_hash", defaults)).toBe(true);
    expect(isSensitiveName("passwordHash", defaults)).toBe(true);
    expect(isSensitiveName("ACCESS-TOKEN", defaults)).toBe(true);
    expect(isSensitiveName("refresh_token", defaults)).toBe(true);
    expect(isSensitiveName("apiKey", defaults)).toBe(true);
    expect(isSensitiveName("passwordhash", defaults)).toBe(true);
  });

  it("matches weak keywords (token, secret, salt …) only as whole words", () => {
    expect(isSensitiveName("accessToken", defaults)).toBe(true);
    expect(isSensitiveName("APIToken", defaults)).toBe(true);
    expect(isSensitiveName("client_secret", defaults)).toBe(true);
    expect(isSensitiveName("password_salt", defaults)).toBe(true);
    expect(isSensitiveName("totalTokens", defaults)).toBe(false);
    expect(isSensitiveName("secretaryName", defaults)).toBe(false);
    expect(isSensitiveName("tokenizer", defaults)).toBe(false);
  });

  it("no longer treats every hash as a secret by default", () => {
    expect(isSensitiveName("commitHash", defaults)).toBe(false);
    expect(isSensitiveName("content_hash", defaults)).toBe(false);
    // …but a hash of a secret is still caught through the secret's own keyword.
    expect(isSensitiveName("refresh_token_hash", defaults)).toBe(true);
    const legacy = { ...defaults, keywords: [...DEFAULT_KEYWORDS, "hash"] };
    expect(isSensitiveName("code_hash", legacy)).toBe(true);
    expect(isSensitiveName("hashtag", legacy)).toBe(false);
  });

  it("matches short keywords (≤3 chars) only as whole words", () => {
    expect(isSensitiveName("ssn", defaults)).toBe(true);
    expect(isSensitiveName("user_ssn", defaults)).toBe(true);
    expect(isSensitiveName("ssnNumber", defaults)).toBe(true);
    expect(isSensitiveName("otp_code", defaults)).toBe(true);
    // "previou-ssn-apshot": substring would fire, whole-word must not
    expect(isSensitiveName("previous_snapshot", defaults)).toBe(false);
  });

  it("leaves ordinary fields alone", () => {
    expect(isSensitiveName("email", defaults)).toBe(false);
    expect(isSensitiveName("created_at", defaults)).toBe(false);
    expect(isSensitiveName("id", defaults)).toBe(false);
    expect(isSensitiveName("session_unlock_threshold_pct", defaults)).toBe(
      false,
    );
    expect(isSensitiveName("stripe_fee_pct", defaults)).toBe(false);
  });

  it("accepts keywords in any language", () => {
    const fr = { ...defaults, keywords: ["motdepasse", "cle"] };
    expect(isSensitiveName("mot_de_passe", fr)).toBe(true);
    expect(isSensitiveName("cle_api", fr)).toBe(true);
  });

  it("ignores empty keywords", () => {
    expect(isSensitiveName("anything", { ...defaults, keywords: [""] })).toBe(
      false,
    );
  });
});

describe("isSensitiveName — pinned / ignored fields", () => {
  it("pins a field the keywords missed, by exact name or exact origin", () => {
    const sensitivity = {
      ...defaults,
      pinned: ["iban", "supabase:public.tutors.salary"],
    };
    expect(isSensitiveName("iban", sensitivity)).toBe(true);
    expect(isSensitiveName("IBAN", sensitivity)).toBe(true);
    expect(
      isSensitiveName("salary", sensitivity, "supabase:public.tutors.salary"),
    ).toBe(true);
    expect(
      isSensitiveName("salary", sensitivity, "supabase:public.jobs.salary"),
    ).toBe(false);
  });

  it("ignored wins over pinned and over keywords", () => {
    const sensitivity = {
      ...defaults,
      pinned: ["source_hash"],
      ignored: ["source_hash", "supabase:public.sessions.session_token"],
    };
    expect(isSensitiveName("source_hash", sensitivity)).toBe(false);
    expect(isSensitiveName("sourceHash", sensitivity)).toBe(false);
    expect(
      isSensitiveName(
        "session_token",
        sensitivity,
        "supabase:public.sessions.session_token",
      ),
    ).toBe(false);
    expect(
      isSensitiveName(
        "session_token",
        sensitivity,
        "supabase:public.other.session_token",
      ),
    ).toBe(true);
  });
});

describe("sensitivityFromConfig", () => {
  it("maps config sections and folds the legacy keywords.exclude into ignored", () => {
    expect(
      sensitivityFromConfig({
        keywords: { include: ["token"], exclude: ["legacy_token"] },
        sensitiveFields: { include: ["iban"], exclude: ["source_hash"] },
      }),
    ).toEqual({
      keywords: ["token"],
      pinned: ["iban"],
      ignored: ["source_hash", "legacy_token"],
    });
  });
});

describe("classifySources", () => {
  it("keeps keyword hits and pins, drops ignores", () => {
    const sources = [
      { field: "id", origin: "prisma:User.id" },
      { field: "passwordHash", origin: "prisma:User.passwordHash" },
      { field: "iban", origin: "prisma:Payout.iban" },
      { field: "source_hash", origin: "prisma:Doc.source_hash" },
    ];
    const sensitivity = {
      ...defaults,
      pinned: ["iban"],
      ignored: ["source_hash"],
    };
    expect(classifySources(sources, sensitivity).map((s) => s.field)).toEqual([
      "passwordHash",
      "iban",
    ]);
  });
});

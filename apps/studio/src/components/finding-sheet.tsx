import {
  IconArrowDown,
  IconBulb,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconFingerprint,
  IconHierarchy,
  IconInfoCircle,
  IconRoute,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

import type { FindingDetail } from "../../../../src/studio/types.js";

import {
  CodeFrame,
  RuleTag,
  SeverityPill,
  StatusPill,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { suppressionComment } from "@/format";
import { cn } from "@/lib/utils";

/** The dataflow as a vertical flow: origin at the top, the sink at the bottom. */
export function TracePath({ finding }: { finding: FindingDetail }) {
  const steps = [...finding.trace].reverse();
  const box = "rounded-mid px-3 py-2 font-mono text-code leading-5 break-all";
  return (
    <ol className="flex flex-col items-stretch">
      {steps.map((step, index) => {
        const text = typeof step === "string" ? step : step.text;
        const file = typeof step === "object" ? step.file : undefined;
        const line = typeof step === "object" ? step.line : undefined;
        return (
          <li key={index} className="flex flex-col">
            <div
              className={cn(
                box,
                index === 0
                  ? "bg-surface-soft text-foreground"
                  : "bg-surface-soft/60 text-muted-foreground",
              )}
            >
              <div className="text-muted-foreground mb-0.5 flex items-center justify-between font-sans text-[10px]">
                <span className="font-medium">
                  {index === 0 ? "origin" : `step ${index}`}
                </span>
                {file ? (
                  <span
                    className="font-mono text-[10px] opacity-75"
                    title={`${file}${line ? `:${line}` : ""}`}
                  >
                    {file}
                    {line ? `:${line}` : ""}
                  </span>
                ) : null}
              </div>
              <div>{text}</div>
            </div>
            <IconArrowDown className="text-muted-foreground my-1 size-4 self-center" />
          </li>
        );
      })}
      <li className={cn(box, "bg-destructive/10 text-destructive")}>
        <div className="text-destructive mb-0.5 flex items-center justify-between font-sans text-[10px]">
          <span className="font-medium">sink</span>
          <span className="font-mono text-[10px] opacity-90">
            {finding.file}:{finding.line}
          </span>
        </div>
        <div>{finding.snippet}</div>
      </li>
    </ol>
  );
}

interface RuleGuidance {
  title: string;
  tagline: string;
  isTypeError: string;
  whyItMatters: string;
  options: {
    title: string;
    description: string;
    badge?: string;
    before?: string;
    after: string;
  }[];
}

const GUIDANCE: Record<string, RuleGuidance> = {
  "BG-003": {
    title: "Opaque Ingress Object Pass",
    tagline:
      "A raw database row or API response is sent whole to the client (Client Component prop, Server Action return, or route response) without field projection.",
    isTypeError:
      "This is NOT a TypeScript typing error. TypeScript types are erased at compile time and provide zero runtime boundary protection. React Server Components serialize the entire runtime JavaScript object across the network via the Flight protocol. Even if your Client Component only renders a user's name, every extra column returned by the database (like emails, phone numbers, or future migration fields) is serialized and exposed in the browser's Network tab.",
    whyItMatters:
      "Passing entire objects wholesale or spreading them ({...targetUser}) means whatever columns the backend query returns — today or after the next database migration — are silently transmitted to untrusted client browsers.",
    options: [
      {
        title: "Option 1: Explicit Field Projection (Recommended)",
        badge: "Recommended",
        description:
          "Pick only the specific properties the client component actually needs. This prevents unseen backend columns from leaking over the network.",
        before: `// ❌ Leaks all database columns to the client Flight payload\n<StudentProfileScreen user={studentUser} />`,
        after: `// ✅ Whitelist only the fields required by the client UI\n<StudentProfileScreen\n  user={{\n    id: studentUser.id,\n    firstName: studentUser.first_name,\n    lastName: studentUser.last_name,\n    experiences: studentUser.experiences,\n  }}\n/>`,
      },
      {
        title: "Option 2: Schema / DTO Sanitizer (e.g. Zod)",
        description:
          "Parse or transform the object through a runtime validator or DTO mapping function before passing it across the boundary. Antra recognizes configured sanitizers.",
        after: `// ✅ Use a Zod schema or DTO to strip unknown/sensitive fields\nconst safeProfile = publicProfileSchema.parse(studentUser);\n<StudentProfileScreen user={safeProfile} />`,
      },
      {
        title: "Option 3: Inline Suppression (If Intentionally Public)",
        description:
          "If you have verified that the entire object contains only public information and no sensitive columns, suppress the warning with a clear reason comment.",
        after: `{/* antra-disable-next-line BG-003 reason="public student profile DTO verified" */}\n<StudentProfileScreen user={studentUser} />`,
      },
    ],
  },
  "BG-001": {
    title: "Server-to-Client Sensitive Field Leak",
    tagline:
      "A specific sensitive field (from DB schema, env secret, or sensitive keyword) reaches the client through a Client Component prop, a Server Action return, or a route response.",
    isTypeError:
      "This is triggered by a concrete sensitive data source (e.g. password_hash, token, secret, stripe_id, or process.env secret) leaving the server: as a Client Component prop, as a Server Action's return value, or in a route handler's response body.",
    whyItMatters:
      "Any prop passed into a 'use client' component is serialized into the initial HTML and Flight response. The client browser can read this value directly via browser DevTools or Network inspect.",
    options: [
      {
        title: "Option 1: Keep Sensitive Computation on the Server",
        badge: "Recommended",
        description:
          "Do not pass the raw sensitive field to the browser. Perform checks, hashing, or decisions on the server and pass only safe derived data (like a boolean flag).",
        before: `// ❌ Leaks the password or secret token to the browser\n<AuthStatus token={user.reset_token} />`,
        after: `// ✅ Pass only a safe boolean or non-sensitive status\n<AuthStatus hasPendingReset={Boolean(user.reset_token)} />`,
      },
      {
        title: "Option 2: Exclude Non-Sensitive False Positives",
        description:
          "If a field matched a keyword but is actually harmless (e.g. public_share_token or page_token), exclude it in your antra.config.json under sensitiveFields.exclude.",
        after: `// In antra.config.json:\n"sensitiveFields": {\n  "exclude": ["public_share_token"]\n}`,
      },
    ],
  },
  "BG-002": {
    title: "Unvalidated Server Action or Route Handler",
    tagline:
      "A Server Action or Route Handler accepts external inputs without running an approved validator or sanitizer.",
    isTypeError:
      "Server Actions and route handlers are public HTTP endpoints callable by anyone. TypeScript types (like \`data: { id: string }\`) are not runtime validation.",
    whyItMatters:
      "Without runtime schema validation (like Zod, Valibot, or ArkType), malicious users can send unexpected types, prototypes, or arbitrary payloads directly into your backend logic.",
    options: [
      {
        title: "Option 1: Validate with Zod / Valibot",
        badge: "Recommended",
        description:
          "Parse incoming arguments or request bodies through a schema before using them in database queries or service calls.",
        after: `export async function updateProfile(formData: FormData) {\n  "use server";\n  const validated = ProfileSchema.parse(Object.fromEntries(formData));\n  await db.update(validated);\n}`,
      },
      {
        title: "Option 2: Use an Action Library (next-safe-action)",
        description:
          "Wrap your server actions in next-safe-action or similar middleware registered in antra.config.json.",
        after: `export const updateProfile = actionClient\n  .schema(ProfileSchema)\n  .action(async ({ parsedInput }) => {\n    // validated input is safe\n  });`,
      },
    ],
  },
  "BG-004": {
    title: "Secret Exposed in Markup",
    tagline:
      "A sensitive field or secret environment variable is rendered directly into an HTML tag or text.",
    isTypeError:
      "A secret (like an API secret key or password hash) is passed into an intrinsic HTML attribute or text node.",
    whyItMatters:
      "Values in HTML tags (<p>{secret}</p> or <input value={secret} />) are exposed directly in the DOM and visible to end users and screen readers.",
    options: [
      {
        title: "Option 1: Remove Secret from Markup",
        badge: "Recommended",
        description:
          "Secrets should never be rendered in markup. Use server-side actions or masked indicators instead.",
        after: `// ✅ Display a masked representation or indicator\n<p>API Key: ••••••••••••{key.slice(-4)}</p>`,
      },
    ],
  },
};

export function RemediationGuide({ ruleId }: { ruleId: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const guide = GUIDANCE[ruleId];

  if (!guide) return null;

  return (
    <div className="rounded-big border border-border/80 bg-surface-soft/40 p-4 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-icon bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <IconBulb className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-title-3 font-semibold text-foreground">
                How to fix this &amp; What it means
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                Fix Guide
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{guide.tagline}</p>
          </div>
        </div>
        <div className="text-muted-foreground hover:text-foreground">
          {isOpen ? (
            <IconChevronUp className="size-5" />
          ) : (
            <IconChevronDown className="size-5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-border/60 pt-3 text-xs leading-relaxed">
          <div className="rounded-mid bg-background/80 p-3 border border-border/50">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
              <IconInfoCircle className="size-4 text-primary" />
              <span>Is this a TypeScript error or a sensitive value?</span>
            </div>
            <p className="text-muted-foreground">{guide.isTypeError}</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
              Recommended Fixes
            </h4>

            {guide.options.map((option, idx) => (
              <div
                key={idx}
                className="rounded-mid border border-border/40 bg-background/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {option.title}
                  </span>
                  {option.badge && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0 h-4"
                    >
                      {option.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{option.description}</p>

                {option.before && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-destructive">
                      <IconX className="size-3" /> Before:
                    </div>
                    <pre className="overflow-x-auto rounded-icon bg-destructive/20 p-2 font-mono text-[11px] text-destructive ">
                      <code>{option.before}</code>
                    </pre>
                  </div>
                )}

                {option.after && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      <IconCheck className="size-3" />{" "}
                      {option.before ? "After:" : "Example:"}
                    </div>
                    <pre className="overflow-x-auto rounded-icon bg-emerald-500/20 p-2 font-mono text-[11px] text-foreground ">
                      <code>{option.after}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FindingSheet({
  finding,
  onClose,
}: {
  finding: FindingDetail | null;
  onClose: () => void;
}) {
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };
  return (
    <Sheet
      open={finding !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-2xl bg-card border-none rounded-l-huge">
        {finding ? (
          <>
            <SheetHeader className="px-6 py-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <RuleTag id={finding.ruleId} />
                <SeverityPill severity={finding.severity} />
                <StatusPill status={finding.status} />
              </div>
              <SheetTitle className="mt-2 text-title text-foreground font-semibold">
                {finding.message}
              </SheetTitle>
              <SheetDescription className="text-code text-muted-foreground">
                {finding.file}:{finding.line}:{finding.column}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {finding.frame ? (
                <CodeFrame
                  frame={finding.frame}
                  line={finding.line}
                  column={finding.column}
                  snippet={finding.snippet}
                />
              ) : (
                <pre className="bg-surface-soft rounded-mid px-3 py-2 font-mono text-code border-none">
                  {finding.snippet}
                </pre>
              )}
              <RemediationGuide ruleId={finding.ruleId} />
              {finding.trace.length > 0 ? (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-label-3-sb text-foreground">
                    <IconRoute className="text-foreground size-4" />
                    How the value got here
                  </h3>
                  <TracePath finding={finding} />
                </div>
              ) : null}
              {finding.suppressReason !== null ? (
                <p className="text-muted-foreground text-body-2-r">
                  Suppressed in source
                  {finding.suppressReason
                    ? `: “${finding.suppressReason}”`
                    : ""}
                  .
                </p>
              ) : null}
            </div>
            <SheetFooter className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    void copy(
                      suppressionComment(finding.ruleId),
                      "Suppression comment",
                    )
                  }
                >
                  <IconCopy /> Copy suppression comment
                </Button>
                <Button variant="ghost" asChild>
                  <Link
                    href={`/graph?focus=${encodeURIComponent(finding.file)}`}
                    onClick={onClose}
                  >
                    <IconHierarchy /> Show in graph
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void copy(finding.fingerprint, "Fingerprint")}
                >
                  <IconFingerprint /> {finding.fingerprint}
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

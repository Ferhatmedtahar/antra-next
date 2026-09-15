/**
 * Per-rule remediation prose.
 *
 * This is the single source for both the Studio sheet's "How to fix this"
 * accordion and the fix prompt rendered by `src/studio/prompt.ts`, so the two
 * can never disagree about what a rule means or how to fix it.
 *
 * Keep in step with the docs site's `apps/web/content/docs/rules/bg-00N.mdx`.
 */

export interface RuleGuidance {
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

export const GUIDANCE: Record<string, RuleGuidance> = {
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
        before: `// Leaks all database columns to the client Flight payload\n<StudentProfileScreen user={studentUser} />`,
        after: `// Whitelist only the fields required by the client UI\n<StudentProfileScreen\n  user={{\n    id: studentUser.id,\n    firstName: studentUser.first_name,\n    lastName: studentUser.last_name,\n    experiences: studentUser.experiences,\n  }}\n/>`,
      },
      {
        title: "Option 2: Schema / DTO Sanitizer (e.g. Zod)",
        description:
          "Parse or transform the object through a runtime validator or DTO mapping function before passing it across the boundary. Antra recognizes configured sanitizers.",
        after: `// Use a Zod schema or DTO to strip unknown/sensitive fields\nconst safeProfile = publicProfileSchema.parse(studentUser);\n<StudentProfileScreen user={safeProfile} />`,
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
        before: `// Leaks the password or secret token to the browser\n<AuthStatus token={user.reset_token} />`,
        after: `// Pass only a safe boolean or non-sensitive status\n<AuthStatus hasPendingReset={Boolean(user.reset_token)} />`,
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
        after: `// Display a masked representation or indicator\n<p>API Key: ••••••••••••{key.slice(-4)}</p>`,
      },
    ],
  },
};

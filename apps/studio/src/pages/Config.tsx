import {
  IconAdjustmentsHorizontal,
  IconBan,
  IconListCheck,
  IconLoader2,
  IconPin,
  IconPlug,
  IconTags,
  IconWand,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { StudioConfig } from "../../../../src/studio/types.js";

import { api, ApiError } from "@/api";
import { SIDEBAR_WIDTH } from "@/layout";
import { SectionHeader } from "@/components/section-header";
import {
  ChipEditor,
  Empty,
  ErrorNote,
  ErrorState,
  PageHeader,
  RuleTag,
  SeverityPill,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLoad, useRefresh } from "@/hooks";
import { cn } from "@/lib/utils";

export function Config() {
  const loaded = useLoad(() => api.config());
  const rules = useLoad(() => api.rules());
  const { bump } = useRefresh();
  const [draft, setDraft] = useState<StudioConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded.data !== undefined)
      setDraft(loaded.data ? structuredClone(loaded.data) : null);
  }, [loaded.data]);

  if (loaded.error) {
    return <ErrorState description={loaded.error} retry={loaded.reload} />;
  }
  if (loaded.data === null && !loaded.loading) {
    return (
      <>
        <PageHeader title="Config" />
        <Empty
          icon={<IconAdjustmentsHorizontal />}
          title="No config yet"
          body="Run `antra init` in the project first. Everything in antra.config.json is editable here afterwards."
          action={
            <Button variant="secondary" onClick={loaded.reload}>
              Check again
            </Button>
          }
        />
      </>
    );
  }
  if (!draft || !loaded.data) {
    return (
      <>
        <PageHeader title="Config" />
        <Skeleton className="h-64 rounded-xl" />
      </>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.data);
  const patch = (next: Partial<StudioConfig>) =>
    setDraft({ ...draft, ...next });

  const save = async () => {
    setSaving(true);
    try {
      await api.saveConfig(draft);
      toast.success("Config saved", {
        description: "Run a scan to see the effect.",
      });
      bump();
    } catch (error) {
      if (error instanceof ApiError && Array.isArray(error.issues)) {
        const first = error.issues[0] as
          { path?: unknown[]; message?: string } | undefined;
        toast.error("Not saved", {
          description: `${first?.path?.join(".") ?? "config"} — ${first?.message ?? "invalid"}`,
        });
      } else {
        toast.error("Could not save", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Config"
        description="Everything here is antra.config.json. Saving writes the file; the CLI reads the same one."
      />

      <div className="space-y-5 pb-24">
        <Card>
          <CardHeader>
            <SectionHeader
              glyph={<IconListCheck />}
              title="Rules"
              description="Switch a rule off and every scan skips it."
            />
          </CardHeader>
          <CardContent>
            <ul className="divide-divider-subtle divide-y rounded-huge bg-surface-soft overflow-hidden">
              {(rules.data ?? []).map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-6 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RuleTag id={rule.id} />
                    <span className="truncate text-body-2-m text-foreground">
                      {rule.description}
                    </span>
                    <SeverityPill severity={rule.severity} />
                  </div>
                  <Switch
                    checked={draft.rules[rule.id] !== false}
                    onCheckedChange={(on) =>
                      patch({ rules: { ...draft.rules, [rule.id]: on } })
                    }
                    aria-label={`Enable ${rule.id}`}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              glyph={<IconTags />}
              title="Sensitivity keywords"
              description="Name patterns, any language. Four letters or more match inside a name (token → accessToken); three or fewer match whole words only (ssn)."
            />
          </CardHeader>
          <CardContent>
            <ChipEditor
              values={draft.keywords.include}
              onChange={(include) =>
                patch({ keywords: { ...draft.keywords, include } })
              }
              placeholder="Add a keyword and press Enter"
            />
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <SectionHeader
                glyph={<IconPin />}
                title="Pinned fields"
                description="Always sensitive — exact field names or origins the keywords miss."
              />
            </CardHeader>
            <CardContent>
              <ChipEditor
                mono
                values={draft.sensitiveFields.include}
                onChange={(include) =>
                  patch({
                    sensitiveFields: { ...draft.sensitiveFields, include },
                  })
                }
                placeholder="iban or supabase:public.users.iban"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <SectionHeader
                glyph={<IconBan />}
                title="Ignored fields"
                description="Never sensitive. Ignore wins over pins and keywords."
              />
            </CardHeader>
            <CardContent>
              <ChipEditor
                mono
                values={draft.sensitiveFields.exclude}
                onChange={(exclude) =>
                  patch({
                    sensitiveFields: { ...draft.sensitiveFields, exclude },
                  })
                }
                placeholder="source_hash"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <SectionHeader
              glyph={<IconWand />}
              title="Sanitizers"
              description="A call to one of these breaks the taint chain and counts as validation for BG-002. Known: zod, valibot, yup, joi, arktype, next-safe-action — anything else matches as a function or method name."
            />
          </CardHeader>
          <CardContent>
            <ChipEditor
              mono
              values={draft.sanitizers}
              onChange={(sanitizers) => patch({ sanitizers })}
              placeholder="sanitizeUser"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              glyph={<IconPlug />}
              title="Providers"
              description={`Framework: ${draft.frameworkAdapter}. Provider paths change through init; the snapshot refreshes with sync.`}
            />
          </CardHeader>
          <CardContent>
            {draft.providers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                None configured — zero-schema heuristics only. Run `antra init`
                to add one.
              </p>
            ) : (
              <ul className="divide-divider-subtle divide-y rounded-huge bg-surface-soft overflow-hidden">
                {draft.providers.map((provider) => (
                  <li
                    key={provider.id}
                    className="flex items-baseline gap-4 px-5 py-3.5"
                  >
                    <span className="text-body-2-m font-medium">
                      {provider.id}
                    </span>
                    <span className="text-muted-foreground font-mono text-code">
                      {Object.entries(provider)
                        .filter(([key]) => key !== "id")
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join("  ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div
        className={cn(
          "bg-card/95 fixed right-0 bottom-0 z-10 px-10 py-4 backdrop-blur transition-transform",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
        style={{ left: SIDEBAR_WIDTH }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <span className="text-sm font-medium">Unsaved changes</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setDraft(structuredClone(loaded.data))}
            >
              Discard
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <IconLoader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

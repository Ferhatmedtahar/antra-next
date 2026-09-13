import { IconDatabase, IconKey, IconTable } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Link } from "wouter";

import type {
  SourceField,
  StudioConfig,
} from "../../../../src/studio/types.js";

import { api } from "@/api";
import {
  Empty,
  ErrorNote,
  ErrorState,
  ListNote,
  ListPanel,
  LoadingRows,
  PageHeader,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatAbsolute, splitOrigin } from "@/format";
import { useLoad, useRefresh } from "@/hooks";
import { cn } from "@/lib/utils";

type View = "sensitive" | "all";

export function Sources() {
  const sources = useLoad(() => api.sources());
  const config = useLoad(() => api.config());
  const { bump } = useRefresh();
  const [view, setView] = useState<View>("sensitive");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const fields = sources.data?.fields ?? [];
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = fields.filter(
      (f) =>
        (view === "all" || f.sensitive || f.pinned || f.ignored) &&
        (q === "" || f.origin.toLowerCase().includes(q)),
    );
    const byContainer = new Map<
      string,
      { provider: string; container: string; fields: SourceField[] }
    >();
    for (const field of visible) {
      const { provider, container } = splitOrigin(field.origin);
      const key = `${provider}:${container}`;
      const group = byContainer.get(key) ?? { provider, container, fields: [] };
      group.fields.push(field);
      byContainer.set(key, group);
    }
    return [...byContainer.values()];
  }, [fields, view, query]);
  const sensitiveCount = fields.filter((f) => f.sensitive).length;

  const update = async (
    field: SourceField,
    change: "pin" | "ignore",
    on: boolean,
  ) => {
    const current = config.data;
    if (!current) return;
    const list =
      change === "pin"
        ? current.sensitiveFields.include
        : current.sensitiveFields.exclude;
    const without = list.filter(
      (entry) => entry !== field.origin && entry !== field.field,
    );
    const nextList = on ? [...without, field.origin] : without;
    const next: StudioConfig = {
      ...current,
      sensitiveFields:
        change === "pin"
          ? { ...current.sensitiveFields, include: nextList }
          : { ...current.sensitiveFields, exclude: nextList },
    };
    setSaving(field.origin);
    try {
      await api.saveConfig(next);
      const verb =
        change === "pin"
          ? on
            ? "pinned as sensitive"
            : "unpinned"
          : on
            ? "ignored"
            : "no longer ignored";
      toast.success(`${field.field} ${verb}`, {
        description: "Run a scan to apply.",
      });
      bump();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(null);
    }
  };

  if (sources.error) {
    return <ErrorState description={sources.error} retry={sources.reload} />;
  }
  if (config.data === null && !config.loading) {
    return (
      <>
        <PageHeader title="Sources" />
        <Empty
          icon={<IconDatabase />}
          title="No config yet"
          body="Run `antra init` in the project to pick a schema provider and build the snapshot."
          action={
            <Button variant="secondary" asChild>
              <Link href="/config">Open Config</Link>
            </Button>
          }
        />
      </>
    );
  }
  if (sources.data && fields.length === 0) {
    return (
      <>
        <PageHeader title="Sources" />
        <Empty
          icon={<IconDatabase />}
          title="The snapshot is empty"
          body="No schema fields were extracted. Check the provider path in Config, then run `antra sync`."
          action={
            <Button variant="secondary" asChild>
              <Link href="/config">Check configuration</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sources"
        description={
          <>
            {sensitiveCount} of {fields.length} schema fields are taint origins.
            {sources.data?.generatedAt
              ? ` Snapshot taken ${formatAbsolute(sources.data.generatedAt)}.`
              : ""}{" "}
            Pin what the keywords missed, ignore a false positive. Ignore always
            wins.
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(value) =>
            setView(value === "all" ? "all" : "sensitive")
          }
        >
          <TabsList variant="underline">
            <TabsTrigger value="sensitive">
              Sensitive
              <Badge
                variant="soft-muted"
                className="ml-1.5 h-5 px-1.5 tabular-nums"
              >
                {sensitiveCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all">
              All
              <Badge
                variant="soft-muted"
                className="ml-1.5 h-5 px-1.5 tabular-nums"
              >
                {fields.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-72">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Filter by table or field"
          />
        </div>
      </div>

      {!sources.data ? (
        <LoadingRows />
      ) : (
        <ListPanel>
          {groups.length === 0 ? (
            <ListNote>Nothing matches that filter.</ListNote>
          ) : null}
          {groups.map((group) => (
            <div key={`${group.provider}:${group.container}`}>
              <div className="bg-surface-soft flex items-center gap-2.5 px-5 py-2.5">
                <IconTable className="text-muted-foreground size-4" />
                <span className="font-mono text-sm font-semibold">
                  {group.container}
                </span>
                <span className="text-muted-foreground text-xs">
                  {group.fields.length} field
                  {group.fields.length === 1 ? "" : "s"} from {group.provider}
                </span>
              </div>
              <ul className="divide-y divide-divider-subtle">
                {group.fields.map((f) => (
                  <li
                    key={f.origin}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-6 px-5 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                      {f.sensitive ? (
                        <IconKey className="text-destructive size-4 shrink-0" />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "truncate",
                          f.sensitive && "text-destructive font-medium",
                        )}
                      >
                        {f.field}
                      </span>
                    </span>
                    <span className="flex justify-end gap-1">
                      {f.ignored ? (
                        <Badge variant="soft-muted">ignored</Badge>
                      ) : null}
                      {f.keywordHit ? (
                        <Badge
                          variant={
                            f.ignored ? "soft-muted" : "soft-destructive"
                          }
                        >
                          keyword
                        </Badge>
                      ) : null}
                      {f.pinned ? (
                        <Badge
                          variant={
                            f.ignored ? "soft-muted" : "soft-destructive"
                          }
                        >
                          pinned
                        </Badge>
                      ) : null}
                    </span>
                    <label className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Switch
                        checked={f.pinned}
                        disabled={saving === f.origin}
                        onCheckedChange={(on) => void update(f, "pin", on)}
                        aria-label={`Pin ${f.origin}`}
                      />
                      Pin
                    </label>
                    <label className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Switch
                        checked={f.ignored}
                        disabled={saving === f.origin}
                        onCheckedChange={(on) => void update(f, "ignore", on)}
                        aria-label={`Ignore ${f.origin}`}
                      />
                      Ignore
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </ListPanel>
      )}
    </>
  );
}

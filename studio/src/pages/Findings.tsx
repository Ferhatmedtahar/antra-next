import {
  IconAlertTriangle,
  IconChevronRight,
  IconCopy,
  IconFingerprint,
  IconRoute,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

import type {
  FindingDetail,
  FindingStatus,
  RuleId,
} from "../../../src/studio/types.js";

import { api } from "@/api";
import {
  CodeFrame,
  Crossing,
  Empty,
  ErrorNote,
  ListPanel,
  LoadingRows,
  PageHeader,
  RuleTag,
  SeverityPill,
  StatusPill,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatAbsolute, formatRelative, suppressionComment } from "@/format";
import { useLoad } from "@/hooks";
import { cn } from "@/lib/utils";

type StatusFilter = FindingStatus | "all";
const RULES: RuleId[] = ["BG-001", "BG-002", "BG-003", "BG-004"];
const STATUSES: StatusFilter[] = ["active", "baselined", "suppressed", "all"];
const isStatus = (value: string): value is StatusFilter =>
  (STATUSES as string[]).includes(value);
const isRule = (value: string): value is RuleId =>
  (RULES as string[]).includes(value);

export function Findings() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const requested = Number(new URLSearchParams(search).get("scan"));
  const project = useLoad(() => api.project());
  const scans = useLoad(() => api.scans());
  const scanId =
    Number.isInteger(requested) && requested > 0
      ? requested
      : (project.data?.latest?.id ?? null);
  const detail = useLoad(
    () => (scanId === null ? Promise.resolve(null) : api.scan(scanId)),
    [scanId],
  );

  const [status, setStatus] = useState<StatusFilter>("active");
  const [rules, setRules] = useState<RuleId[]>(RULES);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FindingDetail | null>(null);

  const findings = detail.data?.findings ?? [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter(
      (f) =>
        (status === "all" || f.status === status) &&
        rules.includes(f.ruleId) &&
        (q === "" ||
          f.file.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q)),
    );
  }, [findings, status, rules, query]);

  const counts = {
    active: findings.filter((f) => f.status === "active").length,
    baselined: findings.filter((f) => f.status === "baselined").length,
    suppressed: findings.filter((f) => f.status === "suppressed").length,
  };

  if (project.error) return <ErrorNote message={project.error} />;
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader icon={<IconAlertTriangle />} title="Findings" />
        <Empty
          icon={<IconAlertTriangle />}
          title="No scans yet"
          body="Run a scan from the sidebar. Findings show up here with a code frame and the path the value took."
        />
      </>
    );
  }

  const emptyState = () => {
    if (findings.length === 0) {
      return (
        <Empty
          icon={<IconAlertTriangle />}
          title="Nothing crossed the boundary"
          body="This scan found no sensitive value reaching a client component, no unvalidated input, and no secret in markup."
        />
      );
    }
    if (status === "active" && counts.active === 0 && query === "") {
      return (
        <Empty
          icon={<IconAlertTriangle />}
          title="Nothing new"
          body={`${counts.baselined} finding${counts.baselined === 1 ? "" : "s"} accepted in the baseline${
            counts.suppressed > 0
              ? `, ${counts.suppressed} suppressed in source`
              : ""
          }. Nothing has appeared since.`}
          action={
            counts.baselined > 0 ? (
              <Button variant="outline" onClick={() => setStatus("baselined")}>
                Browse the baseline
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Empty
        icon={<IconSearch />}
        title="No findings match these filters"
        body="Widen the status or rule filters, or clear the search."
      />
    );
  };

  return (
    <>
      <PageHeader
        icon={<IconAlertTriangle />}
        title="Findings"
        description={
          detail.data ? (
            <>
              Scan #{detail.data.scan.id} ·{" "}
              {formatAbsolute(detail.data.scan.startedAt)} · {counts.active}{" "}
              new, {counts.baselined} accepted, {counts.suppressed} suppressed
            </>
          ) : null
        }
        action={
          scans.data && scans.data.length > 1 && scanId !== null ? (
            <Select
              value={String(scanId)}
              onValueChange={(value) => navigate(`/findings?scan=${value}`)}
            >
              <SelectTrigger className="w-56" aria-label="Choose a scan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scans.data.map((scan) => (
                  <SelectItem key={scan.id} value={String(scan.id)}>
                    Scan #{scan.id} · {formatRelative(scan.startedAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={status}
          onValueChange={(value) => {
            if (isStatus(value)) setStatus(value);
          }}
        >
          <TabsList>
            <TabsTrigger value="active">
              New <Count n={counts.active} />
            </TabsTrigger>
            <TabsTrigger value="baselined">
              Accepted <Count n={counts.baselined} />
            </TabsTrigger>
            <TabsTrigger value="suppressed">
              Suppressed <Count n={counts.suppressed} />
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={rules}
          onValueChange={(values) => setRules(values.filter(isRule))}
          aria-label="Rules"
        >
          {RULES.map((rule) => (
            <ToggleGroupItem
              key={rule}
              value={rule}
              className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary px-3 font-mono text-xs"
            >
              {rule}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative ml-auto">
          <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by file or message"
            className="w-72 pl-9"
          />
        </div>
      </div>

      {detail.error ? <ErrorNote message={detail.error} /> : null}
      {!detail.data && !detail.error ? <LoadingRows /> : null}
      {detail.data && visible.length === 0 ? emptyState() : null}

      {visible.length > 0 ? (
        <ListPanel>
          {visible.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelected(f)}
              className="hover:bg-accent/50 focus-visible:bg-accent/50 flex w-full items-stretch gap-4 px-5 py-3.5 text-left outline-none"
            >
              <span
                aria-hidden
                className={cn(
                  "w-1 shrink-0 self-stretch rounded-full",
                  f.severity === "error" ? "bg-destructive" : "bg-warning",
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <RuleTag id={f.ruleId} />
                  <span className="line-clamp-2 text-sm font-medium">
                    {f.message}
                  </span>
                </span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="truncate">
                    {f.file}
                    <span className="opacity-70">
                      :{f.line}:{f.column}
                    </span>
                  </span>
                  {f.ruleId === "BG-001" || f.ruleId === "BG-003" ? (
                    <Crossing />
                  ) : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <StatusPill status={f.status} />
                <IconChevronRight className="text-muted-foreground size-4" />
              </span>
            </button>
          ))}
        </ListPanel>
      ) : null}

      <FindingSheet finding={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Badge
      variant="soft-muted"
      className="ml-1 h-5 min-w-5 px-1.5 tabular-nums"
    >
      {n}
    </Badge>
  );
}

function FindingSheet({
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
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        {finding ? (
          <>
            <SheetHeader className="border-b px-6 py-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <RuleTag id={finding.ruleId} />
                <SeverityPill severity={finding.severity} />
                <StatusPill status={finding.status} />
              </div>
              <SheetTitle className="mt-1 text-base leading-relaxed font-medium">
                {finding.message}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
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
                <pre className="bg-muted/60 rounded-lg border px-3 py-2 font-mono text-[13px]">
                  {finding.snippet}
                </pre>
              )}
              {finding.trace.length > 0 ? (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <IconRoute className="text-primary size-4" />
                    How the value got here
                  </h3>
                  <ol className="space-y-2">
                    {finding.trace.map((step, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums">
                          {index + 1}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs leading-5 break-all">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {finding.suppressReason !== null ? (
                <p className="text-muted-foreground text-sm">
                  Suppressed in source
                  {finding.suppressReason
                    ? `: “${finding.suppressReason}”`
                    : ""}
                  .
                </p>
              ) : null}
            </div>
            <SheetFooter className="border-t px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void copy(
                      suppressionComment(finding.ruleId),
                      "Suppression comment",
                    )
                  }
                >
                  <IconCopy /> Copy suppression comment
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

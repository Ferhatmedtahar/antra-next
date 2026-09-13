import {
  IconAlertTriangle,
  IconChevronRight,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

import type {
  FindingDetail,
  FindingStatus,
  RuleId,
} from "../../../../src/studio/types.js";

import { api } from "@/api";
import { FindingSheet } from "@/components/finding-sheet";
import {
  Empty,
  ErrorNote,
  ErrorState,
  ListPanel,
  LoadingRows,
  PageHeader,
  RuleTag,
  RunScanButton,
  StatusPill,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatRelative } from "@/format";
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

  if (project.error) {
    return <ErrorState description={project.error} retry={project.reload} />;
  }
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader title="Findings" />
        <Empty
          icon={<IconAlertTriangle />}
          title="No scans yet"
          body="Run a scan from below or the sidebar. Findings show up here with a code frame and the path the value took."
          action={<RunScanButton />}
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
          action={
            <RunScanButton variant="secondary" label="Run another scan" />
          }
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
              <Button
                variant="secondary"
                onClick={() => setStatus("baselined")}
              >
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
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setStatus("all");
              setRules(RULES);
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        }
      />
    );
  };

  return (
    <>
      <PageHeader
        title="Findings"
        description={
          detail.data ? (
            <>
              Scan #{detail.data.scan.id}, run{" "}
              {formatRelative(detail.data.scan.startedAt)}. {counts.active} new,{" "}
              {counts.baselined} accepted, {counts.suppressed} suppressed.
            </>
          ) : null
        }
        action={
          scans.data && scans.data.length > 1 && scanId !== null ? (
            <Select
              value={String(scanId)}
              onValueChange={(value) => navigate(`/findings?scan=${value}`)}
            >
              <SelectTrigger
                className="w-56 bg-surface-soft border-none rounded-big"
                aria-label="Choose a scan"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-none rounded-big">
                {scans.data.map((scan) => (
                  <SelectItem key={scan.id} value={String(scan.id)}>
                    Scan {scan.id}, {formatRelative(scan.startedAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {/* Row 1: Underline tabs */}
      <div className="mb-4">
        <Tabs
          value={status}
          onValueChange={(value) => {
            if (isStatus(value)) setStatus(value);
          }}
          className="w-full"
        >
          <TabsList variant="underline">
            <TabsTrigger value="active">
              New{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.active}
              </span>
            </TabsTrigger>
            <TabsTrigger value="baselined">
              Accepted{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.baselined}
              </span>
            </TabsTrigger>
            <TabsTrigger value="suppressed">
              Suppressed{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.suppressed}
              </span>
            </TabsTrigger>
            <TabsTrigger value="all">
              All{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {findings.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Row 2: Search input + Rule chips */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="w-80">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Filter by file or message"
          />
        </div>
        <ToggleGroup
          type="multiple"
          variant="chips"
          size="default"
          value={rules}
          onValueChange={(values) => setRules(values.filter(isRule))}
          aria-label="Rules"
          className="ml-auto"
        >
          {RULES.map((rule) => (
            <ToggleGroupItem key={rule} value={rule}>
              {rule}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
              className="group hover:bg-surface-soft/60 focus-visible:bg-surface-soft/60 flex w-full items-stretch gap-4 px-6 py-4 text-left outline-none transition-colors cursor-pointer"
            >
              <span
                aria-hidden
                className={cn(
                  "w-1 shrink-0 self-stretch rounded-full",
                  f.severity === "error" ? "bg-destructive" : "bg-warning",
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <RuleTag id={f.ruleId} />
                  <span className="text-body-3-sb text-foreground truncate">
                    {f.message}
                  </span>
                </span>
                <span className="text-code text-muted-foreground truncate">
                  {f.file}:{f.line}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <StatusPill status={f.status} />
                <IconChevronRight className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
              </span>
            </button>
          ))}
        </ListPanel>
      ) : null}

      <FindingSheet finding={selected} onClose={() => setSelected(null)} />
    </>
  );
}

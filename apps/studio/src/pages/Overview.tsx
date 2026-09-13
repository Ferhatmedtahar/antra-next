import { IconHistory } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "wouter";

import type { FindingDetail } from "../../../../src/studio/types.js";

import { api } from "@/api";
import {
  BoundaryStrip,
  RuleBars,
  TrendLine,
  type Crossing,
} from "@/components/charts";
import { FindingSheet } from "@/components/finding-sheet";
import { SectionHeader } from "@/components/section-header";
import {
  Empty,
  ErrorNote,
  ErrorState,
  PageHeader,
  RunScanButton,
  TallyList,
  TallyRow,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAbsolute, formatDuration } from "@/format";
import { useLoad } from "@/hooks";

export function Overview() {
  const project = useLoad(() => api.project());
  const scans = useLoad(() => api.scans());
  const latestId = project.data?.latest?.id ?? null;
  const detail = useLoad(
    () => (latestId === null ? Promise.resolve(null) : api.scan(latestId)),
    [latestId],
  );
  const rules = useLoad(() => api.rules());
  // Set by a dot on the seam. Declared above the early returns below, since a
  // hook cannot sit after a conditional return.
  const [selected, setSelected] = useState<FindingDetail | null>(null);

  if (project.error) {
    return <ErrorState description={project.error} retry={project.reload} />;
  }
  if (project.data && !project.data.latest) {
    return (
      <Empty
        icon={<IconHistory />}
        title="No scans yet"
        body="Run antra in your project directory or click 'Run scan' below to scan your codebase."
        action={<RunScanButton />}
      />
    );
  }
  if (!detail.data || !project.data?.latest) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-huge" />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-64 rounded-huge" />
          <Skeleton className="h-64 rounded-huge" />
        </div>
      </div>
    );
  }

  const scan = detail.data.scan;
  const files = detail.data.files;
  const findings = detail.data.findings;

  const crossings: Crossing[] = findings.map((f) => ({
    label: `${f.ruleId}: ${f.message} (${f.file}:${f.line})`,
    severity: f.severity,
    accepted: f.status === "baselined",
    finding: f,
  }));

  const byRule = (rules.data ?? []).map((rule) => {
    const matching = findings.filter((f) => f.ruleId === rule.id);
    return {
      id: rule.id,
      description: rule.description,
      count: matching.filter((f) => f.status === "active").length,
      accepted: matching.filter((f) => f.status === "baselined").length,
    };
  });

  const serverFiles = files.filter((f) => f.boundary === "server").length;
  const clientFiles = files.filter((f) => f.boundary === "client").length;
  const clean = scan.findings === 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Ran ${formatAbsolute(scan.startedAt)}. Took ${formatDuration(scan.durationMs)} across ${scan.rules.length} rules.`}
        action={
          // `secondary`, not `ghost` — the same fix as Record baseline in the
          // sidebar. A ghost action is transparent until hovered, so the one
          // route off this page was invisible in its resting state. Findings.tsx
          // already uses `secondary` for its header action, so this is also the
          // page-header convention rather than a one-off.
          <Button variant="secondary" asChild>
            <Link href="/findings">Open findings</Link>
          </Button>
        }
      />

      {detail.data ? (
        <BoundaryStrip
          serverFiles={serverFiles}
          clientFiles={clientFiles}
          crossings={crossings}
          sensitiveFields={scan.taintSources}
          schemaFields={scan.schemaFields}
          onOpenFinding={setSelected}
        />
      ) : (
        <Skeleton className="h-40 rounded-huge" />
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="bg-card rounded-huge self-start p-6">
          <h3 className="text-title text-foreground mb-6">Triage</h3>
          <TallyList>
            <TallyRow
              value={scan.findings}
              label="New"
              hint={
                clean ? "The gate passes in CI." : "These fail the gate in CI."
              }
              tone="danger"
            />
            <TallyRow
              value={scan.baselined}
              label="Accepted"
              hint="Recorded in the baseline file."
            />
            <TallyRow
              value={scan.suppressed}
              label="Suppressed"
              hint="Silenced by an inline comment."
            />
          </TallyList>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SectionHeader
                title="Findings by rule"
                description="New findings, then accepted in the baseline."
              />
            </CardHeader>
            <CardContent>
              {byRule.length ? (
                <RuleBars rows={byRule} />
              ) : (
                <Skeleton className="h-32" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <SectionHeader
                title="New findings across scans"
                description="Every recorded run, oldest to newest."
              />
            </CardHeader>
            <CardContent>
              <TrendLine scans={scans.data ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Opened by a dot on the seam — the full finding, the same sheet the
          Findings page and the graph's node panel use. */}
      <FindingSheet finding={selected} onClose={() => setSelected(null)} />
    </>
  );
}

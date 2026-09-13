import {
  IconArrowRight,
  IconBookmark,
  IconChartBar,
  IconChartLine,
  IconEyeOff,
  IconKey,
  IconLayoutDashboard,
  IconShieldCheck,
  IconShieldX,
} from "@tabler/icons-react";
import { Link } from "wouter";

import { api } from "@/api";
import {
  BoundaryStrip,
  RuleBars,
  TrendLine,
  type Crossing,
} from "@/components/charts";
import { SectionHeader } from "@/components/section-header";
import { Empty, ErrorNote, PageHeader, StatCard } from "@/components/shared";
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

  if (project.error) return <ErrorNote message={project.error} />;
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader icon={<IconLayoutDashboard />} title="Overview" />
        <Empty
          icon={<IconLayoutDashboard />}
          title="No scans yet"
          body="Run a scan to see which server values cross into client components, which actions take unvalidated input, and where secrets end up in markup."
        />
      </>
    );
  }
  const scan = project.data?.latest;
  if (!scan) {
    return (
      <>
        <PageHeader icon={<IconLayoutDashboard />} title="Overview" />
        <Skeleton className="h-36 rounded-xl" />
      </>
    );
  }
  const findings = detail.data?.findings ?? [];
  const files = detail.data?.files ?? [];

  const crossings: Crossing[] = findings
    .filter(
      (f) =>
        f.status !== "suppressed" &&
        (f.ruleId === "BG-001" || f.ruleId === "BG-003"),
    )
    .map((f) => ({
      label: `${f.file}:${f.line} — ${f.message}`,
      severity: f.severity,
      accepted: f.status === "baselined",
    }));
  const byRule = (rules.data ?? []).map((rule) => ({
    id: rule.id,
    description: rule.description,
    count: findings.filter((f) => f.status === "active" && f.ruleId === rule.id)
      .length,
    accepted: findings.filter(
      (f) => f.status === "baselined" && f.ruleId === rule.id,
    ).length,
  }));
  const serverFiles = files.filter((f) => f.boundary === "server").length;
  const clientFiles = files.filter((f) => f.boundary === "client").length;
  const clean = scan.findings === 0;

  return (
    <>
      <PageHeader
        icon={<IconLayoutDashboard />}
        title="Overview"
        description={
          <>
            Scan #{scan.id} · {formatAbsolute(scan.startedAt)} ·{" "}
            {formatDuration(scan.durationMs)} · {scan.rules.join(", ")}
          </>
        }
        action={
          <Button variant="outline" asChild>
            <Link href="/findings">
              Open findings <IconArrowRight />
            </Link>
          </Button>
        }
      />

      {detail.data ? (
        <BoundaryStrip
          serverFiles={serverFiles}
          clientFiles={clientFiles}
          crossings={crossings}
        />
      ) : (
        <Skeleton className="h-36 rounded-xl" />
      )}

      <div className="mt-8 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <StatCard
          icon={clean ? <IconShieldCheck /> : <IconShieldX />}
          tone={clean ? "good" : "danger"}
          label="New findings"
          value={scan.findings}
          hint={clean ? "The gate passes." : "These fail the gate in CI."}
        />
        <StatCard
          icon={<IconBookmark />}
          label="Accepted"
          value={scan.baselined}
          hint="Recorded in the baseline file."
        />
        <StatCard
          icon={<IconEyeOff />}
          label="Suppressed"
          value={scan.suppressed}
          hint="Silenced by an inline comment."
        />
        <StatCard
          icon={<IconKey />}
          label="Sensitive fields"
          value={
            <>
              {scan.taintSources}
              <span className="text-muted-foreground text-lg font-normal">
                {" "}
                / {scan.schemaFields}
              </span>
            </>
          }
          hint="Taint origins among the schema fields."
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <SectionHeader
              icon={<IconChartBar />}
              title="Findings by rule"
              description="New, then accepted in the baseline."
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
              icon={<IconChartLine />}
              title="New findings across scans"
              description="Every recorded run, oldest to newest."
            />
          </CardHeader>
          <CardContent>
            <TrendLine scans={scans.data ?? []} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import {
  IconChevronRight,
  IconClock,
  IconFiles,
  IconHistory,
} from "@tabler/icons-react";
import { useLocation } from "wouter";

import {
  Empty,
  ErrorNote,
  ListPanel,
  LoadingRows,
  PageHeader,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { formatAbsolute, formatDuration, formatRelative } from "@/format";
import { useLoad } from "@/hooks";

export function Scans() {
  const scans = useLoad(() => api.scans());
  const [, navigate] = useLocation();

  if (scans.error) return <ErrorNote message={scans.error} />;
  if (scans.data && scans.data.length === 0) {
    return (
      <>
        <PageHeader icon={<IconHistory />} title="Scans" />
        <Empty
          icon={<IconHistory />}
          title="No scans yet"
          body="Every scan — from the CLI or from here — is recorded in .boundary-guard/findings.sqlite."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={<IconHistory />}
        title="Scans"
        description="Every recorded run, newest first. Open one to browse its findings."
      />
      {!scans.data ? (
        <LoadingRows />
      ) : (
        <ListPanel>
          {scans.data.map((scan) => (
            <button
              key={scan.id}
              type="button"
              onClick={() => navigate(`/findings?scan=${scan.id}`)}
              className="hover:bg-accent/50 focus-visible:bg-accent/50 flex w-full items-center gap-5 px-5 py-4 text-left outline-none"
            >
              <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums">
                #{scan.id}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {formatRelative(scan.startedAt)}
                  <span className="text-muted-foreground text-xs font-normal">
                    {formatAbsolute(scan.startedAt)}
                  </span>
                </span>
                <span className="text-muted-foreground flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <IconFiles className="size-3.5" /> {scan.files} files
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconClock className="size-3.5" />{" "}
                    {formatDuration(scan.durationMs)}
                  </span>
                  <span className="font-mono">{scan.rules.join(" ")}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {scan.findings > 0 ? (
                  <Badge variant="destructive">{scan.findings} new</Badge>
                ) : (
                  <Badge variant="soft-success">clean</Badge>
                )}
                <Badge variant="soft-muted">{scan.baselined} accepted</Badge>
                <Badge variant="soft-muted">{scan.suppressed} suppressed</Badge>
                <IconChevronRight className="text-muted-foreground size-4" />
              </span>
            </button>
          ))}
        </ListPanel>
      )}
    </>
  );
}

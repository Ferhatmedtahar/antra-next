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
  ErrorState,
  ListPanel,
  LoadingRows,
  PageHeader,
  RunScanButton,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { formatAbsolute, formatDuration, formatRelative } from "@/format";
import { useLoad } from "@/hooks";

export function Scans() {
  const scans = useLoad(() => api.scans());
  const [, navigate] = useLocation();

  if (scans.error) {
    return <ErrorState description={scans.error} retry={scans.reload} />;
  }
  if (scans.data && scans.data.length === 0) {
    return (
      <>
        <PageHeader title="Scans" />
        <Empty
          icon={<IconHistory />}
          title="No scans yet"
          body="Every scan — from the CLI or from here — is recorded in .antra/antra-findings.sqlite."
          action={<RunScanButton />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
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
              className="hover:bg-surface-soft focus-visible:bg-surface-soft flex w-full flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 text-left transition-colors outline-none cursor-pointer sm:flex-nowrap sm:gap-5 sm:px-6"
            >
              <span className="bg-surface-soft text-foreground flex size-10 shrink-0 items-center justify-center rounded-mid font-mono text-sm font-semibold tabular-nums">
                #{scan.id}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                  {formatRelative(scan.startedAt)}
                  <span className="text-muted-foreground text-xs font-normal">
                    {formatAbsolute(scan.startedAt)}
                  </span>
                </span>
                <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
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
              <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
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

import {
  IconArrowDown,
  IconCopy,
  IconFingerprint,
  IconHierarchy,
  IconRoute,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Link } from "wouter";

import type { FindingDetail } from "../../../../src/studio/types.js";

import {
  CodeFrame,
  RuleTag,
  SeverityPill,
  StatusPill,
} from "@/components/shared";
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

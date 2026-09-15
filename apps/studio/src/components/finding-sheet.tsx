import {
  IconArrowDown,
  IconBulb,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconFingerprint,
  IconHierarchy,
  IconInfoCircle,
  IconRoute,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

import { renderFindingPrompt } from "../../../../src/studio/prompt.js";
import { GUIDANCE } from "../../../../src/studio/rule-guidance.js";
import type {
  FindingDetail,
  ProjectInfo,
} from "../../../../src/studio/types.js";

import { CopyForAgent } from "@/components/copy-for-agent";
import {
  CodeFrame,
  RuleTag,
  SeverityPill,
  StatusPill,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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

export function RemediationGuide({ ruleId }: { ruleId: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const guide = GUIDANCE[ruleId];

  if (!guide) return null;

  return (
    <div className="rounded-big border border-border/80 bg-surface-soft/40 p-4 transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-icon bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <IconBulb className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-title-3 font-semibold text-foreground">
                How to fix this &amp; What it means
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                Fix Guide
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{guide.tagline}</p>
          </div>
        </div>
        <div className="text-muted-foreground hover:text-foreground">
          {isOpen ? (
            <IconChevronUp className="size-5" />
          ) : (
            <IconChevronDown className="size-5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t border-border/60 pt-3 text-xs leading-relaxed">
          <div className="rounded-mid bg-background/80 p-3 border border-border/50">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
              <IconInfoCircle className="size-4 text-primary" />
              <span>Is this a TypeScript error or a sensitive value?</span>
            </div>
            <p className="text-muted-foreground">{guide.isTypeError}</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
              Recommended Fixes
            </h4>

            {guide.options.map((option, idx) => (
              <div
                key={idx}
                className="rounded-mid border border-border/40 bg-background/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {option.title}
                  </span>
                  {option.badge && (
                    <Badge
                      variant="default"
                      className="text-[10px] px-1.5 py-0 h-4"
                    >
                      {option.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{option.description}</p>

                {option.before && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-destructive">
                      <IconX className="size-3" /> Before:
                    </div>
                    <pre className="overflow-x-auto rounded-icon bg-destructive/20 p-2 font-mono text-[11px] text-destructive ">
                      <code>{option.before}</code>
                    </pre>
                  </div>
                )}

                {option.after && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      <IconCheck className="size-3" />{" "}
                      {option.before ? "After:" : "Example:"}
                    </div>
                    <pre className="overflow-x-auto rounded-icon bg-emerald-500/20 p-2 font-mono text-[11px] text-foreground ">
                      <code>{option.after}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FindingSheet({
  finding,
  project,
  onClose,
}: {
  finding: FindingDetail | null;
  /** Detected project facts the prompt needs. Absent until `/api/project` loads. */
  project: ProjectInfo | null;
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
              {project && finding.status === "active" ? (
                <CopyForAgent prompt={renderFindingPrompt(finding, project)} />
              ) : null}
              <RemediationGuide ruleId={finding.ruleId} />
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

import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconBookmark,
  IconDatabase,
  IconFiles,
  IconHistory,
  IconLayoutDashboard,
  IconLoader2,
  IconMoon,
  IconPlayerPlay,
  IconShieldLock,
  IconSun,
} from "@tabler/icons-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, Route, Switch as Routes, useLocation } from "wouter";

import { api } from "@/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelative } from "@/format";
import {
  RefreshContext,
  ThemeContext,
  useLoad,
  useRefresh,
  useTheme,
  useThemeState,
} from "@/hooks";
import { SIDEBAR_WIDTH } from "@/layout";
import { cn } from "@/lib/utils";
import { Config } from "@/pages/Config";
import { Files } from "@/pages/Files";
import { Findings } from "@/pages/Findings";
import { Overview } from "@/pages/Overview";
import { Scans } from "@/pages/Scans";
import { Sources } from "@/pages/Sources";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Overview", icon: <IconLayoutDashboard /> },
  { href: "/findings", label: "Findings", icon: <IconAlertTriangle /> },
  { href: "/sources", label: "Sources", icon: <IconDatabase /> },
  { href: "/config", label: "Config", icon: <IconAdjustmentsHorizontal /> },
  { href: "/files", label: "Files", icon: <IconFiles /> },
  { href: "/scans", label: "Scans", icon: <IconHistory /> },
];

export function App() {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const refresh = useMemo(() => ({ version, bump }), [version, bump]);
  const theme = useThemeState();

  return (
    <ThemeContext.Provider value={theme}>
      <RefreshContext.Provider value={refresh}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-10 py-8">
            <div className="mx-auto max-w-[1200px]">
              <Routes>
                <Route path="/" component={Overview} />
                <Route path="/findings" component={Findings} />
                <Route path="/sources" component={Sources} />
                <Route path="/config" component={Config} />
                <Route path="/files" component={Files} />
                <Route path="/scans" component={Scans} />
                <Route>
                  <p className="text-muted-foreground">
                    Nothing here. Pick a page on the left.
                  </p>
                </Route>
              </Routes>
            </div>
          </main>
        </div>
        <Toaster
          theme={theme.theme}
          richColors
          closeButton
          position="bottom-right"
        />
      </RefreshContext.Provider>
    </ThemeContext.Provider>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const project = useLoad(() => api.project());
  const { bump } = useRefresh();
  const { theme, toggle } = useTheme();
  const [running, setRunning] = useState(false);
  const [baselining, setBaselining] = useState(false);
  const [confirmBaseline, setConfirmBaseline] = useState(false);

  const runScan = async () => {
    setRunning(true);
    try {
      const result = await api.runScan();
      if (result.findings > 0) {
        toast.error(
          `${result.findings} new finding${result.findings === 1 ? "" : "s"}`,
          {
            description: `${result.baselined} accepted in the baseline, ${result.suppressed} suppressed.`,
          },
        );
      } else {
        toast.success("Nothing new", {
          description: `${result.baselined} accepted in the baseline, ${result.suppressed} suppressed.`,
        });
      }
      if (result.storeError)
        toast.warning("Scan not recorded", { description: result.storeError });
      bump();
    } catch (error) {
      toast.error("Scan failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRunning(false);
    }
  };

  const recordBaseline = async () => {
    setBaselining(true);
    try {
      const result = await api.baseline();
      toast.success(`Baseline written: ${result.recorded} findings recorded`, {
        description: `${result.file} — commit it.`,
      });
      bump();
    } catch (error) {
      toast.error("Baseline failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBaselining(false);
    }
  };

  const lastScan = project.data?.latest
    ? `Last scan ${formatRelative(project.data.latest.startedAt)}`
    : project.data
      ? "No scans yet"
      : "";

  return (
    <aside
      className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 flex h-screen shrink-0 flex-col border-r"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
          <IconShieldLock className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="leading-tight font-semibold">boundary-guard</div>
          <div className="text-muted-foreground text-xs">Studio</div>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="px-5 py-4">
        <div
          className="truncate text-sm font-medium"
          title={project.data?.rootDir}
        >
          {project.data?.name ?? "…"}
        </div>
        <div
          className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]"
          title={project.data?.rootDir}
        >
          {project.data?.rootDir ?? ""}
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? location === "/"
              : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium [&_svg]:text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-sidebar-border space-y-2 border-t p-4">
        <Button
          className="w-full"
          disabled={running}
          onClick={() => void runScan()}
        >
          {running ? (
            <IconLoader2 className="animate-spin" />
          ) : (
            <IconPlayerPlay />
          )}
          {running ? "Scanning…" : "Run scan"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={baselining}
          onClick={() => setConfirmBaseline(true)}
        >
          {baselining ? (
            <IconLoader2 className="animate-spin" />
          ) : (
            <IconBookmark />
          )}
          Record baseline
        </Button>
        <p className="text-muted-foreground pt-1 text-xs">
          {lastScan}
          {project.data && !project.data.configPresent
            ? " · no config — run init"
            : ""}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground text-xs">
            v{project.data?.version ?? ""}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                aria-label={
                  theme === "dark" ? "Switch to light" : "Switch to dark"
                }
              >
                {theme === "dark" ? <IconSun /> : <IconMoon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AlertDialog open={confirmBaseline} onOpenChange={setConfirmBaseline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record every current finding?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything the last scan flagged becomes accepted. Future scans
              only fail on findings that appear after this point. The file goes
              in .boundary-guard/baseline.json — commit it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void recordBaseline()}>
              Record baseline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

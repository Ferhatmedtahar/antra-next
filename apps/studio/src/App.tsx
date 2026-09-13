import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconBookmark,
  IconDatabase,
  IconFiles,
  IconHierarchy,
  IconHistory,
  IconLayoutDashboard,
  IconMoon,
  IconPlayerPlay,
  IconSun,
} from "@tabler/icons-react";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { toast } from "sonner";
import { Link, Route, Switch as Routes, useLocation } from "wouter";

import { api } from "@/api";
import { ActionButton } from "@/components/ui/action-button";
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
import { NotFound } from "@/components/shared";
import { Config } from "@/pages/Config";
import { Files } from "@/pages/Files";
import { Findings } from "@/pages/Findings";
import { Graph } from "@/pages/Graph";
import { Overview } from "@/pages/Overview";
import { Scans } from "@/pages/Scans";
import { Sources } from "@/pages/Sources";

const NAV: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/", label: "Overview", icon: IconLayoutDashboard },
  { href: "/findings", label: "Findings", icon: IconAlertTriangle },
  { href: "/graph", label: "Graph", icon: IconHierarchy },
  { href: "/sources", label: "Sources", icon: IconDatabase },
  { href: "/config", label: "Config", icon: IconAdjustmentsHorizontal },
  { href: "/files", label: "Files", icon: IconFiles },
  { href: "/scans", label: "Scans", icon: IconHistory },
];

export function App() {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const refresh = useMemo(() => ({ version, bump }), [version, bump]);
  const theme = useThemeState();

  return (
    <ThemeContext.Provider value={theme}>
      <RefreshContext.Provider value={refresh}>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="min-w-0 flex-1 px-8 py-8 lg:px-12 lg:py-10">
            <div className="mx-auto max-w-[1120px]">
              <Routes>
                <Route path="/" component={Overview} />
                <Route path="/findings" component={Findings} />
                <Route path="/graph" component={Graph} />
                <Route path="/sources" component={Sources} />
                <Route path="/config" component={Config} />
                <Route path="/files" component={Files} />
                <Route path="/scans" component={Scans} />
                <Route>
                  <NotFound />
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
      className="bg-sidebar text-sidebar-foreground sticky top-0 flex h-screen shrink-0 flex-col px-3 py-4 select-none"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Blended into the sidebar ground rather than boxed in a tile — the
            art is blue on opaque white, and multiply/screen dissolve the white
            in light and dark themes alike. The source has wide margins around
            the ant, so a centred scale crops them past the clipping box.
            Keep in step with apps/web/components/shared/logo.tsx. */}
        <span className="relative block h-6 w-12 shrink-0 overflow-hidden">
          <img
            src="/antra.png"
            alt=""
            style={{ transform: "scale(1.8)" }}
            className="size-full object-contain mix-blend-multiply dark:invert dark:hue-rotate-180 dark:mix-blend-screen"
          />
        </span>
        <div className="min-w-0">
          <div className="text-body-3-sb leading-tight text-foreground">
            antra
          </div>
          <div className="text-label-1-m text-muted-foreground">Studio</div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-3">
        <div
          className="truncate text-label-3-sb text-foreground"
          title={project.data?.rootDir}
        >
          {project.data?.name ?? "…"}
        </div>
        <div
          className="text-muted-foreground mt-0.5 truncate font-mono text-label-1-m"
          title={project.data?.rootDir}
        >
          {project.data?.rootDir ?? ""}
        </div>
      </div>

      {/* Navigation matching iPractis SidebarNavItem */}
      <nav className="flex-1 space-y-1.5 px-1 pt-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? location === "/"
              : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group focus-ring rounded-big relative flex h-11 w-full cursor-pointer items-center gap-3 p-1.5 transition-colors",
                // The row you are on wears the Run scan button's treatment:
                // `bg-primary` is the ink/paper inversion, so it is the one
                // filled control in the rail and it follows the theme with no
                // second rule. Idle rows wash in `sidebar-accent`, which is the
                // rail's own token rather than a palette stop picked to match it.
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-sidebar-accent",
              )}
            >
              {/* No marker bar. It used to hang off the row's left edge to say
                  where you were, but the filled pill above now says that on its
                  own — and against a dark pill the old bar was invisible in
                  light mode anyway. */}
              <span
                className={cn(
                  "rounded-mid flex size-8 shrink-0 items-center justify-center transition-colors",
                  // Active tiles sit on the pill, so their ground is a wash of
                  // the pill's own foreground — light-on-dark in light mode,
                  // dark-on-light in dark. Idle tiles are `card`: white against
                  // the warm rail in light, raised against near-black in dark.
                  // `surface-soft` was the old idle ground and all but vanished
                  // into the rail in light mode, which is what made the tile
                  // read as missing rather than as a control.
                  active
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-card text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <span
                className={cn(
                  "text-[13px] whitespace-nowrap transition-colors",
                  active
                    ? "text-primary-foreground font-semibold"
                    : "text-muted-foreground group-hover:text-foreground font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions & scan triggers */}
      <div className="space-y-2 px-1 pt-3 pb-2">
        <ActionButton
          variant="primary"
          size="small"
          icon={<IconPlayerPlay className="size-3.5 fill-current" />}
          loading={running}
          onClick={() => void runScan()}
        >
          {running ? "Scanning…" : "Run scan"}
        </ActionButton>

        {/* `bg-card` over ghost's `transparent`: as a bare ghost it was only
            visible on hover, so the rail's one secondary action was invisible
            until you went looking for it. */}
        <Button
          variant="ghost"
          size="sm"
          className="bg-card hover:bg-surface-soft w-full text-muted-foreground hover:text-foreground h-8 text-xs font-medium gap-1.5"
          disabled={baselining}
          onClick={() => setConfirmBaseline(true)}
        >
          <IconBookmark className="size-3.5" />
          Record baseline
        </Button>

        <div className="px-2 pt-1">
          <p className="text-muted-foreground text-label-2-m">{lastScan}</p>
          {project.data && !project.data.configPresent && (
            <p className="text-nudge flex items-center gap-1.5 text-label-2-m font-medium mt-1">
              <IconAlertTriangle className="size-3.5 shrink-0" /> No config —
              run init
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-muted-foreground text-label-1-m">
            v{project.data?.version ?? ""}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="bg-card hover:bg-surface-soft"
                onClick={toggle}
                aria-label={
                  theme === "dark" ? "Switch to light" : "Switch to dark"
                }
              >
                {theme === "dark" ? (
                  <IconSun className="size-4" />
                ) : (
                  <IconMoon className="size-4" />
                )}
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
              in .antra/baseline.json — commit it.
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

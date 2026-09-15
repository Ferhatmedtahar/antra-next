import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconBookmark,
  IconDatabase,
  IconFiles,
  IconHierarchy,
  IconHistory,
  IconLayoutDashboard,
  IconMenu2,
  IconMoon,
  IconPlayerPlay,
  IconSun,
  IconX,
} from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
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

/** The rail's id, so the burger's `aria-controls` names it. */
const NAV_ID = "studio-nav";

/**
 * Tailwind's `lg`, restated for `matchMedia`.
 *
 * The layout itself is pure CSS and never asks how wide the window is — this
 * only gates the drawer's `inert`, which has to be off at `lg` up where the rail
 * is permanently in flow. Both spellings are `64rem`, so the two never disagree.
 */
const RAIL_QUERY = "(min-width: 64rem)";

export function App() {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const refresh = useMemo(() => ({ version, bump }), [version, bump]);
  const theme = useThemeState();
  // Owned here, not in the rail: the burger that opens the drawer lives in the
  // top bar and the drawer itself lives in the rail.
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <ThemeContext.Provider value={theme}>
      <RefreshContext.Provider value={refresh}>
        {/* `lg:flex` and not `flex`: below it the rail is a drawer floating over
            the page, so the column — bar over content — is on its own. */}
        <div className="bg-background min-h-screen lg:flex">
          <Sidebar open={navOpen} onClose={closeNav} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileBar open={navOpen} onOpenNav={() => setNavOpen(true)} />
            <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
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

/**
 * `lg` and up, tracked live.
 *
 * Only the rail reads this, and only for `inert` — every other small-screen rule
 * in the Studio is a Tailwind variant on the element itself, so nothing renders
 * twice and nothing waits on JavaScript to lay out.
 */
function useIsRailInFlow(): boolean {
  const [inFlow, setInFlow] = useState(
    () => window.matchMedia(RAIL_QUERY).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(RAIL_QUERY);
    const update = (event: MediaQueryListEvent) => setInFlow(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return inFlow;
}

/** The wordmark, drawn the same in the rail and in the top bar. */
function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
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
        <div className="text-body-3-sb leading-tight text-foreground font-bold">
          antra
        </div>
        <div className="text-label-1-sb text-muted-foreground">Studio</div>
      </div>
    </div>
  );
}

/**
 * The theme switch, in one place because it appears twice: in the rail, and in
 * the top bar that stands in for the rail below `lg`. The tooltip is worth
 * having on hover and harmless where there is none.
 */
function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "Switch to light" : "Switch to dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("bg-card hover:bg-surface-soft", className)}
          onClick={toggle}
          aria-label={label}
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
  );
}

/**
 * The rail's small-screen half: a burger that opens it as a drawer, and the
 * wordmark, so the page is never nameless.
 *
 * Deliberately thin. Everything the rail carries — Run scan, Record baseline,
 * the theme switch, the scan tally — is one tap away inside the drawer, and
 * copying it up here would be two more places to keep in step.
 */
function MobileBar({
  open,
  onOpenNav,
}: {
  open: boolean;
  onOpenNav: () => void;
}) {
  const burger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  // Closing the drawer takes its contents out of the tab order, so focus has to
  // come back out with it — otherwise it falls to the document and the next Tab
  // starts at the top of the page.
  useEffect(() => {
    if (wasOpen.current && !open)
      burger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <header className="bg-sidebar/85 text-sidebar-foreground border-divider-subtle sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-2.5 backdrop-blur lg:hidden">
      <Button
        ref={burger}
        variant="ghost"
        size="icon"
        className="bg-card hover:bg-surface-soft"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-controls={NAV_ID}
        aria-expanded={open}
      >
        <IconMenu2 className="size-4.5" />
      </Button>
      <Brand className="min-w-0 flex-1" />
      <ThemeToggle className="size-10" />
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const project = useLoad(() => api.project());
  const { bump } = useRefresh();
  const [running, setRunning] = useState(false);
  const [baselining, setBaselining] = useState(false);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const railInFlow = useIsRailInFlow();
  // A drawer is a modal, and a modal that never takes focus is a modal the
  // keyboard cannot reach: the rail is the first thing in the document, so Tab
  // from the burger would walk the whole page before arriving back here.
  const drawer = !railInFlow && open;
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (drawer) closeButton.current?.focus({ preventScroll: true });
  }, [drawer]);

  // A tap on a link is a request to go there, not to keep holding the rail open.
  useEffect(() => {
    onClose();
  }, [location, onClose]);

  // Escape, and a page that holds still behind the drawer. Both are moot at `lg`
  // up, where `open` is never true because there is nothing to open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

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
    <>
      {/* The drawer's scrim. Tap anywhere on it to dismiss — a full-screen
          button rather than a bare div, so the tap that closes the drawer is
          also one a keyboard and a screen reader can reach. */}
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
        />
      ) : null}

      <aside
        id={NAV_ID}
        // A closed drawer is still tabbable while it sits off canvas, so it goes
        // inert — but only below `lg`, where at `lg` up the rail is the page's
        // own navigation and must stay live.
        inert={!railInFlow && !open}
        role={drawer ? "dialog" : undefined}
        aria-modal={drawer ? true : undefined}
        aria-label="Studio"
        className={cn(
          "bg-sidebar text-sidebar-foreground select-none",
          // Below `lg`: a drawer pinned to the left edge, off canvas until the
          // burger opens it.
          "fixed top-0 bottom-0 left-0 z-50 flex w-(--sidebar-w) flex-col px-3 py-4",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // From `lg` up: the same markup, back in flow as the sticky rail, with
          // the travel turned off so a resize cannot animate it in.
          "lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none lg:transition-none",
        )}
      >
        {/* Brand & Project Info */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Brand className="min-w-0 flex-1" />
          <Button
            ref={closeButton}
            variant="ghost"
            size="icon-sm"
            className="bg-card hover:bg-surface-soft lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="px-3 pt-4 pb-3">
          {/* The root path used to sit under the name in mono, where it was
              truncated to nothing on any real machine and pushed the name out of
              the eye's path. It is still the tooltip, where it fits. */}
          <div
            className="truncate text-label-3-sb font-bold text-foreground"
            title={project.data?.rootDir}
          >
            {project.data?.name ?? "…"}
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
            <ThemeToggle />
          </div>
        </div>

        <AlertDialog open={confirmBaseline} onOpenChange={setConfirmBaseline}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Record every current finding?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything the last scan flagged becomes accepted. Future scans
                only fail on findings that appear after this point. The file
                goes in .antra/baseline.json — commit it.
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
    </>
  );
}

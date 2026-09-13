import type {
  BaselineResponse,
  GraphResponse,
  ProjectInfo,
  RuleInfo,
  ScanDetail,
  ScanRunResponse,
  ScanSummary,
  SourcesResponse,
  StudioConfig,
} from "../../../src/studio/types.js";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (text && !contentType.includes("application/json")) {
    // The SPA fallback answered an /api call: the running server predates this build.
    throw new ApiError(
      "The Studio server is older than this page — restart `antra studio` after updating.",
      response.status,
    );
  }
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = body as { error?: string; issues?: unknown } | null;
    throw new ApiError(
      error?.error ?? response.statusText,
      response.status,
      error?.issues,
    );
  }
  return body as T;
}

export const api = {
  project: () => request<ProjectInfo>("/api/project"),
  rules: () => request<RuleInfo[]>("/api/rules"),
  scans: () => request<ScanSummary[]>("/api/scans"),
  scan: (id: number) => request<ScanDetail>(`/api/scans/${id}`),
  graph: (id: number) => request<GraphResponse>(`/api/scans/${id}/graph`),
  sources: () => request<SourcesResponse>("/api/sources"),
  config: () => request<StudioConfig | null>("/api/config"),
  saveConfig: (config: StudioConfig) =>
    request<StudioConfig>("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  runScan: () => request<ScanRunResponse>("/api/scan", { method: "POST" }),
  baseline: () =>
    request<BaselineResponse>("/api/baseline", { method: "POST" }),
};

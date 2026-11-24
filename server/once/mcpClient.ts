import crypto from "crypto";
import type {
  OncePerformanceSummaryResponse,
  OnceReleasePerformanceResponse,
} from "./types";

export class OnceMcpError extends Error {
  status: number;
  code?: string;
  rpcCode?: number;
  details?: unknown;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    rpcCode?: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "OnceMcpError";
    this.status = params.status;
    this.code = params.code;
    this.rpcCode = params.rpcCode;
    this.details = params.details;
  }
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: string | number | null;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

function mapErrorCodeToHttpStatus(code?: string, rpcCode?: number, fallback = 502): number {
  if (code === "release_not_distributed") return 409;
  if (code === "invalid_params" || rpcCode === -32602) return 400;
  if (code === "forbidden" || rpcCode === 403) return 403;
  if (code === "unauthorized" || rpcCode === 401) return 401;
  if (code === "rate_limited" || rpcCode === 429) return 429;
  return fallback;
}

function parseSseJsonRpc(rawText: string): JsonRpcResponse | null {
  const lines = rawText.split(/\r?\n/);
  let lastParsed: JsonRpcResponse | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as JsonRpcResponse;
      if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
        lastParsed = parsed;
      }
    } catch {
      // Skip non-JSON SSE keepalive/event fragments
    }
  }
  return lastParsed;
}

export class OnceMcpClient {
  private mcpUrl: string;
  private provenanceTag: string;

  constructor(options?: { mcpUrl?: string; provenanceTag?: string }) {
    this.mcpUrl = (options?.mcpUrl || process.env.ONCE_MCP_URL || "https://beta.once.app/api/mcp").trim();
    this.provenanceTag = (options?.provenanceTag || process.env.ONCE_PROVENANCE_TAG || "ZEDBUTE").trim();
  }

  async callTool<T>(
    toolName: string,
    args: Record<string, unknown>,
    token: string
  ): Promise<T> {
    if (!token) {
      throw new OnceMcpError({
        status: 401,
        code: "missing_token",
        message: "ONCE access token is required to call ONCE MCP analytics tools",
      });
    }

    const requestBody = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const response = await fetch(this.mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": `Bearer ${token}`,
        "X-Once-Provenance": this.provenanceTag,
      },
      body: JSON.stringify(requestBody),
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    let rpcPayload: JsonRpcResponse | null = null;
    if (contentType.includes("text/event-stream")) {
      rpcPayload = parseSseJsonRpc(rawText);
    } else {
      try {
        rpcPayload = JSON.parse(rawText) as JsonRpcResponse;
      } catch {
        rpcPayload = null;
      }
    }

    if (!response.ok) {
      const rpcError = rpcPayload?.error;
      const errData = (rpcError?.data && typeof rpcError.data === "object"
        ? rpcError.data
        : {}) as Record<string, unknown>;
      const code = typeof errData.error === "string" ? errData.error : undefined;
      throw new OnceMcpError({
        status: response.status,
        code,
        rpcCode: rpcError?.code,
        message: rpcError?.message || `ONCE MCP request failed with status ${response.status}`,
        details: rpcError?.data,
      });
    }

    if (!rpcPayload) {
      throw new OnceMcpError({
        status: 502,
        code: "invalid_mcp_response",
        message: "Received non-JSON response from ONCE MCP server",
      });
    }

    if (rpcPayload.error) {
      const errData = (rpcPayload.error.data && typeof rpcPayload.error.data === "object"
        ? rpcPayload.error.data
        : {}) as Record<string, unknown>;
      const code = typeof errData.error === "string" ? errData.error : undefined;
      throw new OnceMcpError({
        status: mapErrorCodeToHttpStatus(code, rpcPayload.error.code, 502),
        code,
        rpcCode: rpcPayload.error.code,
        message: rpcPayload.error.message || "ONCE MCP tool call returned an error",
        details: rpcPayload.error.data,
      });
    }

    const textBlock = rpcPayload.result?.content?.find(
      (item) => item.type === "text" && typeof item.text === "string"
    )?.text;

    if (!textBlock) {
      throw new OnceMcpError({
        status: 502,
        code: "empty_tool_result",
        message: `ONCE MCP tool ${toolName} returned an empty response`,
      });
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(textBlock);
    } catch {
      if (rpcPayload.result?.isError) {
        throw new OnceMcpError({
          status: 400,
          code: "mcp_tool_error",
          message: textBlock,
        });
      }
      throw new OnceMcpError({
        status: 502,
        code: "invalid_tool_json",
        message: `ONCE MCP tool ${toolName} returned non-JSON text content`,
      });
    }

    if (rpcPayload.result?.isError) {
      const errObj = (parsedContent && typeof parsedContent === "object"
        ? parsedContent
        : {}) as Record<string, unknown>;
      const code = typeof errObj.error === "string" ? errObj.error : undefined;
      const msg =
        (typeof errObj.message === "string" && errObj.message) ||
        (typeof errObj.error === "string" && errObj.error) ||
        `ONCE MCP tool ${toolName} failed`;
      throw new OnceMcpError({
        status: mapErrorCodeToHttpStatus(code, undefined, 400),
        code,
        message: msg,
        details: parsedContent,
      });
    }

    return parsedContent as T;
  }

  async getPerformanceSummary(
    params: {
      fromDate?: string;
      toDate?: string;
      topReleasesLimit?: number;
      topStoresLimit?: number;
    },
    token: string
  ): Promise<OncePerformanceSummaryResponse> {
    const args: Record<string, unknown> = {};
    if (params.fromDate) args.fromDate = params.fromDate;
    if (params.toDate) args.toDate = params.toDate;
    if (params.topReleasesLimit !== undefined) args.topReleasesLimit = params.topReleasesLimit;
    if (params.topStoresLimit !== undefined) args.topStoresLimit = params.topStoresLimit;

    return this.callTool<OncePerformanceSummaryResponse>("get_performance_summary", args, token);
  }

  async getReleasePerformance(
    params: {
      releaseId: string;
      fromDate?: string;
      toDate?: string;
      distributorId?: number;
      includeTracks?: boolean;
    },
    token: string
  ): Promise<OnceReleasePerformanceResponse> {
    const args: Record<string, unknown> = {
      releaseId: params.releaseId,
    };
    if (params.fromDate) args.fromDate = params.fromDate;
    if (params.toDate) args.toDate = params.toDate;
    if (params.distributorId !== undefined && !Number.isNaN(params.distributorId)) {
      args.distributorId = params.distributorId;
    }
    if (params.includeTracks !== undefined) {
      args.includeTracks = params.includeTracks;
    }

    return this.callTool<OnceReleasePerformanceResponse>("get_release_performance", args, token);
  }
}

export const onceMcpClient = new OnceMcpClient();

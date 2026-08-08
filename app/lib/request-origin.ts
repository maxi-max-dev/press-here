interface RequestOriginHeaders {
  forwardedHost: string | null;
  host: string | null;
  forwardedProto: string | null;
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

export function resolveRequestOrigin({
  forwardedHost,
  host,
  forwardedProto,
}: RequestOriginHeaders): string {
  const resolvedHost = firstHeaderValue(forwardedHost) || firstHeaderValue(host) || "localhost:3000";
  const hostname = resolvedHost.startsWith("[")
    ? resolvedHost.slice(1, resolvedHost.indexOf("]"))
    : resolvedHost.split(":")[0].toLowerCase();
  const requestedProtocol = firstHeaderValue(forwardedProto).toLowerCase();
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const protocol =
    requestedProtocol === "http" || requestedProtocol === "https"
      ? requestedProtocol
      : isLoopback
        ? "http"
        : "https";

  try {
    return new URL(`${protocol}://${resolvedHost}`).origin;
  } catch {
    return "http://localhost:3000";
  }
}

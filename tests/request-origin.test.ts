import { describe, expect, it } from "vitest";

import { resolveRequestOrigin } from "../app/lib/request-origin";

describe("请求 origin", () => {
  it("为常见本地回环地址保留 http", () => {
    expect(
      resolveRequestOrigin({ forwardedHost: null, host: "127.0.0.1:43118", forwardedProto: null }),
    ).toBe("http://127.0.0.1:43118");
    expect(
      resolveRequestOrigin({ forwardedHost: null, host: "[::1]:43118", forwardedProto: null }),
    ).toBe("http://[::1]:43118");
  });

  it("只使用代理链的首个 host 与协议", () => {
    expect(
      resolveRequestOrigin({
        forwardedHost: "guide.example.com, internal.example.net",
        host: "internal.example.net",
        forwardedProto: "https, http",
      }),
    ).toBe("https://guide.example.com");
  });

  it("畸形 host 不会让元数据请求抛错", () => {
    expect(
      resolveRequestOrigin({ forwardedHost: "bad host", host: null, forwardedProto: "javascript" }),
    ).toBe("http://localhost:3000");
  });
});

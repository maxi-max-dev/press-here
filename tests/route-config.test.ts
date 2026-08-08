import { describe, expect, it } from "vitest";

import {
  canonicalGuideId,
  generateStaticParams,
} from "../app/guide/[id]/page";

describe("生产指南路由", () => {
  it("预生成四条公开路由", () => {
    expect(generateStaticParams()).toEqual([
      { id: "coffee" },
      { id: "projector" },
      { id: "custom" },
      { id: "coffee-machine" },
    ]);
  });

  it("旧 coffee-machine 路由诚实兼容当前 coffee 样例", () => {
    expect(canonicalGuideId("coffee-machine")).toBe("coffee");
    expect(canonicalGuideId("projector")).toBe("projector");
  });
});

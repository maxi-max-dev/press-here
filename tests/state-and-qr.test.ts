// @vitest-environment node

import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import {
  clampPoint,
  createDefaultWorkspace,
  guidePath,
  guideUrl,
  imagePointToStage,
  loadWorkspace,
  resetSampleProject,
  saveWorkspace,
  stagePointToImage,
  validateProject,
  type GuideProject,
} from "../app/lib/guide-state";

const STORAGE_KEY = "press-here-workspace-v1";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

describe("工作区状态与二维码契约", () => {
  it("默认工作区提供两个内容和坐标都不同的精修样例", () => {
    const workspace = createDefaultWorkspace();
    const coffee = workspace.projects.coffee;
    const projector = workspace.projects.projector;

    expect(workspace.version).toBe(2);
    expect(workspace.activeProjectId).toBe("coffee");
    expect(coffee.steps).toHaveLength(3);
    expect(projector.steps).toHaveLength(3);
    expect(coffee.image).not.toBe(projector.image);
    expect(coffee.steps.map((step) => step.instruction)).not.toEqual(
      projector.steps.map((step) => step.instruction),
    );
    expect(coffee.steps.map((step) => [step.x, step.y])).not.toEqual(
      projector.steps.map((step) => [step.x, step.y]),
    );
    expect(validateProject(coffee)).toEqual([]);
    expect(validateProject(projector)).toEqual([]);
  });

  it("校验会同时报告缺图、空标题、空动作、空警告和越界标点", () => {
    const defaults = createDefaultWorkspace();
    const invalid: GuideProject = {
      ...defaults.projects.custom,
      image: " ",
      steps: [
        {
          ...defaults.projects.coffee.steps[0],
          id: "invalid-step",
          title: " ",
          instruction: "",
          noteKind: "warning",
          note: " ",
          x: 101,
          y: -1,
        },
      ],
    };

    const errors = validateProject(invalid);
    expect(errors).toContain("请先上传设备图片。");
    expect(errors).toContain("步骤 1 的标题不能为空。");
    expect(errors).toContain("步骤 1 的动作说明不能为空。");
    expect(errors).toContain("步骤 1 的提示或警告不能为空。");
    expect(errors).toContain("步骤 1 的标点超出图片范围。");
    expect(validateProject(defaults.projects.custom)).toContain("至少需要一个操作步骤。");
  });

  it("保存与读取会完整保留编辑、顺序和反馈状态", () => {
    const storage = new MemoryStorage();
    const workspace = createDefaultWorkspace();
    workspace.activeProjectId = "custom";
    workspace.projects.custom.image = "data:image/jpeg;base64,dGVzdA==";
    workspace.projects.custom.reference = "人工粘贴的说明";
    workspace.projects.custom.steps = [
      {
        id: "custom-power",
        title: "打开电源",
        instruction: "按一下右侧电源键。",
        noteKind: "tip",
        note: "绿灯常亮后继续。",
        feedback: "issue",
        x: 72,
        y: 31,
      },
    ];

    saveWorkspace(storage, workspace);
    const loaded = loadWorkspace(storage);

    expect(loaded.warning).toBe("");
    expect(loaded.workspace).toEqual(workspace);
  });

  it("无法解析的本地 JSON 会安全回退并返回可见警告", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{broken-json");

    const loaded = loadWorkspace(storage);

    expect(loaded.warning).toContain("已忽略无效的本地数据");
    expect(loaded.workspace).toEqual(createDefaultWorkspace());
  });

  it("v2 持久化会严格拒绝非法新字段和重复步骤 id", () => {
    const storage = new MemoryStorage();
    const invalidField = createDefaultWorkspace();
    (invalidField.projects.coffee.steps[0] as { noteKind: string }).noteKind = "danger";
    storage.setItem(STORAGE_KEY, JSON.stringify(invalidField));
    expect(loadWorkspace(storage).warning).toContain("项目或标点数据无效");

    const duplicate = createDefaultWorkspace();
    duplicate.projects.coffee.steps[1].id = duplicate.projects.coffee.steps[0].id;
    storage.setItem(STORAGE_KEY, JSON.stringify(duplicate));
    expect(loadWorkspace(storage).warning).toContain("项目或标点数据无效");
  });

  it("v1 数据会迁移到 v2，并为旧步骤补齐诚实的安全默认字段", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeProjectId: "custom",
        projects: {
          custom: {
            id: "custom",
            name: "旧设备",
            kind: "custom",
            image: "data:image/jpeg;base64,b2xk",
            imageAlt: "旧设备照片",
            reference: "旧说明",
            steps: [
              {
                id: "legacy-step",
                instruction: "按下旧设备的按钮。",
                x: 28,
                y: 64,
              },
            ],
          },
        },
      }),
    );

    const loaded = loadWorkspace(storage);
    expect(loaded.warning).toBe("");
    expect(loaded.workspace.version).toBe(2);
    expect(loaded.workspace.projects.custom.steps[0]).toEqual({
      id: "legacy-step",
      title: "步骤 1",
      instruction: "按下旧设备的按钮。",
      noteKind: "none",
      note: "",
      feedback: "none",
      x: 28,
      y: 64,
    });
    expect(loaded.workspace.projects.coffee.steps).toHaveLength(3);
  });

  it("重置样例只替换目标样例并保留其他项目", () => {
    const workspace = createDefaultWorkspace();
    workspace.projects.coffee.steps[0].title = "被修改";
    workspace.projects.projector.steps[0].title = "应保留的投影仪修改";
    workspace.projects.custom.reference = "应保留的自定义说明";

    const reset = resetSampleProject(workspace, "coffee");

    expect(reset.activeProjectId).toBe("coffee");
    expect(reset.projects.coffee.steps[0].title).toBe("启动预热");
    expect(reset.projects.projector.steps[0].title).toBe("应保留的投影仪修改");
    expect(reset.projects.custom.reference).toBe("应保留的自定义说明");
    expect(resetSampleProject(workspace, "custom")).toBe(workspace);
  });

  it("QR 库编码的就是可解码的真实指南路由", async () => {
    const projectId = "自定义/设备 #1";
    const path = guidePath(projectId);
    const url = guideUrl("https://press-here.example/", projectId);

    expect(path).toBe("/guide/%E8%87%AA%E5%AE%9A%E4%B9%89%2F%E8%AE%BE%E5%A4%87%20%231");
    expect(url).toBe(`https://press-here.example${path}`);

    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 7,
    });
    const png = PNG.sync.read(qrBuffer);
    const decoded = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
    expect(decoded?.data).toBe(url);
  });

  it("图片坐标与舞台坐标可往返，并拒绝点击 letterbox 留白", () => {
    const imagePoint = { x: 20, y: 25 };
    const onWideStage = imagePointToStage(imagePoint, 2);
    const roundTrip = stagePointToImage(onWideStage, 2);

    expect(roundTrip?.x).toBeCloseTo(imagePoint.x, 6);
    expect(roundTrip?.y).toBeCloseTo(imagePoint.y, 6);
    expect(stagePointToImage({ x: 50, y: 5 }, 2)).toBeNull();
    expect(stagePointToImage({ x: 10, y: 50 }, 0.75)).toBeNull();
    expect(clampPoint({ x: -8, y: 112 })).toEqual({ x: 0, y: 100 });
  });
});

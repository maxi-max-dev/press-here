import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "../app/editor";
import {
  createDefaultWorkspace,
  loadWorkspace,
  saveWorkspace,
} from "../app/lib/guide-state";

const STORAGE_KEY = "press-here-workspace-v1";

function storedWorkspace() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("测试预期工作区已经保存");
  return JSON.parse(raw) as ReturnType<typeof createDefaultWorkspace>;
}

describe("编辑器黄金路径", () => {
  it("首屏直接说明产品用途并展示可点的咖啡机步骤与真实指南路由", async () => {
    render(<Editor />);

    expect(
      await screen.findByText(
        "在真实设备照片上加操作标记，生成贴在设备旁的扫码指南。",
      ),
    ).toBeTruthy();
    expect(screen.getByAltText("一台白色咖啡机，顶部有三个清晰控件")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^步骤 [123]：/ })).toHaveLength(3);
    expect(screen.getByText("按蓝色电源键，等待机器预热。")).toBeTruthy();
    expect(screen.getByText("示例解析 · 预先制作，非实时 AI")).toBeTruthy();
    expect(screen.getByText("/guide/coffee")).toBeTruthy();
    expect(await screen.findByAltText("当前指南路由二维码")).toBeTruthy();
  });

  it("切换投影仪时照片、标点和步骤内容都真实变化", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await screen.findByText("启动预热");

    await user.click(screen.getByRole("button", { name: /投影仪/ }));

    expect(screen.getByAltText("一台白色投影仪，顶部有黄色和蓝色按键，前方有镜头")).toBeTruthy();
    expect(screen.queryByAltText("一台白色咖啡机，顶部有三个清晰控件")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^步骤 [123]：/ })).toHaveLength(3);
    expect(screen.getByText("接通并开机")).toBeTruthy();
    expect(screen.getByText("按一下黄色电源键开机。")).toBeTruthy();
    expect(screen.getByText("/guide/projector")).toBeTruthy();
  });

  it("标题、动作、警告和说明书参考保存后刷新仍恢复", async () => {
    const user = userEvent.setup();
    const first = render(<Editor />);
    await screen.findByText("启动预热");

    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("步骤标题"));
    await user.type(screen.getByLabelText("步骤标题"), "安全启动");
    await user.clear(screen.getByLabelText("步骤文案"));
    await user.type(screen.getByLabelText("步骤文案"), "长按电源键直到指示灯常亮。");
    await user.selectOptions(screen.getByLabelText("提示类型"), "warning");
    await user.clear(screen.getByLabelText("提示或警告内容"));
    await user.type(screen.getByLabelText("提示或警告内容"), "手湿时不要触碰电源区域。");
    await user.clear(screen.getByLabelText("说明书参考"));
    await user.type(screen.getByLabelText("说明书参考"), "合成说明：通电后等待蓝灯常亮。");
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    const saved = storedWorkspace().projects.coffee;
    expect(saved.steps[0]).toMatchObject({
      title: "安全启动",
      instruction: "长按电源键直到指示灯常亮。",
      noteKind: "warning",
      note: "手湿时不要触碰电源区域。",
    });
    expect(saved.reference).toBe("合成说明：通电后等待蓝灯常亮。");

    first.unmount();
    render(<Editor />);
    expect(await screen.findByText("长按电源键直到指示灯常亮。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect((screen.getByLabelText("步骤标题") as HTMLInputElement).value).toBe("安全启动");
    expect((screen.getByLabelText("提示类型") as HTMLSelectElement).value).toBe("warning");
    expect((screen.getByLabelText("提示或警告内容") as HTMLInputElement).value).toBe(
      "手湿时不要触碰电源区域。",
    );
  });

  it("支持新增、调整顺序并删除步骤", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await screen.findByText("启动预热");
    await user.click(screen.getByRole("button", { name: "编辑" }));

    await user.click(screen.getByRole("button", { name: "＋ 新增" }));
    await user.clear(screen.getByLabelText("步骤标题"));
    await user.type(screen.getByLabelText("步骤标题"), "清洁托盘");
    await user.clear(screen.getByLabelText("步骤文案"));
    await user.type(screen.getByLabelText("步骤文案"), "取出并清空滴水托盘。");
    await user.click(screen.getByRole("button", { name: "↑ 提前" }));
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    let saved = storedWorkspace().projects.coffee;
    expect(saved.steps).toHaveLength(4);
    expect(saved.steps[2].title).toBe("清洁托盘");

    await user.click(screen.getByRole("button", { name: "删除" }));
    await user.click(screen.getByRole("button", { name: "保存更改" }));
    saved = storedWorkspace().projects.coffee;
    expect(saved.steps).toHaveLength(3);
    expect(saved.steps.some((step) => step.title === "清洁托盘")).toBe(false);
  });

  it("编辑模式可用方向键微调标点并持久化", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await screen.findByText("启动预热");
    await user.click(screen.getByRole("button", { name: "编辑" }));

    const marker = screen.getByRole("button", { name: /步骤 1：按蓝色电源键/ });
    marker.focus();
    await user.keyboard("{ArrowRight}{Shift>}{ArrowDown}{/Shift}");
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    expect(storedWorkspace().projects.coffee.steps[0]).toMatchObject({
      x: 30.6,
      y: 33,
    });
  });

  it("自定义项目诚实显示无自动识别，并拦截无图空步骤指南", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await screen.findByText("启动预热");

    await user.click(screen.getByRole("button", { name: /我的设备/ }));
    expect(screen.getByText("尚未自动解析 · 手动标点")).toBeTruthy();
    expect(screen.getByText("没有自动识别")).toBeTruthy();
    expect(screen.getByText("上传图片并建立至少一个有效步骤后生成二维码")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /生成并打开指南/ }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("请先上传设备图片。");
    expect(alert.textContent).toContain("至少需要一个操作步骤。");
  });

  it("上传本地图片后可点击真实位置手动建点，并导入说明文字", async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor />);
    await screen.findByText("启动预热");
    await user.click(screen.getByRole("button", { name: /我的设备/ }));

    const imageFile = new File(["local-image"], "device.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("选择设备图片"), imageFile);
    expect(await screen.findByText("图片已载入。现在点击图片上的真实控件来建立标点。")).toBeTruthy();

    const stage = container.querySelector<HTMLElement>(".device-stage");
    if (!stage) throw new Error("找不到设备图片舞台");
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        toJSON: () => ({}),
      }),
    });
    fireEvent.click(stage, { clientX: 200, clientY: 150 });

    expect(await screen.findByLabelText("步骤标题")).toBeTruthy();
    await user.clear(screen.getByLabelText("步骤标题"));
    await user.type(screen.getByLabelText("步骤标题"), "打开电源");
    await user.clear(screen.getByLabelText("步骤文案"));
    await user.type(screen.getByLabelText("步骤文案"), "按下照片中央的电源键。");
    await user.selectOptions(screen.getByLabelText("提示类型"), "tip");
    await user.type(screen.getByLabelText("提示或警告内容"), "看到绿灯后继续。");

    const manual = new File(["先接通电源，再按中间按键。"], "manual.txt", {
      type: "text/plain",
    });
    await user.upload(screen.getByLabelText("上传说明文字"), manual);
    expect(await screen.findByDisplayValue("先接通电源，再按中间按键。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "保存更改" }));

    const custom = storedWorkspace().projects.custom;
    expect(custom.image).toBe("data:image/jpeg;base64,cHJlc3MtaGVyZQ==");
    expect(custom.reference).toBe("先接通电源，再按中间按键。");
    expect(custom.steps[0]).toMatchObject({
      title: "打开电源",
      instruction: "按下照片中央的电源键。",
      noteKind: "tip",
      note: "看到绿灯后继续。",
      x: 50,
      y: 50,
    });
  });

  it("重置仅恢复当前内置样例，不破坏自定义项目", async () => {
    const workspace = createDefaultWorkspace();
    workspace.projects.coffee.steps[0].instruction = "被用户修改的咖啡机动作";
    workspace.projects.custom.reference = "应当保留的自定义说明";
    saveWorkspace(window.localStorage, workspace);

    const user = userEvent.setup();
    render(<Editor />);
    expect(await screen.findByText("被用户修改的咖啡机动作")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "重置咖啡机样例" }));

    expect(await screen.findByText("按蓝色电源键，等待机器预热。")).toBeTruthy();
    const saved = loadWorkspace(window.localStorage).workspace;
    expect(saved.projects.coffee.steps[0].instruction).toBe("按蓝色电源键，等待机器预热。");
    expect(saved.projects.custom.reference).toBe("应当保留的自定义说明");
  });

  it("损坏的本地持久化数据会被忽略并给出可见提示", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-valid-json");
    render(<Editor />);

    expect(await screen.findByText(/已忽略无效的本地数据/)).toBeTruthy();
    expect(screen.getByText("按蓝色电源键，等待机器预热。")).toBeTruthy();
  });

  it("点击照片编号会同步聚焦对应动作", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await screen.findByText("启动预热");

    await user.click(screen.getByRole("button", { name: /步骤 2：装好手柄后/ }));
    expect(screen.getByText("开始萃取")).toBeTruthy();
    expect(screen.getByText("装好手柄后，按中间的萃取键。")).toBeTruthy();
    expect(screen.getByText("确认手柄已锁紧，杯子已放稳。")).toBeTruthy();
  });
});

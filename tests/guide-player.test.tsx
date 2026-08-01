import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuidePlayer } from "../app/guide/[id]/player";
import { loadWorkspace } from "../app/lib/guide-state";

describe("手机指南阅读器", () => {
  it("首屏显示真实标记对应的标题、动作、提示和进度", async () => {
    render(<GuidePlayer projectId="coffee" />);

    expect(await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" })).toBeTruthy();
    expect(screen.getByText("启动预热")).toBeTruthy();
    expect(screen.getByText("提示")).toBeTruthy();
    expect(screen.getByText("指示灯停止闪烁后再继续。")).toBeTruthy();
    expect(screen.getByLabelText("已完成 0 / 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "← 上一步" }).hasAttribute("disabled")).toBe(true);
  });

  it("可逐步前进、看到警告、完成并重新开始", async () => {
    const user = userEvent.setup();
    render(<GuidePlayer projectId="coffee" />);
    await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" });

    await user.click(screen.getByRole("button", { name: "下一步 →" }));
    expect(await screen.findByRole("heading", { name: "装好手柄后，按中间的萃取键。" })).toBeTruthy();
    expect(screen.getByText("警告")).toBeTruthy();
    expect(screen.getByText("确认手柄已锁紧，杯子已放稳。")).toBeTruthy();
    expect(screen.getByLabelText("已完成 1 / 3")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "下一步 →" }));
    expect(await screen.findByRole("heading", { name: "需要奶泡时，向下转动红色蒸汽旋钮。" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(await screen.findByRole("heading", { name: "操作完成" })).toBeTruthy();
    expect(screen.getByText("你已走完这份咖啡机指南。")).toBeTruthy();
    expect(screen.getByLabelText("已完成 3 / 3")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "重新开始" }));
    expect(await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" })).toBeTruthy();
    expect(screen.getByLabelText("已完成 0 / 3")).toBeTruthy();
  });

  it("读者可反馈这一步不对，并把状态保存到当前浏览器", async () => {
    const user = userEvent.setup();
    render(<GuidePlayer projectId="coffee" />);
    await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" });

    const issue = screen.getByRole("button", { name: "这一步不对" });
    await user.click(issue);

    expect(await screen.findByText("已反馈：这一步需要作者检查。")).toBeTruthy();
    expect(issue.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("已提交检查，作者可在本机编辑器修正。")).toBeTruthy();
    expect(loadWorkspace(window.localStorage).workspace.projects.coffee.steps[0].feedback).toBe("issue");
  });

  it("读者可标记已解决，并在重新打开指南后恢复", async () => {
    const user = userEvent.setup();
    const first = render(<GuidePlayer projectId="coffee" />);
    await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" });
    await user.click(screen.getByRole("button", { name: "已解决" }));

    expect(await screen.findByText("已记录：这一步已经解决。")).toBeTruthy();
    expect(loadWorkspace(window.localStorage).workspace.projects.coffee.steps[0].feedback).toBe("resolved");
    first.unmount();

    render(<GuidePlayer projectId="coffee" />);
    await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" });
    expect(screen.getByText("这一步已标记解决。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "已解决" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("不存在的指南路由显示明确错误，不渲染坏阅读页", async () => {
    render(<GuidePlayer projectId="not-found" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("指南不可用");
    expect(alert.textContent).toContain("找不到这份指南。");
    expect(screen.queryByRole("button", { name: "下一步 →" })).toBeNull();
  });
});

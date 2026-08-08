import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "../app/editor";
import { GuidePlayer } from "../app/guide/[id]/player";

describe("本机反馈修正闭环", () => {
  it("读者报错后作者修正，重新阅读能看到新文案和已解决状态", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();

    const reader = render(<GuidePlayer projectId="coffee" />);
    await screen.findByRole("heading", { name: "按蓝色电源键，等待机器预热。" });
    await user.click(screen.getByRole("button", { name: "这一步不对" }));
    reader.unmount();

    const editor = render(<Editor />);
    expect(await screen.findByText("读者反馈：这一步不对")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("步骤文案"), {
      target: { value: "按一下蓝色电源键，看到常亮后再继续。" },
    });
    await user.click(screen.getByRole("button", { name: "保存修正并标记已修正" }));
    editor.unmount();

    render(<GuidePlayer projectId="coffee" />);
    expect(await screen.findByRole("heading", { name: "按一下蓝色电源键，看到常亮后再继续。" })).toBeTruthy();
    expect(screen.getByText("这一步已标记解决。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "已解决" }).getAttribute("aria-pressed")).toBe("true");
  });
});

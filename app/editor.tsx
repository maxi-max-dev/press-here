"use client";

import Link from "next/link";
import QRCode from "qrcode";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

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
  type GuideStep,
  type Workspace,
} from "./lib/guide-state";

type Point = Pick<GuideStep, "x" | "y">;
type EditorMode = "view" | "edit";

function makeStep(point: Point = { x: 50, y: 50 }): GuideStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: "新步骤",
    instruction: "在这里写下一句动作说明",
    noteKind: "none",
    note: "",
    feedback: "none",
    ...clampPoint(point),
  };
}

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("图片请控制在 12MB 以内。");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const ratio = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器无法处理这张图片。");
    }

    context.fillStyle = "#f4efe5";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function QrPreview({ value }: { value: string }) {
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    QRCode.toString(value, {
      type: "svg",
      width: 176,
      margin: 1,
      color: {
        dark: "#17243d",
        light: "#fffdf7",
      },
    })
      .then((svg) => {
        if (active) {
          setSource(
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          );
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (failed) {
    return (
      <span className="qr-error" role="status">
        二维码生成失败
      </span>
    );
  }

  return source ? (
    <img
      className="qr-image"
      src={source}
      alt="当前指南路由二维码"
      width="176"
      height="176"
    />
  ) : null;
}

export function Editor() {
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    createDefaultWorkspace(),
  );
  const [activeStepId, setActiveStepId] = useState("coffee-power");
  const [mode, setMode] = useState<EditorMode>("view");
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState("");
  const [imageAspect, setImageAspect] = useState(4 / 3);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadWorkspace(window.localStorage);
      setWorkspace(loaded.workspace);
      setActiveStepId(
        loaded.workspace.projects[loaded.workspace.activeProjectId]?.steps[0]
          ?.id ?? "",
      );
      setNotice(loaded.warning);
      setOrigin(window.location.origin);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const current =
    workspace.projects[workspace.activeProjectId] ?? workspace.projects.coffee;
  const activeIndex = Math.max(
    0,
    current.steps.findIndex((step) => step.id === activeStepId),
  );
  const activeStep = current.steps[activeIndex];
  const validationErrors = useMemo(
    () => validateProject(current),
    [current],
  );
  const route = origin ? guideUrl(origin, current.id) : guidePath(current.id);
  const issueCount = current.steps.filter(
    (step) => step.feedback === "issue",
  ).length;

  function updateCurrent(update: (project: GuideProject) => GuideProject) {
    setWorkspace((previous) => ({
      ...previous,
      projects: {
        ...previous.projects,
        [previous.activeProjectId]: update(
          previous.projects[previous.activeProjectId],
        ),
      },
    }));
    setDirty(true);
    setErrors([]);
    setNotice("");
  }

  function selectProject(projectId: string) {
    const project = workspace.projects[projectId];
    if (!project) return;

    setWorkspace((previous) => ({
      ...previous,
      activeProjectId: projectId,
    }));
    setActiveStepId(project.steps[0]?.id ?? "");
    setImageAspect(4 / 3);
    setErrors([]);
    setNotice("");
  }

  function addStep(point: Point = { x: 50, y: 50 }) {
    if (!current.image) {
      setErrors(["请先上传设备图片，再在图上建立标点。"]);
      return;
    }

    const step = makeStep(point);
    updateCurrent((project) => ({
      ...project,
      steps: [...project.steps, step],
    }));
    setActiveStepId(step.id);
    setMode("edit");
  }

  function removeStep(stepId: string) {
    const nextSteps = current.steps.filter((step) => step.id !== stepId);
    updateCurrent((project) => ({
      ...project,
      steps: nextSteps,
    }));
    setActiveStepId(
      nextSteps[Math.min(activeIndex, Math.max(0, nextSteps.length - 1))]?.id ??
        "",
    );
  }

  function updateStep(stepId: string, update: Partial<GuideStep>) {
    updateCurrent((project) => ({
      ...project,
      steps: project.steps.map((step) =>
        step.id === stepId ? { ...step, ...update } : step,
      ),
    }));
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    const index = current.steps.findIndex((step) => step.id === stepId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.steps.length) return;

    const steps = [...current.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    updateCurrent((project) => ({ ...project, steps }));
  }

  function resetCurrentSample() {
    if (current.kind !== "sample") return;
    if (
      !window.confirm(
        `重置${current.name}样例？你对此样例的本地修改会被清除。`,
      )
    ) {
      return;
    }

    const nextWorkspace = resetSampleProject(workspace, current.id);
    try {
      saveWorkspace(window.localStorage, nextWorkspace);
      setWorkspace(nextWorkspace);
      setActiveStepId(nextWorkspace.projects[current.id].steps[0]?.id ?? "");
      setMode("view");
      setDirty(false);
      setErrors([]);
      setNotice(`${current.name}已恢复为内置示例。其他设备没有改变。`);
    } catch {
      setErrors(["重置失败：浏览器存储空间不足。"]);
    }
  }

  function resolveFeedback(stepId: string) {
    const nextWorkspace: Workspace = {
      ...workspace,
      projects: {
        ...workspace.projects,
        [current.id]: {
          ...current,
          steps: current.steps.map((step) =>
            step.id === stepId
              ? { ...step, feedback: "resolved" }
              : step,
          ),
        },
      },
    };

    try {
      saveWorkspace(window.localStorage, nextWorkspace);
      setWorkspace(nextWorkspace);
      setDirty(false);
      setErrors([]);
      setNotice("修正内容和“已修正”状态已一起保存。读者重新打开即可看到。 ");
    } catch {
      setErrors(["修正未保存：浏览器存储空间不足。"]);
    }
  }

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const stagePoint = clampPoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
    return current.kind === "custom"
      ? stagePointToImage(stagePoint, imageAspect)
      : stagePoint;
  }

  function handleStageClick(event: MouseEvent<HTMLDivElement>) {
    if (mode !== "edit" || dragStepId) return;

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const stagePoint = clampPoint({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
    const imagePoint =
      current.kind === "custom"
        ? stagePointToImage(stagePoint, imageAspect)
        : stagePoint;

    if (!imagePoint) {
      setErrors(["请在照片内容范围内建立标点，不要点击留白区域。"]);
      return;
    }
    addStep(imagePoint);
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const image = await compressImage(file);
      updateCurrent((project) => ({
        ...project,
        image,
        steps: [],
      }));
      setActiveStepId("");
      setMode("edit");
      setNotice("图片已载入。现在点击图片上的真实控件来建立标点。");
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "图片读取失败。",
      ]);
    } finally {
      event.target.value = "";
    }
  }

  async function handleReferenceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 64 * 1024) {
      setErrors(["说明文字请控制在 64KB 以内。"]);
      event.target.value = "";
      return;
    }

    try {
      const reference = await file.text();
      updateCurrent((project) => ({ ...project, reference }));
      setNotice("说明文字已载入，仅作为人工编辑参考。");
    } catch {
      setErrors(["说明文字读取失败。"]);
    } finally {
      event.target.value = "";
    }
  }

  function persist(showConfirmation = true) {
    try {
      saveWorkspace(window.localStorage, workspace);
      setDirty(false);
      if (showConfirmation) {
        setNotice("已保存到此浏览器。刷新页面后仍会恢复。");
      }
      return true;
    } catch {
      setErrors(["保存失败：图片可能过大或浏览器存储空间不足。"]);
      return false;
    }
  }

  function openGuide() {
    const nextErrors = validateProject(current);
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    if (!persist(false)) return;
    window.location.assign(guidePath(current.id));
  }

  return (
    <main className="editor-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="按这里首页">
          <span className="brand-mark">按</span>
          <span>
            <strong>按这里</strong>
            <small>PRESS HERE</small>
          </span>
        </Link>

        <div className="mode-switch" aria-label="工作模式">
          <button
            aria-pressed={mode === "view"}
            className={mode === "view" ? "is-active" : ""}
            onClick={() => setMode("view")}
          >
            体验
          </button>
          <button
            aria-pressed={mode === "edit"}
            className={mode === "edit" ? "is-active" : ""}
            onClick={() => setMode("edit")}
          >
            编辑
          </button>
        </div>
      </header>

      <section className="purpose-strip" aria-label="产品用途">
        <strong>在真实设备照片上加操作标记，生成贴在设备旁的扫码指南。</strong>
        <ol aria-label="制作流程">
          <li>
            <span>1</span>点控件
          </li>
          <li>
            <span>2</span>写动作
          </li>
          <li>
            <span>3</span>扫码照做
          </li>
        </ol>
      </section>

      <nav className="device-tabs" aria-label="设备样例">
        {Object.values(workspace.projects).map((project) => (
          <button
            key={project.id}
            className={project.id === current.id ? "is-active" : ""}
            onClick={() => selectProject(project.id)}
            aria-pressed={project.id === current.id}
          >
            <span>
              {project.kind === "sample" ? "示例解析" : "手动创建"}
            </span>
            {project.name}
          </button>
        ))}
      </nav>

      <section className="workspace-grid">
        <div className="device-column">
          <div className="device-heading">
            <div>
              <span className={`status-chip ${current.kind}`}>
                {current.kind === "sample"
                  ? "示例解析 · 预先制作，非实时 AI"
                  : "尚未自动解析 · 手动标点"}
              </span>
              <h1>{current.name}</h1>
            </div>

            <div className="device-meta-actions">
              {issueCount > 0 && (
                <span className="feedback-count">{issueCount} 条待修正</span>
              )}
              <span className="step-count">{current.steps.length} 个步骤</span>
              {current.kind === "sample" && (
                <button className="reset-button" onClick={resetCurrentSample}>
                  重置{current.name}样例
                </button>
              )}
            </div>
          </div>

          <div
            ref={stageRef}
            className={`device-stage ${mode === "edit" ? "is-editing" : ""} ${!current.image ? "is-empty" : ""}`}
            onClick={handleStageClick}
            onPointerMove={(event) => {
              const point = pointFromEvent(event);
              if (dragStepId && point) updateStep(dragStepId, point);
            }}
            onPointerUp={() => setDragStepId(null)}
            onPointerCancel={() => setDragStepId(null)}
          >
            {current.image ? (
              <img
                className={
                  current.kind === "sample"
                    ? "device-photo cover"
                    : "device-photo contain"
                }
                src={current.image}
                alt={current.imageAlt}
                onLoad={(event) =>
                  setImageAspect(
                    event.currentTarget.naturalWidth /
                      event.currentTarget.naturalHeight,
                  )
                }
              />
            ) : (
              <div className="empty-photo">
                <span>＋</span>
                <strong>上传你的设备照片</strong>
                <p>照片只在当前浏览器中处理，不会上传。</p>
                {current.kind === "custom" && (
                  <label
                    className="canvas-upload"
                    onClick={(event) => event.stopPropagation()}
                  >
                    选择设备照片
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhoto}
                    />
                  </label>
                )}
              </div>
            )}

            {current.image &&
              current.steps.map((step, index) => {
                const displayPoint =
                  current.kind === "custom"
                    ? imagePointToStage(step, imageAspect)
                    : step;

                return (
                  <button
                    key={step.id}
                    type="button"
                    className={`marker ${step.id === activeStep?.id ? "is-active" : ""}`}
                    style={{
                      left: `${displayPoint.x}%`,
                      top: `${displayPoint.y}%`,
                    }}
                    aria-label={`步骤 ${index + 1}：${step.instruction}；标题：${step.title}${mode === "edit" ? "，可拖动或用方向键调整" : ""}`}
                    data-feedback={step.feedback}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveStepId(step.id);
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setActiveStepId(step.id);
                      if (mode === "edit") {
                        setDragStepId(step.id);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (mode !== "edit") return;
                      const amount = event.shiftKey ? 5 : 1;
                      const delta = {
                        ArrowLeft: { x: -amount, y: 0 },
                        ArrowRight: { x: amount, y: 0 },
                        ArrowUp: { x: 0, y: -amount },
                        ArrowDown: { x: 0, y: amount },
                      }[event.key];
                      if (!delta) return;

                      event.preventDefault();
                      updateStep(
                        step.id,
                        clampPoint({
                          x: step.x + delta.x,
                          y: step.y + delta.y,
                        }),
                      );
                    }}
                  >
                    {index + 1}
                  </button>
                );
              })}
          </div>

          <p className="stage-hint">
            {mode === "edit"
              ? "点击图片新增标点；拖动圆点或用方向键微调。"
              : "点击编号，立即看到对应控件和动作。"}
          </p>
        </div>

        <aside className="inspector" aria-label="步骤说明与编辑工具">
          {current.kind === "custom" && (
            <section className="honesty-panel">
              <div>
                <strong>没有自动识别</strong>
                <span>你保留全部决定权</span>
              </div>
              <p>上传照片后，直接点真实控件建立标点；说明文字只作为人工参考。</p>
              <div className="upload-row">
                <label className="upload-button">
                  选择设备图片
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                  />
                </label>
                <label className="upload-button secondary">
                  上传说明文字
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={handleReferenceFile}
                  />
                </label>
              </div>
            </section>
          )}

          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}

          {errors.length > 0 && (
            <div className="error-box" role="alert">
              <strong>还不能生成指南</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {activeStep && activeStep.feedback !== "none" && (
            <section
              className={`feedback-status ${activeStep.feedback}`}
              aria-label="当前步骤读者反馈"
            >
              <div>
                <strong>
                  {activeStep.feedback === "issue"
                    ? "读者反馈：这一步不对"
                    : "这一步已标记解决"}
                </strong>
                <p>
                  {activeStep.feedback === "issue"
                    ? "先修改标题、动作或提示，再明确保存修正。"
                    : "修正状态已保存在当前浏览器。"}
                </p>
              </div>
              {activeStep.feedback === "issue" && (
                <button onClick={() => resolveFeedback(activeStep.id)}>
                  保存修正并标记已修正
                </button>
              )}
            </section>
          )}

          {mode === "view" ? (
            <section className="step-reader" aria-live="polite">
              <span className="eyebrow">
                当前步骤 {activeStep ? activeIndex + 1 : 0} /{" "}
                {current.steps.length}
              </span>
              <strong className="big-number">
                {activeStep ? activeIndex + 1 : "—"}
              </strong>
              <h2>{activeStep?.title ?? "还没有步骤"}</h2>
              <p className="step-instruction">
                {activeStep?.instruction ??
                  "切换到编辑模式，在图片上建立第一个标点。"}
              </p>
              {activeStep && activeStep.noteKind !== "none" && (
                <div className={`step-note ${activeStep.noteKind}`}>
                  <strong>
                    {activeStep.noteKind === "warning" ? "注意" : "提示"}
                  </strong>
                  <span>{activeStep.note}</span>
                </div>
              )}
              <div className="step-dots" aria-label="选择步骤">
                {current.steps.map((step, index) => (
                  <button
                    key={step.id}
                    className={
                      step.id === activeStep?.id ? "is-active" : ""
                    }
                    onClick={() => setActiveStepId(step.id)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="edit-tools">
              <div className="tool-title">
                <div>
                  <span className="eyebrow">编辑步骤</span>
                  <h2>{activeStep ? `第 ${activeIndex + 1} 步` : "新建第一步"}</h2>
                </div>
                <button className="text-button" onClick={() => addStep()}>
                  ＋ 新增
                </button>
              </div>

              {activeStep ? (
                <>
                  <label className="field-label" htmlFor="step-title">
                    步骤标题
                  </label>
                  <input
                    id="step-title"
                    className="text-input"
                    aria-label="步骤标题"
                    value={activeStep.title}
                    onChange={(event) =>
                      updateStep(activeStep.id, { title: event.target.value })
                    }
                  />

                  <label className="field-label" htmlFor="instruction">
                    一句动作
                  </label>
                  <textarea
                    id="instruction"
                    aria-label="步骤文案"
                    value={activeStep.instruction}
                    onChange={(event) =>
                      updateStep(activeStep.id, {
                        instruction: event.target.value,
                      })
                    }
                    rows={3}
                  />

                  <div className="note-editor-grid">
                    <div>
                      <label className="field-label" htmlFor="note-kind">
                        补充信息
                      </label>
                      <select
                        id="note-kind"
                        aria-label="提示类型"
                        value={activeStep.noteKind}
                        onChange={(event) => {
                          const noteKind = event.target
                            .value as GuideStep["noteKind"];
                          updateStep(activeStep.id, {
                            noteKind,
                            note: noteKind === "none" ? "" : activeStep.note,
                          });
                        }}
                      >
                        <option value="none">无</option>
                        <option value="tip">提示</option>
                        <option value="warning">警告</option>
                      </select>
                    </div>

                    {activeStep.noteKind !== "none" && (
                      <div>
                        <label className="field-label" htmlFor="step-note">
                          提示或警告内容
                        </label>
                        <input
                          id="step-note"
                          className="text-input"
                          aria-label="提示或警告内容"
                          value={activeStep.note}
                          onChange={(event) =>
                            updateStep(activeStep.id, {
                              note: event.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="step-actions">
                    <button
                      onClick={() => moveStep(activeStep.id, -1)}
                      disabled={activeIndex === 0}
                    >
                      ↑ 提前
                    </button>
                    <button
                      onClick={() => moveStep(activeStep.id, 1)}
                      disabled={activeIndex === current.steps.length - 1}
                    >
                      ↓ 后移
                    </button>
                    <button
                      className="danger"
                      onClick={() => removeStep(activeStep.id)}
                    >
                      删除
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="empty-step-button"
                  onClick={() => addStep()}
                >
                  ＋ 在图片中央添加第一步
                </button>
              )}

              <label className="field-label" htmlFor="reference">
                说明书参考
              </label>
              <textarea
                id="reference"
                aria-label="说明书参考"
                className="reference-field"
                value={current.reference}
                onChange={(event) =>
                  updateCurrent((project) => ({
                    ...project,
                    reference: event.target.value,
                  }))
                }
                placeholder="粘贴简短说明文字，仅作为人工编辑参考…"
                rows={4}
              />
              <button className="save-button" onClick={() => persist()}>
                {dirty ? "保存更改" : "已保存 · 再次保存"}
              </button>
            </section>
          )}

          <section className="publish-card">
            <div className="publish-copy">
              <span className="sticker-label">贴在设备旁 · 分享卡模拟</span>
              <span className="eyebrow">按这里 / PRESS HERE</span>
              <h2>不会操作{current.name}？扫码跟着做</h2>
              <p>
                {current.steps.length}
                个步骤，一步一屏。
                {current.kind === "custom"
                  ? "仅本机演示；跨设备扫码不会携带这份自定义数据。"
                  : "内置样例路由可在其他设备打开；反馈仍只保存在当前浏览器。"}
              </p>
              <code>{guidePath(current.id)}</code>
            </div>

            {dirty ? (
              <span className="qr-pending" role="status">
                保存或生成后
                <br />
                二维码更新
              </span>
            ) : validationErrors.length === 0 ? (
              <QrPreview value={route} />
            ) : (
              <span className="qr-pending invalid" role="status">
                上传图片并建立至少一个有效步骤后生成二维码
              </span>
            )}

            <button className="primary-button" onClick={openGuide}>
              {current.kind === "custom" ? "在本机打开指南" : "生成并打开指南"} <span>→</span>
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}

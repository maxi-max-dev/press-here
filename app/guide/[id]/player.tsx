"use client";

import { useEffect, useRef, useState } from "react";

import {
  createDefaultWorkspace,
  imagePointToStage,
  loadWorkspace,
  saveWorkspace,
  validateProject,
  type FeedbackState,
  type GuideProject,
} from "../../lib/guide-state";

interface GuidePlayerProps {
  projectId: string;
}

export function GuidePlayer({ projectId }: GuidePlayerProps) {
  const [project, setProject] = useState<GuideProject | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [imageAspect, setImageAspect] = useState(4 / 3);
  const currentCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadWorkspace(window.localStorage);
      if (loaded.warning) {
        setError(`本地保存数据无效：${loaded.warning}`);
        return;
      }

      const nextProject =
        loaded.workspace.projects[projectId] ??
        createDefaultWorkspace().projects[projectId];
      if (!nextProject) {
        setError("找不到这份指南。");
        return;
      }

      const validationErrors = validateProject(nextProject);
      if (validationErrors.length > 0) {
        setError(`这份指南无法打开：${validationErrors[0]}`);
        return;
      }

      setProject(nextProject);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [projectId]);

  useEffect(() => {
    currentCardRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [stepIndex, isFinished]);

  if (error) {
    return (
      <main className="guide-error" role="alert">
        <strong>指南不可用</strong>
        <p>{error}</p>
      </main>
    );
  }

  if (!project) {
    return <main className="guide-loading" aria-label="正在载入指南" />;
  }

  const currentStep = project.steps[stepIndex];
  const completedSteps = isFinished ? project.steps.length : stepIndex;
  const markerPoint =
    project.kind === "custom"
      ? imagePointToStage(currentStep, imageAspect)
      : currentStep;

  function saveFeedback(feedback: FeedbackState) {
    const loaded = loadWorkspace(window.localStorage);
    if (loaded.warning) {
      setFeedbackMessage("反馈未保存：本地数据已经损坏。");
      return;
    }

    const storedProject = loaded.workspace.projects[projectId];
    if (!storedProject) {
      setFeedbackMessage("反馈未保存：找不到这份指南。");
      return;
    }

    const updatedProject: GuideProject = {
      ...storedProject,
      steps: storedProject.steps.map((step) =>
        step.id === currentStep.id ? { ...step, feedback } : step,
      ),
    };
    const updatedWorkspace = {
      ...loaded.workspace,
      projects: {
        ...loaded.workspace.projects,
        [projectId]: updatedProject,
      },
    };

    try {
      saveWorkspace(window.localStorage, updatedWorkspace);
      setProject(updatedProject);
      setFeedbackMessage(
        feedback === "issue"
          ? "已反馈：这一步需要作者检查。"
          : "已记录：这一步已经解决。",
      );
    } catch {
      setFeedbackMessage("反馈未保存：浏览器存储空间不足。");
    }
  }

  return (
    <main className="guide-shell">
      <section
        className="guide-photo-wrap"
        aria-label={`${project.imageAlt}；编号 ${stepIndex + 1} 标记的是“${currentStep.title}”`}
      >
        <img
          className={
            project.kind === "sample"
              ? "guide-photo cover"
              : "guide-photo contain"
          }
          src={project.image}
          alt={project.imageAlt}
          onLoad={(event) =>
            setImageAspect(
              event.currentTarget.naturalWidth /
                event.currentTarget.naturalHeight,
            )
          }
        />
        {!isFinished && (
          <span
            className="guide-marker"
            style={{ left: `${markerPoint.x}%`, top: `${markerPoint.y}%` }}
            aria-hidden="true"
          >
            {stepIndex + 1}
          </span>
        )}
      </section>

      <section
        ref={currentCardRef}
        className="guide-current"
        aria-live="polite"
      >
        {isFinished ? (
          <>
            <span className="guide-check">✓</span>
            <p className="guide-kicker">完成状态</p>
            <h1>操作完成</h1>
            <p>你已走完这份{project.name}指南。</p>
          </>
        ) : (
          <>
            <p className="guide-kicker">
              当前步骤 · {stepIndex + 1} / {project.steps.length}
            </p>
            <p className="guide-step-title">{currentStep.title}</p>
            <h1>{currentStep.instruction}</h1>
            {currentStep.noteKind === "none" ? (
              <p>看图找到编号 {stepIndex + 1}，完成后继续。</p>
            ) : (
              <div className={`guide-note ${currentStep.noteKind}`}>
                <strong>
                  {currentStep.noteKind === "warning" ? "警告" : "提示"}
                </strong>
                <span>{currentStep.note}</span>
              </div>
            )}
          </>
        )}
      </section>

      {!isFinished && (
        <section className="guide-feedback" aria-label="这一步的反馈">
          <p>这一步有帮助吗？反馈只保存在当前浏览器。</p>
          {currentStep.feedback !== "none" && (
            <strong
              className={`guide-feedback-state ${currentStep.feedback}`}
            >
              {currentStep.feedback === "issue"
                ? "已提交检查，作者可在本机编辑器修正。"
                : "这一步已标记解决。"}
            </strong>
          )}
          <div>
            <button
              aria-pressed={currentStep.feedback === "issue"}
              className={
                currentStep.feedback === "issue" ? "is-active issue" : ""
              }
              onClick={() => saveFeedback("issue")}
            >
              这一步不对
            </button>
            <button
              aria-pressed={currentStep.feedback === "resolved"}
              className={
                currentStep.feedback === "resolved"
                  ? "is-active resolved"
                  : ""
              }
              onClick={() => saveFeedback("resolved")}
            >
              已解决
            </button>
          </div>
          {feedbackMessage && <span role="status">{feedbackMessage}</span>}
        </section>
      )}

      <section
        className="guide-progress"
        aria-label={`已完成 ${completedSteps} / ${project.steps.length}`}
      >
        <div>
          <span
            style={{
              width: `${(completedSteps / project.steps.length) * 100}%`,
            }}
          />
        </div>
        <p>
          已完成 {completedSteps} / {project.steps.length}
        </p>
      </section>

      <nav className="guide-actions" aria-label="指南步骤">
        <button
          className="guide-previous"
          disabled={!isFinished && stepIndex === 0}
          onClick={() => {
            setFeedbackMessage("");
            if (isFinished) {
              setIsFinished(false);
              setStepIndex(project.steps.length - 1);
            } else {
              setStepIndex((current) => Math.max(0, current - 1));
            }
          }}
        >
          ← 上一步
        </button>
        <button
          className="guide-next"
          onClick={() => {
            setFeedbackMessage("");
            if (isFinished) {
              setIsFinished(false);
              setStepIndex(0);
            } else if (stepIndex === project.steps.length - 1) {
              setIsFinished(true);
            } else {
              setStepIndex((current) => current + 1);
            }
          }}
        >
          {isFinished
            ? "重新开始"
            : stepIndex === project.steps.length - 1
              ? "完成"
              : "下一步 →"}
        </button>
      </nav>
    </main>
  );
}

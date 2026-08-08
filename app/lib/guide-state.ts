const STORAGE_KEY = "press-here-workspace-v1";

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

const ASSET_PREFIX = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH ?? "",
);

export type ProjectKind = "sample" | "custom";
export type NoteKind = "none" | "tip" | "warning";
export type FeedbackState = "none" | "issue" | "resolved";

export interface Point {
  x: number;
  y: number;
}

export interface GuideStep extends Point {
  id: string;
  title: string;
  instruction: string;
  noteKind: NoteKind;
  note: string;
  feedback: FeedbackState;
}

export interface GuideProject {
  id: string;
  name: string;
  kind: ProjectKind;
  image: string;
  imageAlt: string;
  reference: string;
  steps: GuideStep[];
}

export interface Workspace {
  version: 2;
  activeProjectId: string;
  projects: Record<string, GuideProject>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadedWorkspace {
  workspace: Workspace;
  warning: string;
}

const SAMPLE_PROJECTS: Record<"coffee" | "projector", GuideProject> = {
  coffee: {
    id: "coffee",
    name: "咖啡机",
    kind: "sample",
    image: `${ASSET_PREFIX}/devices/coffee-machine.png`,
    imageAlt: "一台白色咖啡机，顶部有三个清晰控件",
    reference:
      "合成说明：先开机预热，再按萃取键；需要奶泡时最后打开蒸汽旋钮。",
    steps: [
      {
        id: "coffee-power",
        title: "启动预热",
        instruction: "按蓝色电源键，等待机器预热。",
        noteKind: "tip",
        note: "指示灯停止闪烁后再继续。",
        feedback: "none",
        x: 29.6,
        y: 28,
      },
      {
        id: "coffee-brew",
        title: "开始萃取",
        instruction: "装好手柄后，按中间的萃取键。",
        noteKind: "warning",
        note: "确认手柄已锁紧，杯子已放稳。",
        feedback: "none",
        x: 44,
        y: 29.5,
      },
      {
        id: "coffee-steam",
        title: "制作奶泡",
        instruction: "需要奶泡时，向下转动红色蒸汽旋钮。",
        noteKind: "warning",
        note: "蒸汽管会变烫，请勿触摸金属部分。",
        feedback: "none",
        x: 58.7,
        y: 30.5,
      },
    ],
  },
  projector: {
    id: "projector",
    name: "投影仪",
    kind: "sample",
    image: `${ASSET_PREFIX}/devices/projector.png`,
    imageAlt: "一台白色投影仪，顶部有黄色和蓝色按键，前方有镜头",
    reference: "合成说明：接通电源后开机，调整镜头焦环，再选择输入源。",
    steps: [
      {
        id: "projector-power",
        title: "接通并开机",
        instruction: "按一下黄色电源键开机。",
        noteKind: "warning",
        note: "确认散热口没有被墙面或布料挡住。",
        feedback: "none",
        x: 22.4,
        y: 36.7,
      },
      {
        id: "projector-focus",
        title: "调清焦点",
        instruction: "缓慢转动镜头外圈，直到画面清晰。",
        noteKind: "tip",
        note: "先投出带文字的画面，更容易判断清晰度。",
        feedback: "none",
        x: 61.6,
        y: 60,
      },
      {
        id: "projector-source",
        title: "选择输入源",
        instruction: "按蓝色输入键，选择已连接的设备。",
        noteKind: "tip",
        note: "没有画面时，确认线缆两端都已插紧。",
        feedback: "none",
        x: 72.1,
        y: 41.2,
      },
    ],
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultWorkspace(): Workspace {
  return {
    version: 2,
    activeProjectId: "coffee",
    projects: {
      ...clone(SAMPLE_PROJECTS),
      custom: {
        id: "custom",
        name: "我的设备",
        kind: "custom",
        image: "",
        imageAlt: "用户上传的设备照片",
        reference: "",
        steps: [],
      },
    },
  };
}

/** Returns all reasons why a project cannot be published as a guide. */
export function validateProject(project: GuideProject): string[] {
  const errors: string[] = [];

  if (!project.image.trim()) {
    errors.push("请先上传设备图片。 ");
  }
  if (project.steps.length === 0) {
    errors.push("至少需要一个操作步骤。 ");
  }

  project.steps.forEach((step, index) => {
    const stepNumber = index + 1;
    if (!step.title.trim()) {
      errors.push(`步骤 ${stepNumber} 的标题不能为空。`);
    }
    if (!step.instruction.trim()) {
      errors.push(`步骤 ${stepNumber} 的动作说明不能为空。`);
    }
    if (step.noteKind !== "none" && !step.note.trim()) {
      errors.push(`步骤 ${stepNumber} 的提示或警告不能为空。`);
    }
    if (
      !Number.isFinite(step.x) ||
      !Number.isFinite(step.y) ||
      step.x < 0 ||
      step.x > 100 ||
      step.y < 0 ||
      step.y > 100
    ) {
      errors.push(`步骤 ${stepNumber} 的标点超出图片范围。`);
    }
  });

  return errors.map((error) => error.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStoredProject(
  value: unknown,
  version: 1 | 2,
): GuideProject | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.steps) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    (value.kind !== "sample" && value.kind !== "custom") ||
    typeof value.image !== "string" ||
    typeof value.imageAlt !== "string" ||
    typeof value.reference !== "string"
  ) {
    return null;
  }

  const steps: GuideStep[] = [];
  for (const [index, rawStep] of value.steps.entries()) {
    if (
      !isRecord(rawStep) ||
      typeof rawStep.id !== "string" ||
      typeof rawStep.instruction !== "string" ||
      typeof rawStep.x !== "number" ||
      typeof rawStep.y !== "number" ||
      !Number.isFinite(rawStep.x) ||
      !Number.isFinite(rawStep.y) ||
      rawStep.x < 0 ||
      rawStep.x > 100 ||
      rawStep.y < 0 ||
      rawStep.y > 100
    ) {
      return null;
    }

    if (
      version === 2 &&
      (typeof rawStep.title !== "string" ||
        (rawStep.noteKind !== "none" &&
          rawStep.noteKind !== "tip" &&
          rawStep.noteKind !== "warning") ||
        typeof rawStep.note !== "string" ||
        (rawStep.feedback !== "none" &&
          rawStep.feedback !== "issue" &&
          rawStep.feedback !== "resolved"))
    ) {
      return null;
    }

    const noteKind: NoteKind =
      rawStep.noteKind === "tip" || rawStep.noteKind === "warning"
        ? rawStep.noteKind
        : "none";
    const feedback: FeedbackState =
      rawStep.feedback === "issue" || rawStep.feedback === "resolved"
        ? rawStep.feedback
        : "none";

    steps.push({
      id: rawStep.id,
      title:
        typeof rawStep.title === "string" ? rawStep.title : `步骤 ${index + 1}`,
      instruction: rawStep.instruction,
      noteKind,
      note: typeof rawStep.note === "string" ? rawStep.note : "",
      feedback,
      x: rawStep.x,
      y: rawStep.y,
    });
  }

  return {
    id: value.id,
    name: value.name,
    kind: value.kind,
    image: value.image,
    imageAlt: value.imageAlt,
    reference: value.reference,
    steps,
  };
}

/**
 * Reads and validates the whole local snapshot. Version 1 snapshots are
 * migrated field-by-field; malformed data is ignored rather than partially
 * trusted.
 */
export function loadWorkspace(storage: StorageLike): LoadedWorkspace {
  const fallback = createDefaultWorkspace();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return { workspace: fallback, warning: "" };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      (parsed.version !== 1 && parsed.version !== 2) ||
      typeof parsed.activeProjectId !== "string" ||
      !isRecord(parsed.projects)
    ) {
      throw new Error("结构不正确");
    }

    const version = parsed.version;
    const projectEntries = Object.entries(parsed.projects);
    const migratedEntries = projectEntries.map(
      ([projectId, project]) =>
        [projectId, normalizeStoredProject(project, version)] as const,
    );

    if (
      projectEntries.length === 0 ||
      migratedEntries.some(
        ([projectId, project]) => project === null || project.id !== projectId,
      ) ||
      migratedEntries.some(
        ([, project]) =>
          project !== null &&
          new Set(project.steps.map((step) => step.id)).size !==
            project.steps.length,
      )
    ) {
      throw new Error("项目或标点数据无效");
    }

    const projects = {
      ...fallback.projects,
      ...Object.fromEntries(migratedEntries),
    } as Record<string, GuideProject>;

    if (!projects[parsed.activeProjectId]) {
      throw new Error("当前项目不存在");
    }

    return {
      workspace: {
        version: 2,
        activeProjectId: parsed.activeProjectId,
        projects,
      },
      warning: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return {
      workspace: fallback,
      warning: `已忽略无效的本地数据：${message}。`,
    };
  }
}

export function saveWorkspace(storage: StorageLike, workspace: Workspace): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

/** Restores one built-in sample without erasing custom work. */
export function resetSampleProject(
  workspace: Workspace,
  projectId: string,
): Workspace {
  const original = createDefaultWorkspace().projects[projectId];
  if (!original || original.kind !== "sample") {
    return workspace;
  }

  return {
    ...workspace,
    activeProjectId: projectId,
    projects: {
      ...workspace.projects,
      [projectId]: original,
    },
  };
}

export function clampPoint(point: Point): Point {
  return {
    x: Math.min(100, Math.max(0, point.x)),
    y: Math.min(100, Math.max(0, point.y)),
  };
}

/** Maps image-relative coordinates to a contained image inside the stage. */
export function imagePointToStage(
  point: Point,
  imageAspect: number,
  stageAspect = 4 / 3,
): Point {
  const safeImageAspect =
    Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : stageAspect;

  if (safeImageAspect > stageAspect) {
    const renderedHeight = (stageAspect / safeImageAspect) * 100;
    return {
      x: point.x,
      y: (100 - renderedHeight) / 2 + (point.y / 100) * renderedHeight,
    };
  }

  const renderedWidth = (safeImageAspect / stageAspect) * 100;
  return {
    x: (100 - renderedWidth) / 2 + (point.x / 100) * renderedWidth,
    y: point.y,
  };
}

/**
 * Maps a stage click back to image-relative coordinates. Clicks in the
 * letterbox area return null, so they can never create out-of-image markers.
 */
export function stagePointToImage(
  point: Point,
  imageAspect: number,
  stageAspect = 4 / 3,
): Point | null {
  const safeImageAspect =
    Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : stageAspect;

  if (safeImageAspect > stageAspect) {
    const renderedHeight = (stageAspect / safeImageAspect) * 100;
    const offsetY = (100 - renderedHeight) / 2;
    if (point.y < offsetY || point.y > offsetY + renderedHeight) {
      return null;
    }
    return {
      x: point.x,
      y: ((point.y - offsetY) / renderedHeight) * 100,
    };
  }

  const renderedWidth = (safeImageAspect / stageAspect) * 100;
  const offsetX = (100 - renderedWidth) / 2;
  if (point.x < offsetX || point.x > offsetX + renderedWidth) {
    return null;
  }
  return {
    x: ((point.x - offsetX) / renderedWidth) * 100,
    y: point.y,
  };
}

export function guidePath(
  projectId: string,
  basePath = ASSET_PREFIX,
): string {
  return `${normalizeBasePath(basePath)}/guide/${encodeURIComponent(projectId)}`;
}

export function guideUrl(
  origin: string,
  projectId: string,
  basePath = ASSET_PREFIX,
): string {
  return `${origin.replace(/\/$/, "")}${guidePath(projectId, basePath)}`;
}

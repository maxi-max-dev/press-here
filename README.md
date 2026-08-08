# 按这里 / PRESS HERE

把真实设备照片变成“一步一屏”的操作指南：作者在照片上标出控件、写下动作，生成二维码分享卡；读者按步骤操作并反馈有问题的步骤，作者修正后可标记“已解决”。

本目录是独立验收后的增强发布版。历史冻结证据为 `frozen-accepted-98`（`f0a3f84e`）；当前版本以其直系后继 `9325ba8e` 为内容基线，保留冻结 tag 不动，并修复生产路由、Pages basePath、类型门禁和已知可修依赖问题。

## 能做什么

- 咖啡机、投影仪两个内置样例，可点击照片标点查看步骤。
- 编辑标题、动作、提示/警告，移动、排序、新增或删除标点并保存。
- 生成真实二维码与 `/guide/:id` 移动指南。
- 读者提交“这一步不对”，作者修正并标记已解决。
- “我的设备”上传本地图片，手动标点并保存到当前浏览器。

## 诚实边界

- 内置样例是预先制作的数据，不是实时 AI 解析。
- 自定义图片不会上传，也不会自动识别。
- 自定义图片、步骤与反馈只保存在当前浏览器 `localStorage`。
- 因此，自定义二维码在另一台设备上不会携带作者数据；反馈闭环也只在同一浏览器环境内演示。
- 这是可交互原型，不是带账号、云同步或多人协作的生产系统。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

打开终端打印的本地地址。生产形态使用：

```bash
npm run build
PORT=3000 npm run start
```

主要路由：

- `/`：作者端、样例与分享卡。
- `/guide/coffee`：咖啡机移动指南。
- `/guide/projector`：投影仪移动指南。
- `/guide/:id`：任意自定义指南 id；无本地数据时显示明确空状态。
- `/guide/coffee-machine`：旧公开地址的兼容入口，展示当前 `coffee` 样例。

## 质量门禁

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:pages
```

2026-08-09 发布回归覆盖 fresh install、6 个测试文件 / 30 个用例、普通生产构建、GitHub Pages 静态构建、公开链接、桌面与 390px 主流程、console、刷新与横向溢出。

## 部署选择

公开体验地址：<https://maxi-max-dev.github.io/press-here/>。

- `npm run build` 生成 vinext Worker/Node 版本，保留任意动态 `/guide/:id`。
- `npm run build:pages` 生成 GitHub Pages 版本，basePath 为 `/press-here`，静态提供 `coffee`、`projector`、`custom` 与旧 `coffee-machine` 兼容路由。
- Pages 的 `/guide/custom` 只读取当前浏览器本地数据；它不是跨设备分享能力。

## 与“就这么按”的策略边界

两者都处在设备操作与“一步一屏”问题域，名称和问题叙事仍有明显重合。本项目的工程区别是作者在设备照片上手动标点、发布现场指南，并演示读者报错与作者修正；它不做自然语言目标理解、设备状态模拟、观察分支或个人偏好。

本次只完成工程固化与公开部署，不代表适合把它作为“就这么按”之外的同赛独立作品报名；没有报名或发帖。

构建和回退说明见 `DEPLOY-NOTES.md`。

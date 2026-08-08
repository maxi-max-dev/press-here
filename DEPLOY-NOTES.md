# 部署交接 · 按这里 / PRESS HERE

公开地址：<https://maxi-max-dev.github.io/press-here/>

范围：只完成工程与公开部署；不报名、不发帖。

## 1. 选择托管形态

项目保留两种构建：

- `npm run build`：vinext Worker/Node，支持任意动态 `/guide/:id`。
- `npm run build:pages`：GitHub Pages 静态导出，basePath 固定为 `/press-here`。

Pages 明确预生成 `/guide/coffee`、`/guide/projector`、`/guide/custom`，并保留 `/guide/coffee-machine` 兼容入口。任意其他 id 仍需要 Worker/Node；静态站点不宣称支持无限动态路由。

## 2. 部署前门禁

在最终源代码目录运行：

```bash
node --version
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run build:pages
```

要求：Node.js `>=22.13.0`；所有命令退出码为 0。lint 当前有 3 条有意保留的 `<img>` 性能提示，因为标点坐标依赖原始图片几何与用户本地 data URL；不得把 warning 误写成 error。

## 3. 运行配置

- 无必填环境变量。
- 无数据库、对象存储或外部 API。
- `.openai/hosting.json` 的 `d1`、`r2` 均为 `null`；当前没有 `project_id`。
- `PORT` 可选；生产启动示例：

```bash
PORT=3000 npm run start
```

反向代理应传递正确的 `Host`/`X-Forwarded-Host` 与 `X-Forwarded-Proto`，用于生成 favicon 与 Open Graph 的绝对 URL。

## 4. 操作者的部署后验收

拿到候选 URL 后逐项人工确认：

1. 首页、`/favicon.svg`、`/og.png` 均为 200。
2. `/guide/coffee` 与 `/guide/projector` 均为 200。
3. `/guide/custom` 为 200；没有本地自定义数据时显示明确不可用状态。
4. `/guide/coffee-machine` 为 200，并显示当前咖啡机指南。
5. 首页二维码编码 `https://maxi-max-dev.github.io/press-here/guide/...`，不得遗漏 `/press-here`。
6. 桌面打开咖啡机，点 1/2/3；编辑并保存后刷新仍在。
7. 390px 视口走完 3 步，看到“操作完成”。
8. 同一浏览器内提交“这一步不对”，作者端修正并标记已解决，读者端刷新后看到新文案与“已解决”。
9. “我的设备”上传一张无敏感信息的图片、手动标一点、保存并打开 `/guide/custom`。
10. DevTools console 无 warning/error，页面 `scrollWidth === clientWidth`。
11. 用社交卡调试器检查标题、描述与 `og.png`。

## 5. 必须向评委披露

- 自定义数据和反馈只存在当前浏览器；跨设备扫码不会同步作者刚创建的自定义指南。
- 内置样例不是实时 AI；自定义照片也不会自动识别。
- 当前是可交互原型，不是生产协作系统。
- 与“就这么按”仍有设备操作、一步一屏和命名叙事重合；本次部署不等于额外报名决策。

## 6. 版本与回退

- 历史冻结：`frozen-accepted-98` → `f0a3f84e`。
- 权威内容基线：`9325ba8e`；发布 HEAD 以 GitHub `main` 与交付 SHA-256 manifest 为准。
- `gh-pages` 只保存同一 HEAD 生成的 `out/` 静态产物，不是源码权威。
- 回退必须用普通 revert 或快进修复，禁止 force push。

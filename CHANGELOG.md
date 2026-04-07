# ajax-hooker

## 1.3.1 (2026-04-07)

### 🇺🇸 English

- fix: Support XHR instance method overrides ([fb8c174](https://github.com/Arktomson/ajaxInterceptor/commit/fb8c174)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- fix: 兼容XHR实例方法重写 ([fb8c174](https://github.com/Arktomson/ajaxInterceptor/commit/fb8c174)) [@arktomson](https://github.com/arktomson)

## 1.3.0 (2026-03-28)

### 🇺🇸 English

- feat: Support response.mockError for fetch error simulation ([24ee3df](https://github.com/Arktomson/ajaxInterceptor/commit/24ee3df)) [@胜簪](https://github.com/胜簪)
- fix: Handle UNSENT state before send ([7fa61a1](https://github.com/Arktomson/ajaxInterceptor/commit/7fa61a1)) [@胜簪](https://github.com/胜簪)

### 🇨🇳 简体中文

- feat: 支持 response.mockError 模拟报错 ([24ee3df](https://github.com/Arktomson/ajaxInterceptor/commit/24ee3df)) [@胜簪](https://github.com/胜簪)
- fix: 处理 send 前 UNSENT 状态 ([7fa61a1](https://github.com/Arktomson/ajaxInterceptor/commit/7fa61a1)) [@胜簪](https://github.com/胜簪)

## 1.2.7 (2026-03-24)

### 🇺🇸 English

- fix: Simplify XHR constructor constant typing ([7efe920](https://github.com/Arktomson/ajaxInterceptor/commit/7efe920)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- fix: 简化XHR构造常量类型声明 ([7efe920](https://github.com/Arktomson/ajaxInterceptor/commit/7efe920)) [@arktomson](https://github.com/arktomson)

## 1.2.6 (2026-03-23)

### 🇺🇸 English

- fix: Skip modification if readyState is not OPENED ([913c2fc](https://github.com/Arktomson/ajaxInterceptor/commit/913c2fc)) [@arktomson](https://github.com/arktomson)
- fix: Use resolveUrl to determine if url changed for string requests ([bce542f](https://github.com/Arktomson/ajaxInterceptor/commit/bce542f)) [@arktomson](https://github.com/arktomson)
- fix: Update resolveUrl to use window.location.href ([87e90d6](https://github.com/Arktomson/ajaxInterceptor/commit/87e90d6)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- fix: 当 readyState 不是 OPENED 时跳过修改 ([913c2fc](https://github.com/Arktomson/ajaxInterceptor/commit/913c2fc)) [@arktomson](https://github.com/arktomson)
- fix: 修复字符串请求下的 URL 变化检测 ([bce542f](https://github.com/Arktomson/ajaxInterceptor/commit/bce542f)) [@arktomson](https://github.com/arktomson)
- fix: 修复 resolveUrl 基础路径 ([87e90d6](https://github.com/Arktomson/ajaxInterceptor/commit/87e90d6)) [@arktomson](https://github.com/arktomson)

## 1.2.5 (2026-03-17)

### 🇺🇸 English

- feat: Export constants and comment out request modification logic in the demo ([67c5828](https://github.com/Arktomson/ajaxInterceptor/commit/67c5828)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- feat: 常量导出 ([67c5828](https://github.com/Arktomson/ajaxInterceptor/commit/67c5828)) [@arktomson](https://github.com/arktomson)

## 1.2.4 (2026-03-14)

### 🇺🇸 English

- docs: Update npm daily downloads badge ([464e0d4](https://github.com/Arktomson/ajaxInterceptor/commit/464e0d4)) [@胜簪](https://github.com/胜簪)

### 🇨🇳 简体中文

- docs: 更新 npm 每日下载量徽章 ([464e0d4](https://github.com/Arktomson/ajaxInterceptor/commit/464e0d4)) [@胜簪](https://github.com/胜簪)

## 1.2.3 (2026-03-09)

### 🇺🇸 English

- fix: Skip WASM request interception ([0da9dd8](https://github.com/Arktomson/ajaxInterceptor/commit/0da9dd8)) [@胜簪](https://github.com/胜簪)

### 🇨🇳 简体中文

- fix: 跳过WASM请求拦截 ([0da9dd8](https://github.com/Arktomson/ajaxInterceptor/commit/0da9dd8)) [@胜簪](https://github.com/胜簪)

## 1.2.2 (2026-02-28)

### 🇺🇸 English

- fix: Fix XHR response field handling and listener removal semantics ([5d9f261](https://github.com/Arktomson/ajaxInterceptor/commit/5d9f261)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- fix: 修复XHR响应字段与事件移除语义 ([5d9f261](https://github.com/Arktomson/ajaxInterceptor/commit/5d9f261)) [@arktomson](https://github.com/arktomson)

## 1.2.1 (2026-02-27)

### 🇺🇸 English

- feat: Refine build/docs and bridge global export ([23bff35](https://github.com/Arktomson/ajaxInterceptor/commit/23bff35)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- feat: 优化构建产物与文档并桥接全局导出 ([23bff35](https://github.com/Arktomson/ajaxInterceptor/commit/23bff35)) [@arktomson](https://github.com/arktomson)

## 1.2.0 (2026-02-27)

### 🇺🇸 English

- feat: Refine build outputs and deprecate internal fields ([08b172c](https://github.com/Arktomson/ajaxInterceptor/commit/08b172c)) [@胜簪](https://github.com/胜簪)

### 🇨🇳 简体中文

- feat: 优化构建产物并标记内部字段废弃 ([08b172c](https://github.com/Arktomson/ajaxInterceptor/commit/08b172c)) [@胜簪](https://github.com/胜簪)

## 1.1.1 (2026-02-26)

### 🇺🇸 English

- feat: Refactor release pipeline to automate bilingual changelogs without changesets ([e8cb192](https://github.com/Arktomson/ajaxInterceptor/commit/e8cb192)) [@arktomson](https://github.com/arktomson)
- feat: 增强 fetch 拦截器，通过跟踪请求属性来源更精确地解析和重构请求。 ([7c58112](https://github.com/Arktomson/ajaxInterceptor/commit/7c58112)) [@arktomson](https://github.com/arktomson)
- chore: 修复 release workflow CHANGELOG 提取逻辑 & 优化 commit 列表格式 ([f91be01](https://github.com/Arktomson/ajaxInterceptor/commit/f91be01)) [@arktomson](https://github.com/arktomson)

### 🇨🇳 简体中文

- feat: 重构发版流水线 ([e8cb192](https://github.com/Arktomson/ajaxInterceptor/commit/e8cb192)) [@arktomson](https://github.com/arktomson)
- feat: 增强 fetch 拦截器，通过跟踪请求属性来源更精确地解析和重构请求。 ([7c58112](https://github.com/Arktomson/ajaxInterceptor/commit/7c58112)) [@arktomson](https://github.com/arktomson)
- chore: 修复 release workflow CHANGELOG 提取逻辑 & 优化 commit 列表格式 ([f91be01](https://github.com/Arktomson/ajaxInterceptor/commit/f91be01)) [@arktomson](https://github.com/arktomson)

## 1.1.0

### Minor Changes

- [`56f5bb3`](https://github.com/Arktomson/ajaxInterceptor/commit/56f5bb32bb5165c1d3f46e92d7d74d90a324ab5e) Thanks [@Arktomson](https://github.com/Arktomson)! - **新功能**

  - 新增流式响应拦截支持，通过 `onStreamChunk` 钩子可逐块拦截和修改流式数据
  - 自动检测流式响应类型（`text/event-stream`、`application/x-ndjson`、`application/stream+json` 等）
  - 新增 `StreamChunk` 类型，包含 `text`、`raw`、`index`、`timestamp` 字段
  - 请求对象新增 XHR 专属属性支持：`responseType`、`withCredentials`、`timeout`
  - `inject(type?)` 和 `uninject(type?)` 支持按类型单独注入/移除

  **重构**

  - 将单文件架构拆分为独立模块：`xhr.ts`、`fetch.ts`、`sse.ts`、`interceptor.ts`、`common.ts`
  - 测试拆分为 `xhr.test.ts` 和 `fetch.test.ts`

  **文档**

  - 完善中英文 README，补充所有属性的读写说明
  - 新增流式响应自动检测、StreamChunk、XHR 属性修改等文档章节

  **工程化**

  - 集成 Changesets 版本管理和 CHANGELOG 自动生成
  - 新增 CI 测试 workflow（push/PR 自动跑测试）
  - 新增发布 workflow（测试 → 版本更新 → 构建 → npm 发布 → GitHub Release）

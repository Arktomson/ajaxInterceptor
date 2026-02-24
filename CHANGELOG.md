# ajax-hooker

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

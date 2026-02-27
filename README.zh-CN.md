# ajax-hooker

[English](./README.md) | 中文

`ajax-hooker` 是一个浏览器端 AJAX 拦截库。它会对原生 `XMLHttpRequest` 和 `fetch` 做深度劫持,并把两者抹平为统一的 Hook 生命周期,让拦截逻辑写一次即可复用。

## 项目亮点

- 深度 AJAX 劫持: 直接拦截 XHR 与 Fetch 的关键阶段,而不是只包裹业务层请求函数。
- 统一请求生命周期: 抹平 XHR/Fetch 差异,聚合为两个核心阶段: 请求前(请求参数改写)与请求后(响应处理)。
- 流式能力完整: 支持对流式响应进行逐块拦截和改写。

## 特性

- 同时支持 `XMLHttpRequest` 和 `fetch`
- 可拦截和修改请求参数(`url`、`method`、`headers`、`data`)
- 通过统一回调模型捕获响应数据
- 支持流式响应拦截(SSE、NDJSON、streaming JSON 等)
- 支持多个钩子函数链式执行
- 单例模式,确保全局唯一实例
- 完整的 TypeScript 类型支持

## 安装

```bash
npm install ajax-hooker
```

## 快速开始

```typescript
import AjaxInterceptor from 'ajax-hooker';

// 获取拦截器实例
const interceptor = AjaxInterceptor.getInstance();

// 注入拦截器
interceptor.inject();

// 添加钩子函数
interceptor.hook((request) => {
  // 修改请求
  request.headers.set('Authorization', 'Bearer token');

  // 捕获响应
  request.response = async (response) => {
    console.log('响应状态:', response.status);
    console.log('响应数据:', response.json);
  };

  return request;
});
```

## API 变动示例 (v1.1+)

### 统一的请求前/请求后生命周期

```typescript
interceptor.hook((request) => {
  // 请求前: 改写请求参数
  request.url = request.url.replace('/api/v1', '/api/v2');
  request.headers.set('x-trace-id', crypto.randomUUID());

  // 请求后: XHR + Fetch 统一响应回调
  request.response = async (response) => {
    console.log('status:', response.status);
  };

  return request;
});
```

### 按请求类型精细控制

```typescript
// 只注入 Fetch 拦截
interceptor.inject('fetch');

// 只拦截 Fetch 请求
interceptor.hook((request) => {
  request.headers.set('x-from', 'fetch-only');
  return request;
}, 'fetch');

// 只移除 Fetch 拦截
interceptor.uninject('fetch');
```

### 使用 `unhook` 移除钩子

```typescript
const authHook = (request) => {
  request.headers.set('Authorization', 'Bearer token');
  return request;
};

interceptor.hook(authHook);

// 移除指定钩子
interceptor.unhook(authHook);

// 仅清空 xhr 的全部钩子
interceptor.unhook(undefined, 'xhr');

// 清空 xhr + fetch 的全部钩子
interceptor.unhook();
```

### 废弃兼容字段 (1.x)

`interceptor.xhrInterceptor` 和 `interceptor.fetchInterceptor` 在 1.x 中仍保留用于向后兼容,但已标记为废弃,并计划在 2.x 改为私有。

建议使用公开 API:

- `interceptor.hook(...)`
- `interceptor.unhook(...)`
- `interceptor.inject(...)`
- `interceptor.uninject(...)`

## API

### AjaxInterceptor.getInstance()

获取拦截器单例实例。

```typescript
const interceptor = AjaxInterceptor.getInstance();
```

### inject(type?)

注入拦截器,开始拦截请求。

**参数:**
- `type`: 可选,指定注入类型 `'xhr'` 或 `'fetch'`,不指定则同时注入两者

```typescript
// 注入所有
interceptor.inject();

// 只注入 XHR
interceptor.inject('xhr');

// 只注入 Fetch
interceptor.inject('fetch');
```

### uninject(type?)

移除拦截器,恢复原始的 XMLHttpRequest 和 Fetch。

**参数:**
- `type`: 可选,指定移除类型 `'xhr'` 或 `'fetch'`,不指定则同时移除两者

```typescript
// 移除所有
interceptor.uninject();

// 只移除 XHR
interceptor.uninject('xhr');
```

### hook(fn, type?)

添加钩子函数。

**参数:**
- `fn`: 钩子函数,接收请求对象,返回修改后的请求对象(也可以不返回,此时保持原请求不变)
- `type`: 可选,指定拦截类型 `'xhr'` 或 `'fetch'`,不指定则同时拦截两者

```typescript
// 拦截所有请求
interceptor.hook((request) => {
  console.log('请求:', request.url);
  return request;
});

// 只拦截 XHR 请求
interceptor.hook((request) => {
  console.log('XHR 请求:', request.url);
  return request;
}, 'xhr');

// 只拦截 Fetch 请求
interceptor.hook((request) => {
  console.log('Fetch 请求:', request.url);
  return request;
}, 'fetch');
```

### unhook(fn?, type?)

移除单个钩子或清空钩子。

**参数:**
- `fn`: 可选。传入时移除该钩子; 不传则清空所有钩子。
- `type`: 可选。指定 `'xhr'` 或 `'fetch'` 只清理对应类型; 不传则两者都处理。

```typescript
const loggerHook = (request) => {
  console.log(request.url);
  return request;
};

interceptor.hook(loggerHook);

// 移除一个钩子
interceptor.unhook(loggerHook);

// 清空所有 fetch 钩子
interceptor.unhook(undefined, 'fetch');

// 清空全部钩子
interceptor.unhook();
```

## 请求对象 (AjaxInterceptorRequest)

钩子函数接收的请求对象包含以下属性:

| 属性 | 类型 | 读写 | 说明 |
|------|------|------|------|
| `type` | `'xhr' \| 'fetch'` | 只读 | 请求类型,标识当前请求来源 |
| `method` | `string` | **可修改** | 请求方法 (GET, POST 等) |
| `url` | `string` | **可修改** | 请求 URL |
| `headers` | `Headers` | **可修改** | 请求头,标准 [Headers](https://developer.mozilla.org/zh-CN/docs/Web/API/Headers) 对象 |
| `data` | `any` | **可修改** | 请求体 |
| `response` | `(response: AjaxResponse) => void \| Promise<void>` | **可修改** | 响应回调函数,设置后会在收到响应时被调用 |
| `onStreamChunk` | `(chunk: StreamChunk) => string \| void \| Promise<string \| void>` | **可修改** | 流式响应钩子(可选),用于拦截流式响应的每个数据块 |
| `responseType` | `XMLHttpRequestResponseType` | **可修改** | XHR 专属,对应 `xhr.responseType` |
| `withCredentials` | `boolean` | **可修改** | XHR 专属,对应 `xhr.withCredentials` |
| `timeout` | `number` | **可修改** | XHR 专属,对应 `xhr.timeout` |

```typescript
interface AjaxInterceptorRequest {
  type: 'xhr' | 'fetch';
  method: string;
  url: string;
  headers: Headers;
  data: any;
  response: (response: AjaxResponse) => void | Promise<void>;
  onStreamChunk?: (chunk: StreamChunk) => string | void | Promise<string | void>;
  // XHR 专属属性
  responseType?: XMLHttpRequestResponseType;
  withCredentials?: boolean;
  timeout?: number;
}
```

## 响应对象 (AjaxResponse)

响应回调中接收的响应对象包含以下属性:

| 属性 | 类型 | 读写 | 说明 |
|------|------|------|------|
| `status` | `number` | **可修改** | HTTP 状态码 |
| `statusText` | `string` | **可修改** | HTTP 状态文本 |
| `headers` | `Headers` | 只读 | 响应头 |
| `finalUrl` | `string` | 只读 | 最终 URL(经过重定向后的实际 URL) |
| `response` | `any` | **可修改** | XHR 专属,对应 `xhr.response` |
| `responseText` | `string` | **可修改** | XHR 专属,对应 `xhr.responseText` |
| `responseXML` | `Document \| null` | **可修改** | XHR 专属,对应 `xhr.responseXML` |
| `ok` | `boolean` | 只读 | Fetch 专属,请求是否成功 (status 200-299) |
| `redirected` | `boolean` | 只读 | Fetch 专属,是否经历了重定向 |
| `json` | `any` | 只读 | Fetch 专属,解析后的 JSON 数据 |
| `text` | `string` | 只读 | Fetch 专属,响应文本 |
| `arrayBuffer` | `ArrayBuffer` | 只读 | Fetch 专属,响应 ArrayBuffer |
| `blob` | `Blob` | 只读 | Fetch 专属,响应 Blob |
| `formData` | `FormData` | 只读 | Fetch 专属,响应 FormData |

> **说明:** Fetch 响应中的 `json`、`text`、`arrayBuffer`、`blob`、`formData` 已经由拦截器自动解析完毕,直接作为属性访问即可,无需再调用 `.json()` 等方法。如果解析失败,对应属性值为 `null`。

```typescript
interface AjaxResponse {
  // 通用属性
  status: number;          // 可修改
  statusText: string;      // 可修改
  headers: Headers;        // 只读
  finalUrl: string;

  // XHR 专属(可修改)
  response?: any;
  responseText?: string;
  responseXML?: Document | null;

  // Fetch 专属(只读,已自动解析)
  ok?: boolean;
  redirected?: boolean;
  json?: any;
  text?: string;
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  formData?: FormData;
}
```

## 流式数据块 (StreamChunk)

`onStreamChunk` 钩子接收的数据块对象:

| 属性 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 解码后的文本内容 |
| `raw` | `Uint8Array` | 原始字节数据 |
| `index` | `number` | 数据块索引(从 0 开始) |
| `timestamp` | `number` | 接收时间戳 |

```typescript
interface StreamChunk {
  text: string;
  raw: Uint8Array;
  index: number;
  timestamp: number;
}
```

## 流式响应自动检测

拦截器会根据响应的 `Content-Type` 头自动判断是否为流式响应。以下类型会被识别为流式响应:

- `text/event-stream` (SSE)
- `application/stream+json`
- `application/x-ndjson`
- `application/jsonl`
- `application/json-seq`

当检测到流式响应时:
1. `response` 回调会立即被调用(此时仅包含 `status`、`statusText`、`ok`、`headers`、`finalUrl`、`redirected`,不含 body 数据)
2. 流式数据通过 `onStreamChunk` 钩子逐块传递
3. `onStreamChunk` 返回 `string` 可修改数据块内容,返回 `void` 或不返回则保持原内容

## 使用示例

### 修改请求 URL

```typescript
interceptor.hook((request) => {
  if (request.url.includes('/api/v1/')) {
    request.url = request.url.replace('/api/v1/', '/api/v2/');
  }
  return request;
});
```

### 添加认证 Token

```typescript
interceptor.hook((request) => {
  request.headers.set('Authorization', `Bearer ${getToken()}`);
  return request;
});
```

### 捕获响应数据

```typescript
interceptor.hook((request) => {
  request.response = async (response) => {
    console.log('状态码:', response.status);
    // XHR 使用 response.response,Fetch 使用 response.json
    console.log('响应数据:', response.json || response.response);
  };
  return request;
});
```

### 修改 XHR 属性

```typescript
interceptor.hook((request) => {
  // 修改响应类型
  request.responseType = 'json';
  // 修改超时时间
  request.timeout = 5000;
  // 携带凭据
  request.withCredentials = true;
  return request;
}, 'xhr');
```

### 拦截流式响应

```typescript
interceptor.hook((request) => {
  // 响应头信息会在流开始时立即可用
  request.response = async (response) => {
    console.log('流式响应开始, 状态:', response.status);
  };

  // 拦截流式响应的每个数据块
  request.onStreamChunk = async (chunk) => {
    console.log('收到数据块:', chunk.text);
    console.log('原始数据:', chunk.raw);
    console.log('数据块索引:', chunk.index);
    console.log('时间戳:', chunk.timestamp);

    // 返回修改后的文本,替换数据块内容
    return chunk.text.replace('old', 'new');

    // 不返回值或返回 void,则保持原内容不变
  };

  return request;
});
```

### 多个钩子链式执行

```typescript
// 第一个钩子:添加 token
interceptor.hook((request) => {
  request.headers.set('Authorization', 'Bearer token');
  return request;
});

// 第二个钩子:添加时间戳
interceptor.hook((request) => {
  request.headers.set('X-Timestamp', Date.now().toString());
  return request;
});

// 第三个钩子:记录日志(不返回值,保持原请求不变)
interceptor.hook((request) => {
  console.log(`${request.method} ${request.url}`);
});
```

## 开发

### 构建产物

- ESM: `dist/esm/index.js`
- CJS: `dist/cjs/index.js`
- IIFE(浏览器全局): `dist/iife/index.js`
- 共享类型声明: `dist/types/*.d.ts`
- UMD: 默认不产出(如需兼容老式加载器可后续追加)

> 类型声明只生成一份到 `dist/types`,由 ESM/CJS 共同复用。

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 仅构建 JS
pnpm build:js

# 仅构建类型(统一输出到 dist/types)
pnpm build:types

# 测试
pnpm test

# 测试覆盖率
pnpm test:coverage
```

## License

MIT

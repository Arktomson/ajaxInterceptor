# ajax-hooker

一个轻量级的 AJAX 请求拦截器,支持拦截和修改 XMLHttpRequest 和 Fetch 请求。

## 特性

- 🎯 同时支持 XMLHttpRequest 和 Fetch API
- 🔄 可拦截和修改请求参数(URL、Method、Headers、Body)
- 📦 可捕获响应数据
- 🌊 支持流式响应拦截(SSE、流式 JSON 等)
- 🪝 支持多个钩子函数链式执行
- 🔒 单例模式,确保全局唯一实例
- 📝 完整的 TypeScript 类型支持

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

## API

### AjaxInterceptor.getInstance()

获取拦截器单例实例。

```typescript
const interceptor = AjaxInterceptor.getInstance();
```

### inject()

注入拦截器,开始拦截请求。

```typescript
interceptor.inject();
```

### uninject()

移除拦截器,恢复原始的 XMLHttpRequest 和 Fetch。

```typescript
interceptor.uninject();
```

### hook(fn, type?)

添加钩子函数。

**参数:**
- `fn`: 钩子函数,接收请求对象并返回修改后的请求对象
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

## 请求对象结构

钩子函数接收的请求对象包含以下属性:

```typescript
interface AjaxInterceptorRequest {
  type: 'xhr' | 'fetch';           // 请求类型
  method: string;                   // 请求方法
  url: string;                      // 请求 URL
  headers: Headers;                 // 请求头
  data: any;                        // 请求体
  response: (response: AjaxResponse) => void | Promise<void>;  // 响应回调
  onStreamChunk?: (chunk: StreamChunk) => string | void | Promise<string | void>;  // 流式响应钩子
}
```

## 响应对象结构

```typescript
interface AjaxResponse {
  status: number;                   // 状态码
  statusText: string;               // 状态文本
  headers: Headers;                 // 响应头
  finalUrl: string;                 // 最终 URL

  // XHR 响应
  response?: any;

  // Fetch 响应
  ok?: boolean;
  redirected?: boolean;
  json?: any;
  text?: string;
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  formData?: FormData;
}
```

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
    console.log('响应数据:', response.json || response.response);
  };
  return request;
});
```

### 拦截流式响应

```typescript
interceptor.hook((request) => {
  // 拦截流式响应的每个数据块
  request.onStreamChunk = async (chunk) => {
    console.log('收到数据块:', chunk.text);
    console.log('数据块索引:', chunk.index);

    // 可以修改数据块内容
    return chunk.text.replace('old', 'new');
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

// 第三个钩子:记录日志
interceptor.hook((request) => {
  console.log(`${request.method} ${request.url}`);
  return request;
});
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm start

# 构建
npm run build

# 测试
npm test

# 测试覆盖率
npm run test:coverage
```

## License

MIT
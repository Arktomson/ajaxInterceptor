# ajax-hooker

English | [中文](./README.zh-CN.md)

A lightweight AJAX request interceptor that supports intercepting and modifying both XMLHttpRequest and Fetch requests.

## Features

- Works with both XMLHttpRequest and Fetch API
- Intercepts and modifies request parameters (URL, Method, Headers, Body)
- Captures response data
- Supports streaming response interception (SSE, NDJSON, streaming JSON, etc.)
- Chain multiple hook functions
- Singleton pattern ensures a single global instance
- Full TypeScript type support

## Installation

```bash
npm install ajax-hooker
```

## Quick Start

```typescript
import AjaxInterceptor from 'ajax-hooker';

// Get the interceptor instance
const interceptor = AjaxInterceptor.getInstance();

// Inject the interceptor
interceptor.inject();

// Add a hook
interceptor.hook((request) => {
  // Modify the request
  request.headers.set('Authorization', 'Bearer token');

  // Capture the response
  request.response = async (response) => {
    console.log('Status:', response.status);
    console.log('Data:', response.json);
  };

  return request;
});
```

## API

### AjaxInterceptor.getInstance()

Get the singleton interceptor instance.

```typescript
const interceptor = AjaxInterceptor.getInstance();
```

### inject(type?)

Inject the interceptor and start intercepting requests.

**Parameters:**
- `type`: Optional. Specify `'xhr'` or `'fetch'` to inject only one type. If omitted, both are injected.

```typescript
// Inject all
interceptor.inject();

// Only XHR
interceptor.inject('xhr');

// Only Fetch
interceptor.inject('fetch');
```

### uninject(type?)

Remove the interceptor and restore native XMLHttpRequest and Fetch.

**Parameters:**
- `type`: Optional. Specify `'xhr'` or `'fetch'` to remove only one type. If omitted, both are removed.

```typescript
// Remove all
interceptor.uninject();

// Only remove XHR
interceptor.uninject('xhr');
```

### hook(fn, type?)

Add a hook function.

**Parameters:**
- `fn`: Hook function that receives a request object and returns the modified request (can also return nothing, in which case the original request is kept unchanged)
- `type`: Optional. Specify `'xhr'` or `'fetch'` to intercept only one type. If omitted, both are intercepted.

```typescript
// Intercept all requests
interceptor.hook((request) => {
  console.log('Request:', request.url);
  return request;
});

// Only XHR
interceptor.hook((request) => {
  console.log('XHR:', request.url);
  return request;
}, 'xhr');

// Only Fetch
interceptor.hook((request) => {
  console.log('Fetch:', request.url);
  return request;
}, 'fetch');
```

## Request Object (AjaxInterceptorRequest)

The request object received by hook functions contains the following properties:

| Property | Type | Access | Description |
|----------|------|--------|-------------|
| `type` | `'xhr' \| 'fetch'` | Read-only | Request type, identifies the request source |
| `method` | `string` | **Writable** | HTTP method (GET, POST, etc.) |
| `url` | `string` | **Writable** | Request URL |
| `headers` | `Headers` | **Writable** | Request headers, standard [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object |
| `data` | `any` | **Writable** | Request body |
| `response` | `(response: AjaxResponse) => void \| Promise<void>` | **Writable** | Response callback, invoked when the response is received |
| `onStreamChunk` | `(chunk: StreamChunk) => string \| void \| Promise<string \| void>` | **Writable** | Streaming response hook (optional), used to intercept each chunk of a streaming response |
| `responseType` | `XMLHttpRequestResponseType` | **Writable** | XHR only. Corresponds to `xhr.responseType` |
| `withCredentials` | `boolean` | **Writable** | XHR only. Corresponds to `xhr.withCredentials` |
| `timeout` | `number` | **Writable** | XHR only. Corresponds to `xhr.timeout` |

```typescript
interface AjaxInterceptorRequest {
  type: 'xhr' | 'fetch';
  method: string;
  url: string;
  headers: Headers;
  data: any;
  response: (response: AjaxResponse) => void | Promise<void>;
  onStreamChunk?: (chunk: StreamChunk) => string | void | Promise<string | void>;
  // XHR-specific properties
  responseType?: XMLHttpRequestResponseType;
  withCredentials?: boolean;
  timeout?: number;
}
```

## Response Object (AjaxResponse)

The response object received by the response callback contains the following properties:

| Property | Type | Access | Description |
|----------|------|--------|-------------|
| `status` | `number` | **Writable** | HTTP status code |
| `statusText` | `string` | **Writable** | HTTP status text |
| `headers` | `Headers` | Read-only | Response headers |
| `finalUrl` | `string` | Read-only | Final URL (after redirects) |
| `response` | `any` | **Writable** | XHR only. Corresponds to `xhr.response` |
| `responseText` | `string` | **Writable** | XHR only. Corresponds to `xhr.responseText` |
| `responseXML` | `Document \| null` | **Writable** | XHR only. Corresponds to `xhr.responseXML` |
| `ok` | `boolean` | Read-only | Fetch only. Whether the request was successful (status 200-299) |
| `redirected` | `boolean` | Read-only | Fetch only. Whether the request was redirected |
| `json` | `any` | Read-only | Fetch only. Parsed JSON data |
| `text` | `string` | Read-only | Fetch only. Response text |
| `arrayBuffer` | `ArrayBuffer` | Read-only | Fetch only. Response ArrayBuffer |
| `blob` | `Blob` | Read-only | Fetch only. Response Blob |
| `formData` | `FormData` | Read-only | Fetch only. Response FormData |

> **Note:** For Fetch responses, `json`, `text`, `arrayBuffer`, `blob`, and `formData` are automatically parsed by the interceptor and available as properties. No need to call `.json()` or similar methods. If parsing fails, the corresponding property is `null`.

```typescript
interface AjaxResponse {
  // Common properties
  status: number;          // Writable
  statusText: string;      // Writable
  headers: Headers;        // Read-only
  finalUrl: string;

  // XHR-specific (Writable)
  response?: any;
  responseText?: string;
  responseXML?: Document | null;

  // Fetch-specific (Read-only, auto-parsed)
  ok?: boolean;
  redirected?: boolean;
  json?: any;
  text?: string;
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  formData?: FormData;
}
```

## Stream Chunk (StreamChunk)

The chunk object received by the `onStreamChunk` hook:

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Decoded text content |
| `raw` | `Uint8Array` | Raw byte data |
| `index` | `number` | Chunk index (starting from 0) |
| `timestamp` | `number` | Receive timestamp |

```typescript
interface StreamChunk {
  text: string;
  raw: Uint8Array;
  index: number;
  timestamp: number;
}
```

## Streaming Response Auto-Detection

The interceptor automatically detects streaming responses based on the `Content-Type` response header. The following types are recognized as streaming responses:

- `text/event-stream` (SSE)
- `application/stream+json`
- `application/x-ndjson`
- `application/jsonl`
- `application/json-seq`

When a streaming response is detected:
1. The `response` callback is invoked immediately (containing only `status`, `statusText`, `ok`, `headers`, `finalUrl`, `redirected` — no body data)
2. Stream data is passed chunk by chunk via the `onStreamChunk` hook
3. Returning a `string` from `onStreamChunk` modifies the chunk content; returning `void` or nothing keeps the original content

## Examples

### Rewrite Request URL

```typescript
interceptor.hook((request) => {
  if (request.url.includes('/api/v1/')) {
    request.url = request.url.replace('/api/v1/', '/api/v2/');
  }
  return request;
});
```

### Add Auth Token

```typescript
interceptor.hook((request) => {
  request.headers.set('Authorization', `Bearer ${getToken()}`);
  return request;
});
```

### Capture Response Data

```typescript
interceptor.hook((request) => {
  request.response = async (response) => {
    console.log('Status:', response.status);
    // XHR uses response.response, Fetch uses response.json
    console.log('Data:', response.json || response.response);
  };
  return request;
});
```

### Modify XHR Properties

```typescript
interceptor.hook((request) => {
  // Change response type
  request.responseType = 'json';
  // Set timeout
  request.timeout = 5000;
  // Send credentials
  request.withCredentials = true;
  return request;
}, 'xhr');
```

### Intercept Streaming Responses

```typescript
interceptor.hook((request) => {
  // Response headers are available immediately when the stream starts
  request.response = async (response) => {
    console.log('Stream started, status:', response.status);
  };

  // Intercept each chunk of the streaming response
  request.onStreamChunk = async (chunk) => {
    console.log('Chunk:', chunk.text);
    console.log('Raw data:', chunk.raw);
    console.log('Index:', chunk.index);
    console.log('Timestamp:', chunk.timestamp);

    // Return modified text to replace the chunk content
    return chunk.text.replace('old', 'new');

    // Return void or nothing to keep the original content
  };

  return request;
});
```

### Multiple Hooks in Sequence

```typescript
// First hook: add token
interceptor.hook((request) => {
  request.headers.set('Authorization', 'Bearer token');
  return request;
});

// Second hook: add timestamp
interceptor.hook((request) => {
  request.headers.set('X-Timestamp', Date.now().toString());
  return request;
});

// Third hook: log (no return value, keeps original request)
interceptor.hook((request) => {
  console.log(`${request.method} ${request.url}`);
});
```

## Development

```bash
# Install dependencies
pnpm install

# Dev mode
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Test coverage
pnpm test:coverage
```

## License

MIT

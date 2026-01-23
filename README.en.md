# ajax-hooker

A lightweight AJAX request interceptor that can intercept and modify both XMLHttpRequest and Fetch.

## Features

- 🎯 Works with XMLHttpRequest and Fetch API
- 🔄 Intercepts and modifies request parameters (URL, Method, Headers, Body)
- 📦 Captures response data
- 🌊 Supports streaming response interception (SSE, NDJSON, streaming JSON)
- 🪝 Chain multiple hook functions
- 🔒 Singleton pattern, global unique instance
- 📝 Full TypeScript typings

## Installation

```bash
npm install ajax-hooker
```

## Quick Start

```typescript
import AjaxInterceptor from 'ajax-hooker';

// Get interceptor instance
const interceptor = AjaxInterceptor.getInstance();

// Inject interceptor
interceptor.inject();

// Add a hook
interceptor.hook((request) => {
  // Modify request
  request.headers.set('Authorization', 'Bearer token');

  // Capture response
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

### inject()

Inject the interceptor and start intercepting requests.

```typescript
interceptor.inject();
```

### uninject()

Remove the interceptor and restore native XMLHttpRequest and Fetch.

```typescript
interceptor.uninject();
```

### hook(fn, type?)

Add a hook function.

Parameters:
- `fn`: Hook function, receives a request object and returns the modified request
- `type`: Optional, `'xhr'` or `'fetch'`. If omitted, both are intercepted.

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

## Request Object

```typescript
interface AjaxInterceptorRequest {
  type: 'xhr' | 'fetch';
  method: string;
  url: string;
  headers: Headers;
  data: any;
  response: (response: AjaxResponse) => void | Promise<void>;
  onStreamChunk?: (
    chunk: StreamChunk
  ) => string | void | Promise<string | void>;
}
```

## Response Object

```typescript
interface AjaxResponse {
  status: number;
  statusText: string;
  headers: Headers;
  finalUrl: string;

  // XHR response
  response?: any;

  // Fetch response
  ok?: boolean;
  redirected?: boolean;
  json?: any;
  text?: string;
  arrayBuffer?: ArrayBuffer;
  blob?: Blob;
  formData?: FormData;
}
```

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
    console.log('Data:', response.json || response.response);
  };
  return request;
});
```

### Intercept Streaming Responses

```typescript
interceptor.hook((request) => {
  request.onStreamChunk = async (chunk) => {
    console.log('Chunk:', chunk.text);
    console.log('Index:', chunk.index);

    return chunk.text.replace('old', 'new');
  };

  return request;
});
```

### Multiple Hooks in Sequence

```typescript
interceptor.hook((request) => {
  request.headers.set('Authorization', 'Bearer token');
  return request;
});

interceptor.hook((request) => {
  request.headers.set('X-Timestamp', Date.now().toString());
  return request;
});

interceptor.hook((request) => {
  console.log(`${request.method} ${request.url}`);
  return request;
});
```

## Development

```bash
# Install dependencies
npm install

# Dev mode
npm start

# Build
npm run build

# Test
npm test

# Test coverage
npm run test:coverage
```

## License

MIT

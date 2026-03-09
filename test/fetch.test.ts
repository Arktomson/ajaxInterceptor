import { http, HttpResponse } from 'msw';
import { server } from './msw/server';

describe('Fetch - 统一添加认证 Token', () => {
  it('Fetch 请求应该自动添加 Authorization token', async () => {
    const token = 'test-token-123';
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      request.headers.set('Authorization', `Bearer ${token}`);
      capturedHeaders = request.headers;
      return request;
    });

    const response = await fetch('/api/data');
    const json = await response.json();

    expect(capturedHeaders!.get('Authorization')).toBe(`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(json.message).toBe('success');
  });
});

describe('Fetch - 修改响应数据', () => {
  it('钩子应该能修改 fetch 响应的 json 数据', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        response.json.data = [1];
      };
      return request;
    });

    const response = await fetch('/api/data');
    const json = await response.json();

    expect(json.data).toEqual([1]);
  });

  it('钩子应该能修改 fetch 响应的 text 数据', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        response.text = '{"modified": true}';
      };
      return request;
    });

    const response = await fetch('/api/data');
    const text = await response.text();

    expect(text).toBe('{"modified": true}');
  });
});

describe('Fetch - 接口版本切换', () => {
  it('应该将 v1 接口自动切换到 v2', async () => {
    let modifiedUrl = '';

    interceptor.hook((request) => {
      if (request.url.includes('/api/v1/')) {
        request.url = request.url.replace('/api/v1/', '/api/v2/');
        modifiedUrl = request.url;
      }
      return request;
    });

    const response = await fetch('https://example.com/api/v1/users');
    const json = await response.json();

    expect(modifiedUrl).toContain('/api/v2/');
    expect(json.version).toBe('v2');
  });
});

describe('Fetch - 请求日志记录', () => {
  it('应该记录所有 fetch 请求和响应日志', async () => {
    const logs: any[] = [];

    interceptor.hook((request) => {
      const startTime = Date.now();

      logs.push({
        type: 'request',
        method: request.method,
        url: request.url,
      });

      request.response = async (response) => {
        logs.push({
          type: 'response',
          url: request.url,
          status: response.status,
          duration: Date.now() - startTime,
        });
      };

      return request;
    });

    await fetch('/api/products');
    await fetch('/api/orders', { method: 'POST' });

    expect(logs.length).toBe(4);
    expect(logs[0]).toMatchObject({
      type: 'request',
      method: 'GET',
      url: expect.stringContaining('/api/products'),
    });
    expect(logs[1]).toMatchObject({
      type: 'response',
      status: 200,
    });
    expect(logs[2]).toMatchObject({
      type: 'request',
      method: 'POST',
      url: expect.stringContaining('/api/orders'),
    });
    expect(logs[3]).toMatchObject({
      type: 'response',
      status: 201,
    });
  });
});

describe('Fetch - 添加公共参数', () => {
  it('应该给所有 fetch 请求添加公共查询参数', async () => {
    let finalUrl = '';

    interceptor.hook((request) => {
      const url = new URL(request.url);
      url.searchParams.set('timestamp', '1234567890');
      url.searchParams.set('platform', 'web');
      request.url = url.toString();
      finalUrl = request.url;
      return request;
    });

    await fetch('https://api.example.com/data');

    expect(finalUrl).toContain('timestamp=1234567890');
    expect(finalUrl).toContain('platform=web');
  });
});

describe('Fetch - 多钩子协作', () => {
  it('多个钩子应该按顺序执行并累积修改', async () => {
    const executionOrder: string[] = [];

    interceptor.hook((request) => {
      executionOrder.push('add_token');
      request.headers.set('Authorization', 'Bearer token');
      return request;
    });

    interceptor.hook((request) => {
      executionOrder.push('add_timestamp');
      request.headers.set('X-Timestamp', Date.now().toString());
      return request;
    });

    interceptor.hook((request) => {
      executionOrder.push('add_device');
      request.headers.set('X-Device', 'web');
      return request;
    });

    await fetch('/api/test');

    expect(executionOrder).toEqual([
      'add_token',
      'add_timestamp',
      'add_device',
    ]);
  });
});

describe('Fetch - Response 属性拦截', () => {
  it('应该能通过 Proxy 正确读取 status 和 statusText', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        response.status = 201;
        response.statusText = 'Created';
      };
      return request;
    });

    const response = await fetch('/api/data');

    expect(response.status).toBe(201);
    expect(response.statusText).toBe('Created');
  });

  it('应该能正确读取 ok 和 headers 属性', async () => {
    let capturedOk: boolean;
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      request.response = async (response) => {
        capturedOk = response.ok;
        capturedHeaders = response.headers;
      };
      return request;
    });

    const response = await fetch('/api/data');

    expect(capturedOk!).toBe(true);
    expect(capturedHeaders!).toBeInstanceOf(Headers);
    expect(response.ok).toBe(true);
  });
});

describe('Fetch - 修改请求方法和 body', () => {
  it('钩子应该能将 GET 请求改为 POST', async () => {
    let capturedMethod = '';

    interceptor.hook((request) => {
      request.method = 'POST';
      request.url = request.url.replace('/api/data', '/api/orders');
      capturedMethod = request.method;
      return request;
    });

    const response = await fetch('/api/data');

    expect(capturedMethod).toBe('POST');
    expect(response.status).toBe(201);
  });
});

describe('Fetch - XHR 和 Fetch 混合使用', () => {
  it('同一个钩子应该能同时拦截 XHR 和 Fetch 请求', async () => {
    const requestLog: any[] = [];

    interceptor.hook((request) => {
      requestLog.push({
        type: request.type,
        url: request.url,
        method: request.method,
      });
      return request;
    });

    // 发送 Fetch 请求
    await fetch('/api/users');

    // 发送 XHR 请求
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/products');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(requestLog.length).toBe(2);
    expect(requestLog[0]).toMatchObject({
      type: 'fetch',
      url: expect.stringContaining('/api/users'),
      method: 'GET',
    });
    expect(requestLog[1]).toMatchObject({
      type: 'xhr',
      url: expect.stringContaining('/api/products'),
      method: 'GET',
    });
  });
});

describe('Fetch - 流式响应拦截', () => {
  const readStreamText = async (body: ReadableStream<Uint8Array> | null) => {
    if (!body) return '';
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let output = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  };

  it('应该能逐块拦截并改写流式响应', async () => {
    server.use(
      http.get('/api/stream', () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('chunk-one\n'));
            controller.enqueue(encoder.encode('chunk-two\n'));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          headers: { 'content-type': 'application/x-ndjson' },
        });
      }),
    );

    let responseStatus = 0;
    const chunkTexts: string[] = [];

    interceptor.hook((request) => {
      request.response = async (response) => {
        responseStatus = response.status;
      };
      request.onStreamChunk = async (chunk) => {
        chunkTexts.push(chunk.text);
        return chunk.text.replace('chunk', 'modified');
      };
      return request;
    }, 'fetch');

    const response = await fetch('/api/stream');
    const text = await readStreamText(response.body);

    expect(responseStatus).toBe(200);
    expect(chunkTexts.length).toBeGreaterThan(0);
    expect(text).toContain('modified-one');
    expect(text).toContain('modified-two');
  });

  it('onStreamChunk 抛错时应回退为原始 chunk', async () => {
    server.use(
      http.get('/api/stream-error', () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('raw-stream-data'));
            controller.close();
          },
        });
        return new HttpResponse(body, {
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    interceptor.hook((request) => {
      request.onStreamChunk = async () => {
        throw new Error('stream hook failed');
      };
      return request;
    }, 'fetch');

    const response = await fetch('/api/stream-error');
    const text = await readStreamText(response.body);

    expect(text).toContain('raw-stream-data');
  });
});

describe('Fetch - .wasm 响应绕过代理', () => {
  it('应完全跳过 wasm 拦截并返回原生 Response 以兼容 compileStreaming', async () => {
    server.use(
      http.get('/assets/test.wasm', ({ request }) => {
        expect(request.headers.get('x-wasm-token')).toBeNull();
        return new HttpResponse(
          new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
          {
            headers: { 'content-type': 'application/wasm' },
          },
        );
      }),
    );

    let requestHookCalled = false;
    let responseHookCalled = false;

    interceptor.hook((request) => {
      if (request.url.includes('/assets/test.wasm')) {
        requestHookCalled = true;
        request.headers.set('x-wasm-token', 'enabled');
        request.response = async () => {
          responseHookCalled = true;
        };
      }
      return request;
    }, 'fetch');

    const module = await WebAssembly.compileStreaming(fetch('/assets/test.wasm'));

    expect(module).toBeInstanceOf(WebAssembly.Module);
    expect(requestHookCalled).toBe(false);
    expect(responseHookCalled).toBe(false);
  });
});

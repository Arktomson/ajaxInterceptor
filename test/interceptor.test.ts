import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AjaxInterceptor from '../src/index';

describe('业务场景 - 统一添加认证 Token', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;

    // 清空 hooks
    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('XHR 请求应该自动添加 Authorization token', async () => {
    const token = 'test-token-123';
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      request.headers.set('Authorization', `Bearer ${token}`);
      capturedHeaders = request.headers;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(capturedHeaders!.get('Authorization')).toBe(`Bearer ${token}`);
  });
});

describe('业务场景 - 接口版本切换', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;

    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('应该将 v1 接口自动切换到 v2', async () => {
    let modifiedUrl = '';

    interceptor.hook((request) => {
      if (request.url.includes('/api/v1/')) {
        request.url = request.url.replace('/api/v1/', '/api/v2/');
        modifiedUrl = request.url;
      }
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://example.com/api/v1/users');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(modifiedUrl).toContain('/api/v2/');
  });

  it('应该将旧域名切换到新域名', async () => {
    let modifiedUrl = '';

    interceptor.hook((request) => {
      request.url = request.url.replace('old-api.com', 'new-api.com');
      modifiedUrl = request.url;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://old-api.com/users');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(modifiedUrl).toContain('new-api.com');
  });
});

describe('业务场景 - 请求日志记录', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;
  let logs: any[];

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;
    logs = [];

    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('应该记录所有请求和响应日志', async () => {
    interceptor.hook((request) => {
      const startTime = Date.now();

      logs.push({
        type: 'request',
        method: request.method,
        url: request.url,
        timestamp: startTime,
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

    const xhr1 = new XMLHttpRequest();
    xhr1.open('GET', '/api/products');
    xhr1.send();

    await new Promise((resolve) => {
      xhr1.onload = () => resolve(undefined);
      xhr1.onerror = () => resolve(undefined);
    });

    const xhr2 = new XMLHttpRequest();
    xhr2.open('POST', '/api/orders');
    xhr2.send();

    await new Promise((resolve) => {
      xhr2.onload = () => resolve(undefined);
      xhr2.onerror = () => resolve(undefined);
    });

    expect(logs.length).toBeGreaterThanOrEqual(2); // 至少有 2 个请求日志
    expect(logs[0]).toMatchObject({
      type: 'request',
      method: 'GET',
      url: expect.stringContaining('/api/products'),
    });
  });
});

describe('业务场景 - 添加公共参数', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;

    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('应该给所有请求添加公共查询参数', async () => {
    let finalUrl = '';

    interceptor.hook((request) => {
      const url = new URL(request.url);
      url.searchParams.set('timestamp', '1234567890');
      url.searchParams.set('platform', 'web');
      request.url = url.toString();
      finalUrl = request.url;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(finalUrl).toContain('timestamp=1234567890');
    expect(finalUrl).toContain('platform=web');
  });
});

describe('业务场景 - 多钩子协作', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;

    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('多个钩子应该按顺序执行并累积修改', async () => {
    const executionOrder: string[] = [];

    // 钩子1: 添加 token
    interceptor.hook((request) => {
      executionOrder.push('add_token');
      request.headers.set('Authorization', 'Bearer token');
      return request;
    });

    // 钩子2: 添加时间戳
    interceptor.hook((request) => {
      executionOrder.push('add_timestamp');
      request.headers.set('X-Timestamp', Date.now().toString());
      return request;
    });

    // 钩子3: 添加设备信息
    interceptor.hook((request) => {
      executionOrder.push('add_device');
      request.headers.set('X-Device', 'web');
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/test');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(executionOrder).toEqual([
      'add_token',
      'add_timestamp',
      'add_device',
    ]);
  });
});

describe('业务场景 - XHR 和 Fetch 混合使用', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;
  let requestLog: any[];

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;
    requestLog = [];

    interceptor.xhrInterceptor.hooks = [];
    interceptor.fetchInterceptor.hooks = [];

    interceptor.inject();
  });

  afterEach(() => {
    window.XMLHttpRequest = originalXHR;
  });

  it('同一个钩子应该能同时拦截多个 XHR 请求', async () => {
    interceptor.hook((request) => {
      requestLog.push({
        type: request.type,
        url: request.url,
        method: request.method,
      });
      return request;
    });

    // 发送第一个 XHR 请求
    const xhr1 = new XMLHttpRequest();
    xhr1.open('GET', '/api/users');
    xhr1.send();

    await new Promise((resolve) => {
      xhr1.onload = () => resolve(undefined);
      xhr1.onerror = () => resolve(undefined);
    });

    // 发送第二个 XHR 请求
    const xhr2 = new XMLHttpRequest();
    xhr2.open('POST', '/api/orders');
    xhr2.send();

    await new Promise((resolve) => {
      xhr2.onload = () => resolve(undefined);
      xhr2.onerror = () => resolve(undefined);
    });

    expect(requestLog.length).toBe(2);
    expect(requestLog[0]).toMatchObject({
      type: 'xhr',
      url: expect.stringContaining('/api/users'),
      method: 'GET',
    });
    expect(requestLog[1]).toMatchObject({
      type: 'xhr',
      url: expect.stringContaining('/api/orders'),
      method: 'POST',
    });
  });
});

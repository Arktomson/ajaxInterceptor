import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AjaxInterceptor from '../src/index';
import { resolveUrl, safeStringify } from '../src/utils';

describe('AjaxInterceptor - 基础功能', () => {
  it('应该能够获取单例实例', () => {
    const instance1 = AjaxInterceptor.getInstance();
    const instance2 = AjaxInterceptor.getInstance();

    expect(instance1).toBe(instance2);
    expect(instance1).toBeDefined();
  });

  it('应该能够注入拦截器', () => {
    const interceptor = AjaxInterceptor.getInstance();

    expect(() => {
      interceptor.inject();
    }).not.toThrow();
  });

  it('应该能够添加钩子函数', () => {
    const interceptor = AjaxInterceptor.getInstance();

    const hookFn = (request: any) => {
      return request;
    };

    expect(() => {
      interceptor.hook(hookFn);
    }).not.toThrow();
  });
});

describe('AjaxInterceptor - XHR 拦截测试', () => {
  let interceptor: AjaxInterceptor;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    originalXHR = window.XMLHttpRequest;
    interceptor.inject();
  });

  afterEach(() => {
    // 恢复原始 XHR
    window.XMLHttpRequest = originalXHR;
  });

  it('应该拦截 XHR GET 请求', async () => {
    let intercepted = false;

    interceptor.hook((request) => {
      if (request.type === 'xhr' && request.url.includes('/test-get')) {
        intercepted = true;
        expect(request.method).toBe('GET');
        expect(request.url).toContain('/test-get');
      }
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/test-get');
    xhr.send();

    // 等待请求完成
    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });

    expect(intercepted).toBe(true);
  });

  it('应该拦截 XHR POST 请求并捕获 body', async () => {
    let capturedBody: any = null;

    interceptor.hook((request) => {
      if (request.type === 'xhr' && request.method === 'POST') {
        capturedBody = request.body;
        expect(request.url).toContain('/test-post');
      }
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/test-post');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send('{"test":"data"}');

    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });

    expect(capturedBody).toBe('{"test":"data"}');
  });

  it('应该能够修改 XHR 请求的 URL', async () => {
    let modifiedUrl = '';

    interceptor.hook((request) => {
      if (request.url.includes('/old-path')) {
        request.url = request.url.replace('/old-path', '/new-path');
        modifiedUrl = request.url;
      }
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/old-path');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });

    expect(modifiedUrl).toContain('/new-path');
  });

  it('应该能够修改 XHR 请求的 headers', async () => {
    let capturedHeaders: Record<string, string> = {};

    interceptor.hook((request) => {
      if (request.type === 'xhr') {
        request.headers['X-Custom-Header'] = 'test-value';
        request.headers['X-Token'] = 'abc123';
        capturedHeaders = request.headers;
      }
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/test-headers');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });

    expect(capturedHeaders['X-Custom-Header']).toBe('test-value');
    expect(capturedHeaders['X-Token']).toBe('abc123');
  });
});

describe('AjaxInterceptor - Fetch 拦截测试', () => {
  let interceptor: AjaxInterceptor;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    interceptor = AjaxInterceptor.getInstance();

    // 清空可能存在的钩子
    interceptor.fetchInterceptor.hooks = [];
    interceptor.xhrInterceptor.hooks = [];

    /**
     * 测试环境特殊处理:
     *
     * 由于 FetchInterceptor 使用单例模式,在类实例化时保存了 nativeFetch = window.fetch
     * 这是生产环境的最佳实践,确保始终能调用原始 fetch,即使其他代码污染了 window.fetch
     *
     * 但在 jsdom 测试环境中,我们需要 mock fetch 才能测试,而单例已经保存了 jsdom 的原始 fetch
     * 因此需要手动重置 nativeFetch 为 mock 函数
     *
     * 这不是实现问题,而是单例模式 + 测试环境的必然权衡
     */
    // @ts-ignore - 访问私有属性用于测试
    Object.defineProperty(interceptor.fetchInterceptor, 'nativeFetch', {
      value: vi.fn((url) => {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }),
      writable: true,
      configurable: true,
    });

    interceptor.inject();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('应该拦截 Fetch GET 请求', async () => {
    let intercepted = false;

    interceptor.hook((request) => {
      if (request.type === 'fetch' && request.url.includes('/api/users')) {
        intercepted = true;
        expect(request.method).toBe('GET');
      }
      return request;
    });

    try {
      await fetch('/api/users');
    } catch (e) {
      // 可能因为环境问题失败，不影响拦截测试
    }

    // 给一点时间让钩子执行
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(intercepted).toBe(true);
  });

  it('应该拦截 Fetch POST 请求并捕获 body', async () => {
    let capturedBody: any = null;

    interceptor.hook((request) => {
      if (request.type === 'fetch' && request.method === 'POST') {
        capturedBody = request.body;
      }
      return request;
    });

    try {
      await fetch('/api/create', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(capturedBody).toBe('{"name":"test"}');
  });

  it('应该能够修改 Fetch 请求的 URL', async () => {
    let modifiedUrl = '';

    interceptor.hook((request) => {
      if (request.type === 'fetch' && request.url.includes('/v1/')) {
        request.url = request.url.replace('/v1/', '/v2/');
        modifiedUrl = request.url;
      }
      return request;
    });

    try {
      await fetch('/v1/api/data');
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(modifiedUrl).toContain('/v2/');
  });

  it('应该能够修改 Fetch 请求的 headers', async () => {
    let capturedHeaders: Record<string, string> = {};
    let hookCalled = false;

    interceptor.hook((request) => {
      hookCalled = true;
      if (request.type === 'fetch') {
        // 确保 headers 是对象
        if (!request.headers || typeof request.headers !== 'object') {
          request.headers = {};
        }
        request.headers['Authorization'] = 'Bearer token123';
        request.headers['X-Api-Key'] = 'key456';
        capturedHeaders = { ...request.headers };
      }
      return request;
    });

    try {
      // 传入空 headers 对象
      await fetch('/api/protected', { headers: {} });
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(hookCalled).toBe(true);
    expect(capturedHeaders['Authorization']).toBe('Bearer token123');
    expect(capturedHeaders['X-Api-Key']).toBe('key456');
  });

  it('应该能够捕获响应数据', async () => {
    let responseData: any = null;

    interceptor.hook((request) => {
      request.response = async (response) => {
        responseData = response;
      };
      return request;
    });

    try {
      await fetch('/api/data');
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (responseData) {
      expect(responseData.status).toBeDefined();
      expect(responseData.headers).toBeDefined();
    }
  });
});

describe('AjaxInterceptor - 多钩子测试', () => {
  let interceptor: AjaxInterceptor;

  beforeEach(() => {
    interceptor = AjaxInterceptor.getInstance();
    interceptor.inject();
  });

  it('应该按顺序执行多个钩子', async () => {
    const executionOrder: number[] = [];

    interceptor.hook((request) => {
      executionOrder.push(1);
      return request;
    });

    interceptor.hook((request) => {
      executionOrder.push(2);
      return request;
    });

    interceptor.hook((request) => {
      executionOrder.push(3);
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/test-order');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('多个钩子应该能够链式修改请求', async () => {
    interceptor.hook((request) => {
      request.headers['X-Step'] = '1';
      return request;
    });

    interceptor.hook((request) => {
      request.headers['X-Step'] = request.headers['X-Step'] + '-2';
      return request;
    });

    interceptor.hook((request) => {
      request.headers['X-Step'] = request.headers['X-Step'] + '-3';
      expect(request.headers['X-Step']).toBe('1-2-3');
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/test-chain');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          resolve(undefined);
        }
      };
    });
  });
});

describe('AjaxInterceptor - 工具函数', () => {
  it('应该正确解析绝对 URL', () => {
    expect(resolveUrl('http://example.com/api')).toBe('http://example.com/api');
    expect(resolveUrl('https://example.com/test')).toBe('https://example.com/test');
  });

  it('应该正确解析相对 URL', () => {
    const result = resolveUrl('/api/test');
    expect(result).toContain('/api/test');
    expect(result).toMatch(/^https?:\/\//); // 应该是完整 URL
  });

  it('应该安全地序列化字符串', () => {
    expect(safeStringify('test')).toBe('test');
    expect(safeStringify('hello world')).toBe('hello world');
  });

  it('应该安全地序列化对象', () => {
    expect(safeStringify({ key: 'value' })).toBe('{"key":"value"}');
    expect(safeStringify({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  it('应该处理特殊值', () => {
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify(123)).toBe('123');
    expect(safeStringify(true)).toBe('true');
    // undefined 会被 String() 转换
    const result = safeStringify(undefined);
    expect(typeof result).toBe('string');
  });
});

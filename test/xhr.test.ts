describe('业务场景 - 统一添加认证 Token', () => {
  it('XHR 请求应该自动添加 Authorization token', async () => {
    const token = 'test-token-123';
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      request.headers.set('Authorization', `Bearer ${token}`);
      capturedHeaders = request.headers;

      // 验证响应数据
      request.response = async (response) => {
        const responseJson = JSON.parse(response.response as string);
        responseJson.data = [1];
        response.response = JSON.stringify(responseJson);
      };

      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    // 使用 Promise 等待异步完成
    await new Promise<void>((resolve) => {
      xhr.onload = () => {
        resolve();
      };
      xhr.onerror = () => resolve();
    });
    console.log(xhr.response, 'xhr.response');
    // 在 Promise 完成后进行断言
    expect(capturedHeaders!.get('Authorization')).toBe(`Bearer ${token}`);
    expect(xhr.status).toBe(200);

    // 验证响应数据
    const responseJson = JSON.parse(xhr.response);
    expect(responseJson.data).toEqual([1]);
  });
});

describe('业务场景 - 接口版本切换', () => {
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
  let logs: any[];

  beforeEach(() => {
    logs = [];
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
  let requestLog: any[];

  beforeEach(() => {
    requestLog = [];
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

describe('业务场景 - responseType 拦截', () => {
  it('钩子应该能将 responseType 从 json 改为 text', async () => {
    interceptor.hook((request) => {
      request.responseType = 'text';
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.responseType = 'json';
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(xhr.responseType).toMatch('text');
  });
});

describe('业务场景 - send handler headers diff 链路', () => {
  it('钩子仅修改 headers 时应触发 headersEqual 比较并重设 headers', async () => {
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      // 仅修改 headers，不改 url/method，走 headersEqual 返回 false 分支
      request.headers.set('X-Custom', 'injected');
      request.headers.set('X-Trace-Id', 'abc-123');
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

    expect(xhr.status).toBe(200);
    expect(capturedHeaders!.get('X-Custom')).toBe('injected');
    expect(capturedHeaders!.get('X-Trace-Id')).toBe('abc-123');
  });

  it('钩子同时修改 url 和 headers 时应触发 reopen 并重设 headers', async () => {
    let capturedUrl = '';
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      // 同时修改 url 和 headers，走 needReopen = true + headers 重设
      request.url = request.url.replace('/api/data', '/api/test');
      request.headers.set('X-Redirected', 'true');
      capturedUrl = request.url;
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

    expect(xhr.status).toBe(200);
    expect(capturedUrl).toContain('/api/test');
    expect(capturedHeaders!.get('X-Redirected')).toBe('true');
    // 验证实际请求到了 /api/test 端点
    const responseJson = JSON.parse(xhr.response);
    expect(responseJson.message).toBe('test');
  });

  it('XHR 已设置 header，钩子再修改 header 时应重设 headers', async () => {
    let capturedHeaders: Headers;

    interceptor.hook((request) => {
      // 用户原始设置了 X-App-Id，hook 覆盖它并新增一个 header
      request.headers.set('X-App-Id', 'overridden');
      request.headers.set('X-Extra', 'added-by-hook');
      capturedHeaders = request.headers;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    // 用户在 open 之后通过 setRequestHeader 设置了 headers
    xhr.setRequestHeader('X-App-Id', 'original');
    xhr.setRequestHeader('X-Lang', 'zh-CN');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(xhr.status).toBe(200);
    // hook 覆盖了 X-App-Id
    expect(capturedHeaders!.get('X-App-Id')).toBe('overridden');
    // hook 新增了 X-Extra
    expect(capturedHeaders!.get('X-Extra')).toBe('added-by-hook');
    // 用户原始设置的 X-Lang 保留
    expect(capturedHeaders!.get('X-Lang')).toBe('zh-CN');
  });

  it('钩子修改 method 时应触发 reopen', async () => {
    let capturedMethod = '';

    interceptor.hook((request) => {
      // 修改 method，走 needReopen 分支
      request.method = 'POST';
      request.url = request.url.replace('/api/data', '/api/orders');
      capturedMethod = request.method;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(capturedMethod).toBe('POST');
    expect(xhr.status).toBe(201);
  });
});

describe('业务场景 - onload 回调中 this 指向 proxy', () => {
  it('onload 中通过 this 读取的 response 应该是 hook 修改后的值', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        const json = JSON.parse(response.response as string);
        json.injected = '11';
        response.response = JSON.stringify(json);
      };
      return request;
    });

    let thisResponse = '';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');

    await new Promise<void>((resolve) => {
      xhr.onload = function () {
        // 通过 this 读取 response，应该走 proxy 的 get trap，拿到 hook 修改后的值
        thisResponse = this.response;
        resolve();
      };
      xhr.onerror = () => resolve();
      xhr.send();
    });

    const parsed = JSON.parse(thisResponse);
    expect(parsed.injected).toBe('11');
  });
});

describe('业务场景 - addEventListener 拦截', () => {
  it('通过 addEventListener 绑定 load 事件应该能拿到 hook 修改后的响应', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        const json = JSON.parse(response.response as string);
        json.added = true;
        response.response = JSON.stringify(json);
      };
      return request;
    });

    let eventResponse = '';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');

    await new Promise<void>((resolve) => {
      xhr.addEventListener('load', function () {
        eventResponse = this.response;
        resolve();
      });
      xhr.addEventListener('error', () => resolve());
      xhr.send();
    });

    const parsed = JSON.parse(eventResponse);
    expect(parsed.added).toBe(true);
  });

  it('通过 addEventListener 绑定 readystatechange 事件也能拿到修改后的响应', async () => {
    interceptor.hook((request) => {
      request.response = async (response) => {
        const json = JSON.parse(response.response as string);
        json.modified = 'yes';
        response.response = JSON.stringify(json);
      };
      return request;
    });

    let eventResponse = '';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');

    await new Promise<void>((resolve) => {
      xhr.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          eventResponse = this.response;
          resolve();
        }
      });
      xhr.send();
    });

    const parsed = JSON.parse(eventResponse);
    expect(parsed.modified).toBe('yes');
  });

  it('EventListenerObject 监听器应被正确调用', async () => {
    const handleEvent = vi.fn();
    const listenerObj = { handleEvent };

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.addEventListener('load', listenerObj);

    await new Promise<void>((resolve) => {
      xhr.onloadend = () => resolve();
      xhr.onerror = () => resolve();
      xhr.send();
    });

    expect(handleEvent).toHaveBeenCalledTimes(1);
    const event = handleEvent.mock.calls[0]?.[0];
    expect(event?.type).toBe('load');
  });

  it('removeEventListener 应能移除 addEventListener 注册的函数监听器', async () => {
    const onLoad = vi.fn();

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.addEventListener('load', onLoad, true);
    xhr.removeEventListener('load', onLoad, true);

    await new Promise<void>((resolve) => {
      xhr.onloadend = () => resolve();
      xhr.onerror = () => resolve();
      xhr.send();
    });

    expect(onLoad).not.toHaveBeenCalled();
  });

  it('removeEventListener 在未注册监听器时应走原生 fallback 且不抛错', async () => {
    const neverAdded = vi.fn();

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    // 这个监听器从未 add 过，用于覆盖映射缺失分支
    xhr.removeEventListener('load', neverAdded);

    await new Promise<void>((resolve) => {
      xhr.onloadend = () => resolve();
      xhr.onerror = () => resolve();
      xhr.send();
    });

    expect(neverAdded).not.toHaveBeenCalled();
  });
});

describe('业务场景 - uninject 恢复原始 XHR', () => {
  it('uninject 后 hook 不应该再生效', async () => {
    let hookCalled = false;

    interceptor.hook((request) => {
      hookCalled = true;
      return request;
    });

    interceptor.uninject();

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(hookCalled).toBe(false);

    // 重新 inject 以免影响后续测试
    interceptor.inject();
  });
});

describe('业务场景 - Proxy set 非函数属性', () => {
  it('设置非函数属性（如 responseType）应该正常透传', async () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.responseType = 'text';

    expect(xhr.responseType).toBe('text');
  });

  it('设置 timeout 属性应该正常透传', async () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.timeout = 5000;

    expect(xhr.timeout).toBe(5000);
  });

  it('hook 应该能修改 timeout 属性', async () => {
    interceptor.hook((request) => {
      request.timeout = 1200;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(xhr.timeout).toBe(1200);
  });
});

describe('业务场景 - POST 请求带 body', () => {
  it('应该能拦截 POST 请求的 body 数据', async () => {
    let capturedData: any;

    interceptor.hook((request) => {
      capturedData = request.data;
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/orders');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ item: 'test', quantity: 1 }));

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(capturedData).toBe(JSON.stringify({ item: 'test', quantity: 1 }));
    expect(xhr.status).toBe(201);
  });
});

describe('业务场景 - 钩子不修改 headers 时不应重设', () => {
  it('headers 未变化时不触发重设 headers 逻辑', async () => {
    let hookExecuted = false;

    interceptor.hook((request) => {
      hookExecuted = true;
      // 不修改任何东西，直接返回
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(hookExecuted).toBe(true);
    expect(xhr.status).toBe(200);
  });
});

describe('业务场景 - hook 执行异常不影响请求', () => {
  it('hook 抛出异常后请求仍应正常发出', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    interceptor.hook(() => {
      throw new Error('hook error');
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(xhr.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AjaxInterceptor]'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe('业务场景 - response 回调异常不影响响应', () => {
  it('response 回调抛出异常后响应仍应正常返回', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    interceptor.hook((request) => {
      request.response = async () => {
        throw new Error('response callback error');
      };
      return request;
    });

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');
    xhr.send();

    await new Promise((resolve) => {
      xhr.onload = () => resolve(undefined);
      xhr.onerror = () => resolve(undefined);
    });

    expect(xhr.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AjaxInterceptor]'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

describe('业务场景 - onload 和 readystatechange 同时绑定', () => {
  it('同时绑定 onload 和 addEventListener readystatechange 时 responseProcessor 不应重复执行', async () => {
    let responseCallCount = 0;

    interceptor.hook((request) => {
      request.response = async (response) => {
        responseCallCount++;
        const json = JSON.parse(response.response as string);
        json.counted = true;
        response.response = JSON.stringify(json);
      };
      return request;
    });

    let onloadResponse = '';
    let readystateResponse = '';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/data');

    await new Promise<void>((resolve) => {
      let resolved = false;
      const tryResolve = () => {
        if (onloadResponse && readystateResponse && !resolved) {
          resolved = true;
          resolve();
        }
      };

      xhr.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          readystateResponse = this.response;
          tryResolve();
        }
      });

      xhr.onload = function () {
        onloadResponse = this.response;
        tryResolve();
      };

      xhr.send();
    });

    // response 回调只执行一次（xhrAlreadyReturned 保护）
    expect(responseCallCount).toBe(1);
    // 两种方式读到的响应应该一致
    expect(JSON.parse(onloadResponse).counted).toBe(true);
    expect(JSON.parse(readystateResponse).counted).toBe(true);
  });
});

describe('业务场景 - parseHeaders 分支覆盖', () => {
  it('应支持 Headers 输入并合并同名 header', () => {
    const headers = new Headers();
    headers.append('X-Trace', 'a');
    headers.append('x-trace', 'b');
    headers.append('Content-Type', 'application/json');

    const parsed = (interceptor.xhrInterceptor as any).parseHeaders(
      headers,
    ) as Record<string, string>;

    expect(parsed['x-trace']).toBe('a, b');
    expect(parsed['content-type']).toBe('application/json');
  });

  it('应支持 plain object 输入并忽略 null/undefined 值', () => {
    const parsed = (interceptor.xhrInterceptor as any).parseHeaders({
      'X-Trace': 'trace-id',
      'x-number': 123 as any,
      'X-Null': null as any,
      'X-Undefined': undefined as any,
    }) as Record<string, string>;

    expect(parsed['x-trace']).toBe('trace-id');
    expect(parsed['x-number']).toBe('123');
    expect(parsed['x-null']).toBeUndefined();
    expect(parsed['x-undefined']).toBeUndefined();
  });
});

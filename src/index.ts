import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';
import {
  AjaxInterceptorRequest,
  AjaxResponse,
  HookFunction,
  AjaxType,
} from './type';
import { cloneDeep, isNil, mapValues, pickBy } from 'lodash-es';
import { getType, resolveUrl, safeStringify } from './utils';
class XhrInterceptor {
  public readonly nativeXhr = window.XMLHttpRequest;
  public readonly nativeXhrPrototype = this.nativeXhr.prototype;
  public hooks: Function[] = [];
  static #instance: XhrInterceptor;
  static #token = Symbol('XhrInterceptor');
  constructor(token: Symbol) {
    if (token !== XhrInterceptor.#token) {
      throw new Error('XhrInterceptor is a singleton');
    }
  }
  static getInstance() {
    if (!XhrInterceptor.#instance) {
      XhrInterceptor.#instance = new XhrInterceptor(XhrInterceptor.#token);
    }
    return XhrInterceptor.#instance;
  }
  private xhrInstanceAttrHandler = {};
  private xhrInstanceAttr = [
    'response',
    'responseText',
    'responseXML',
    'status',
    'statusText',
  ];
  private parseHeaders(
    obj: string | Headers | Record<string, string> | null | undefined
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!obj) return headers;

    // 统一的合并逻辑
    const mergeHeader = (key: string, value: string) => {
      const lkey = key.toLowerCase();
      headers[lkey] = lkey in headers ? `${headers[lkey]}, ${value}` : value;
    };

    const type = getType(obj);
    if (type === '[object String]') {
      const str = obj as string;
      for (const line of str.trim().split(/[\r\n]+/)) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        const header = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (!header) continue;
        mergeHeader(header, value);
      }
    } else if (type === '[object Headers]') {
      // 使用entries()确保获取所有headers
      const headersObj = obj as Headers;
      headersObj.forEach((val, key) => {
        mergeHeader(key, val);
      });
    } else if (type === '[object Object]') {
      // 确保key统一为小写
      const record = obj as Record<string, string>;
      for (const [key, val] of Object.entries(record)) {
        if (val != null) {
          mergeHeader(key, String(val));
        }
      }
    }
    return headers;
  }
  private async responseProcessor(target: XMLHttpRequest) {
    const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
    if (hooker.xhrAlreadyReturned) {
      return;
    }
    hooker.xhrAlreadyReturned = true;

    hooker.resp = {
      status: target.status,
      statusText: target.statusText,
      response: target.response,
      headers: new Headers(this.parseHeaders(target.getAllResponseHeaders())),
      finalUrl: target.responseURL || '',
    };
    try {
      await hooker.request.response(hooker.resp);
    } catch (error) {}
  }
  private headersEqual(a: Headers, b: Headers) {
    if (a === b) return true;

    const norm = (h) =>
      [...h.entries()]
        .map(([k, v]) => [k.toLowerCase(), v])
        .sort(([k1], [k2]) => k1.localeCompare(k2));

    const A = norm(a);
    const B = norm(b);

    if (A.length !== B.length) return false;

    for (let i = 0; i < A.length; i++) {
      if (A[i][0] !== B[i][0] || A[i][1] !== B[i][1]) return false;
    }
    return true;
  }
  private xhrMethodsHandler = {
    open: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (...args: Parameters<XMLHttpRequest['open']>) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        hooker.xhrReset();
        hooker.request = {
          type: 'xhr',
          method: args[0] || 'GET',
          url: resolveUrl(args[1]),
          async: args[2] || true,
          headers: new Headers(),
          data: null,
          response: () => {},
        };
        hooker.xhrOpenRestArgs = args.slice(2);
        self.nativeXhrPrototype.open.apply(target, [
          hooker.request.method,
          hooker.request.url,
          ...(hooker.xhrOpenRestArgs || []),
        ]);
      };
    },
    send: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return async function (body: Parameters<XMLHttpRequest['send']>[0]) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        hooker.request.data = body ?? null;
        hooker.request.headers = new Headers(
          mapValues(hooker.xhrSetRequestHeadersAfterOpen, (val) =>
            val.join(', ')
          )
        );
        const oldRequest = cloneDeep(hooker.request);
        let newRequest = hooker.request;
        try {
          newRequest = await hooker.execute(hooker.request, self.hooks);
        } catch (error) {}
        hooker.request = newRequest;

        const needReopen =
          oldRequest.method !== newRequest.method ||
          oldRequest.url !== newRequest.url;

        const headersChanged = !self.headersEqual(
          oldRequest.headers,
          newRequest.headers
        );

        if (needReopen) {
          self.nativeXhrPrototype.open.apply(target, [
            hooker.request.method,
            hooker.request.url,
            ...(hooker.xhrOpenRestArgs || []),
          ]);
          // 重新 open 后需要重新设置所有 headers
          hooker.request.headers.forEach((val, key) => {
            target.setRequestHeader(key, val);
          });
        } else if (headersChanged) {
          // 如果只修改了 headers，需要更新已设置的 headers
          hooker.request.headers.forEach((val, key) => {
            target.setRequestHeader(key, val);
          });
        }

        self.nativeXhrPrototype.send.apply(target, [hooker.request.data]);
      };
    },
    setRequestHeader: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (name: string, value: string) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        self.nativeXhrPrototype.setRequestHeader.apply(target, [name, value]);

        const key = name.toLowerCase();
        const headers = hooker.xhrSetRequestHeadersAfterOpen[key] ?? [];
        headers.push(value);
        hooker.xhrSetRequestHeadersAfterOpen[key] = headers;
      };
    },
    addEventListener: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (type: string, listener: EventListener, ...args: any[]) {
        let newListener = listener;
        if (
          type === 'readystatechange' ||
          type === 'load' ||
          type === 'loadend'
        ) {
          newListener = async function (...args) {
            if (target.readyState === 4) {
              await self.responseProcessor(target);
            }
            Reflect.apply(listener, this, args);
          };
        }
        target.addEventListener(type, newListener, ...args);
      };
    },
  };

  private getAttrHandler(target: XMLHttpRequest, attr: string) {
    if (this.xhrInstanceAttr.includes(attr)) {
      return this.xhrInstanceAttrHandler[attr](target);
    }
    if (this.xhrMethodsHandler[attr]) {
      return this.xhrMethodsHandler[attr](this, target);
    }
    return null;
  }

  private normalGetReturn(target: XMLHttpRequest, prop: string) {
    if (typeof target[prop] === 'function') {
      return function (...args) {
        return target[prop].apply(target, args);
      };
    }
    return Reflect.get(target, prop);
  }
  private _generateProxyXMLHttpRequest() {
    const self = this;
    this.xhrInstanceAttrHandler = this.xhrInstanceAttr.reduce((acc, attr) => {
      acc[attr] = function (target) {
        const hooker = target[CYCLE_SCHEDULER];
        if (!hooker.xhrAlreadyReturned) {
          return target[attr];
        }
        return hooker.resp[attr];
      };
      return acc;
    }, {});
    function proxyXhr() {
      const xhr = new self.nativeXhr();
      xhr[CYCLE_SCHEDULER] = new XhrCycleScheduler();

      const proxyXhr = new Proxy(xhr, {
        get(target, prop: string) {
          const attrHandler = self.getAttrHandler(target, prop);
          if (attrHandler) {
            return attrHandler;
          }
          return self.normalGetReturn(target, prop);
        },
        set(target: XMLHttpRequest, prop: string, value) {
          if (
            prop === 'onreadystatechange' ||
            prop === 'onload' ||
            prop === 'onloadend'
          ) {
            const fn = async (...args) => {
              if (target.readyState === 4) {
                await self.responseProcessor(target);
              }
              Reflect.apply(value, this, args);
            };
            return Reflect.set(target, prop, fn);
          }
          return Reflect.set(target, prop, value);
        },
      });

      return proxyXhr;
    }
    Object.keys(self.nativeXhr).forEach((key) => {
      proxyXhr[key] = self.nativeXhr[key];
    });
    proxyXhr.prototype = this.nativeXhrPrototype;
    return proxyXhr as unknown as typeof XMLHttpRequest;
  }
  public inject() {
    window.XMLHttpRequest = this._generateProxyXMLHttpRequest();
  }
  public uninject() {
    window.XMLHttpRequest = this.nativeXhr;
  }
}
class FetchInterceptor {
  public readonly nativeFetch = window.fetch;
  public readonly nativeFetchPrototype = this.nativeFetch.prototype;
  public hooks: Function[] = [];
  static #instance: FetchInterceptor;
  static #token = Symbol('FetchInterceptor');
  private fetchInstanceAttrHandler = {};
  private fetchInstanceAttr = [
    'status',
    'statusText',
    'ok',
    'headers',
    'redirected',
  ];
  private fetchMethodsHandler = {};
  private fetchMethods = ['json', 'formData', 'blob', 'arrayBuffer', 'text'];
  constructor(token: Symbol) {
    if (token !== FetchInterceptor.#token) {
      throw new Error('FetchInterceptor is a singleton');
    }
  }
  static getInstance() {
    if (!FetchInterceptor.#instance) {
      FetchInterceptor.#instance = new FetchInterceptor(
        FetchInterceptor.#token
      );
    }
    return FetchInterceptor.#instance;
  }
  private getAttrHandler(target: Response, attr: string) {
    if (this.fetchInstanceAttr.includes(attr)) {
      return this.fetchInstanceAttrHandler[attr](this, target);
    }
    if (this.fetchMethodsHandler[attr]) {
      return this.fetchMethodsHandler[attr](this, target);
    }
    return null;
  }
  private normalGetReturn(target: Response, prop: string) {
    if (typeof target[prop] === 'function') {
      return function (...args) {
        return target[prop].apply(target, args);
      };
    }
    return Reflect.get(target, prop);
  }
  private normalizeRequest(req: string | URL | Request) {
    let url = '';
    let method = null;
    let headers = null;
    let data = null;
    if (typeof req === 'string') {
      url = resolveUrl(req);
    } else if (req instanceof URL) {
      url = resolveUrl(req);
    } else {
      url = resolveUrl(req.url);
      method = req.method ?? null;
      headers = req.headers ?? null;
      data = req.body ?? null;
    }
    return {
      url,
      method,
      headers,
      data,
    };
  }
  private resolveRequest(
    req: string | URL | Request,
    newRequest: AjaxInterceptorRequest
  ): string | URL | Request {
    if (typeof req === 'string') {
      return newRequest.url;
    }
    if (req instanceof URL) {
      return new URL(newRequest.url);
    }
    if (req instanceof Request) {
      return new Request(
        newRequest.url,
        pickBy(req, (value, key) => key !== 'url' && !isNil(value))
      );
    }
    return req;
  }
  private resolveOptions({
    options,
    newRequest,
    request,
  }: {
    options: RequestInit;
    newRequest: AjaxInterceptorRequest;
    request: string | URL | Request;
  }) {
    const streamOptions = {
      duplex: 'half',
    };
    return {
      ...(options ? options : {}),
      ...(newRequest.headers ? { headers: newRequest.headers } : {}),
      ...(newRequest.data ? { body: newRequest.data as BodyInit } : {}),
      ...(newRequest.method ? { method: newRequest.method } : {}),
      ...(newRequest.data instanceof ReadableStream ? streamOptions : {}),
    };
  }
  private _generateProxyFetch() {
    const self = this;

    this.fetchInstanceAttrHandler = this.fetchInstanceAttr.reduce(
      (acc, attr) => {
        acc[attr] = function (self, target) {
          const hooker = target[CYCLE_SCHEDULER];
          return hooker.resp[attr];
        };
        return acc;
      },
      {}
    );

    this.fetchMethodsHandler = this.fetchMethods.reduce((acc, methodName) => {
      acc[methodName] = function (self, target) {
        return async function (...args) {
          const hooker: FetchCycleScheduler = target[CYCLE_SCHEDULER];
          return hooker.resp[methodName];
        };
      };
      return acc;
    }, {});

    const resolveHeaders = (headers: HeadersInit): Headers => {
      if (headers instanceof Headers) {
        return headers;
      }
      return new Headers(headers);
    };
    async function proxyFetch(
      req: string | URL | Request,
      options: RequestInit = {}
    ) {
      const request = self.normalizeRequest(req);
      const winFetch = self.nativeFetch;
      const hooker = new FetchCycleScheduler();

      let newRequest = request as AjaxInterceptorRequest;
      try {
        newRequest = await hooker.execute(
          {
            type: AJAX_TYPE.FETCH,
            url: request.url,
            method: request.method ?? options.method ?? 'GET',
            // TODO: 这里需要处理 headers 的类型
            headers: resolveHeaders(request.headers ?? options.headers ?? null),
            data: request.data ?? options.body ?? null,
            response: () => {},
          },
          self.hooks
        );
      } catch (error) {}

      hooker.request = newRequest;

      const fh: Response = await winFetch(
        self.resolveRequest(req, newRequest),
        self.resolveOptions({ options, newRequest, request: req })
      );

      // 检测是否为流式响应
      const contentType = fh.headers.get('content-type') || '';
      const isStreamResponse =
        contentType.includes('text/event-stream') ||
        contentType.includes('application/stream+json') ||
        contentType.includes('application/x-ndjson');

      let interceptedResponse: Response = fh;

      // 对于流式响应，创建拦截流
      if (isStreamResponse && fh.body) {
        hooker.resp = {
          status: fh.status,
          statusText: fh.statusText,
          ok: fh.ok,
          headers: fh.headers,
          finalUrl: fh.url,
          redirected: fh.redirected,
        };

        try {
          await hooker.request.response(hooker.resp);
        } catch (error) {}

        // 创建 TransformStream 拦截流数据
        let chunkIndex = 0;
        const { readable, writable } = new TransformStream({
          async transform(chunk, controller) {
            // chunk 是 Uint8Array，包含流数据
            try {
              // 解码为文本
              const decoder = new TextDecoder();
              const text = decoder.decode(chunk, { stream: true });

              let modifiedText = text;

              // 调用用户自定义的流处理钩子
              if (hooker.request.onStreamChunk) {
                const streamChunk = {
                  text,
                  raw: chunk,
                  index: chunkIndex++,
                  timestamp: Date.now(),
                };

                const result = await hooker.request.onStreamChunk(streamChunk);
                // 如果钩子返回了新文本，使用新文本；否则使用原文本
                if (typeof result === 'string') {
                  modifiedText = result;
                }
                console.log(modifiedText, 'modifiedText');
              }

              // 重新编码并传递
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(modifiedText));
            } catch (error) {
              // 如果解码失败或钩子出错，直接传递原始数据
              controller.enqueue(chunk);
            }
          },
        });

        // 将原始流导入到 TransformStream
        fh.body.pipeTo(writable);

        // 创建新的 Response，使用拦截后的流
        interceptedResponse = new Response(readable, {
          status: fh.status,
          statusText: fh.statusText,
          headers: fh.headers,
        });
      } else if (!isStreamResponse) {
        // 非流式响应，正常解析 body
        const [json, text, arrayBuffer, blob, formData] =
          await Promise.allSettled([
            fh.clone().json(),
            fh.clone().text(),
            fh.clone().arrayBuffer(),
            fh.clone().blob(),
            fh.clone().formData(),
          ]).then((results) =>
            results.map((result) =>
              result.status === 'fulfilled' ? result.value : null
            )
          );

        hooker.resp = {
          status: fh.status,
          statusText: fh.statusText,
          ok: fh.ok,
          headers: fh.headers,
          finalUrl: fh.url,
          redirected: fh.redirected,
          json,
          text,
          arrayBuffer,
          blob,
          formData,
        };

        try {
          await hooker.request.response(hooker.resp);
        } catch (error) {}
      }

      interceptedResponse[CYCLE_SCHEDULER] = hooker;
      const proxyFh = new Proxy(interceptedResponse, {
        get(target, prop) {
          const attrHandler = self.getAttrHandler(target, prop as string);
          if (attrHandler) {
            return attrHandler;
          }
          return self.normalGetReturn(target, prop as string);
        },
        set(target, prop, value) {
          return Reflect.set(target, prop, value);
        },
      });
      return proxyFh;
    }
    Object.keys(this.nativeFetch).forEach((key) => {
      proxyFetch[key] = this.nativeFetch[key];
    });
    proxyFetch.prototype = this.nativeFetchPrototype;
    return proxyFetch;
  }
  public inject() {
    window.fetch = this._generateProxyFetch();
  }
  public uninject() {
    window.fetch = this.nativeFetch;
  }
}
class CycleScheduler {
  public request: AjaxInterceptorRequest = {} as AjaxInterceptorRequest;
  public resp: AjaxResponse = {} as AjaxResponse;
  constructor({
    request = {} as AjaxInterceptorRequest,
  }: {
    request?: AjaxInterceptorRequest;
  } = {}) {
    this.request = request;
  }
  async execute(
    request: AjaxInterceptorRequest,
    fnList: Function[]
  ): Promise<AjaxInterceptorRequest> {
    let result = request;
    for (const fn of fnList) {
      const newResult = await fn(result);
      if (newResult) {
        result = newResult;
      }
    }
    return result;
  }
}

class XhrCycleScheduler extends CycleScheduler {
  public xhrAlreadyReturned = false;
  public xhrOpenRestArgs: (string | boolean | URL)[] = [];
  public xhrSetRequestHeadersAfterOpen: Record<string, string[]> = {};
  public xhrReset() {
    this.request = {} as AjaxInterceptorRequest;
    this.resp = {} as AjaxResponse;
    this.xhrOpenRestArgs = [];
    this.xhrSetRequestHeadersAfterOpen = {};
    this.xhrAlreadyReturned = false;
  }
  constructor({
    request = {} as AjaxInterceptorRequest,
  }: {
    request?: AjaxInterceptorRequest;
  } = {}) {
    super({ request });
  }
}
class FetchCycleScheduler extends CycleScheduler {
  constructor({
    request = {} as AjaxInterceptorRequest,
  }: {
    request?: AjaxInterceptorRequest;
  } = {}) {
    super({ request });
  }
}
class AjaxInterceptor {
  public xhrInterceptor: XhrInterceptor;
  public fetchInterceptor: FetchInterceptor;
  static #instance: AjaxInterceptor;
  static #token = Symbol('AjaxInterceptor');

  private constructor(token: Symbol) {
    if (token !== AjaxInterceptor.#token) {
      throw new Error('AjaxInterceptor is a singleton');
    }
    this.xhrInterceptor = XhrInterceptor.getInstance();
    this.fetchInterceptor = FetchInterceptor.getInstance();
  }
  static getInstance() {
    if (!AjaxInterceptor.#instance) {
      AjaxInterceptor.#instance = new AjaxInterceptor(AjaxInterceptor.#token);
    }
    return AjaxInterceptor.#instance;
  }
  inject() {
    // 环境兼容性检查
    if (typeof window === 'undefined') {
      throw new Error('AjaxInterceptor requires a browser environment');
    }

    if (!window.XMLHttpRequest) {
      console.warn('XMLHttpRequest is not supported in this environment');
    }

    if (!window.fetch) {
      console.warn('Fetch API is not supported in this environment');
    }

    this.xhrInterceptor.inject();
    this.fetchInterceptor.inject();
  }
  uninject() {
    this.xhrInterceptor.uninject();
    this.fetchInterceptor.uninject();
  }
  hook(fn: HookFunction, type?: AjaxType) {
    if (type === AJAX_TYPE.XHR) {
      this.xhrInterceptor.hooks.push(fn);
    } else if (type === AJAX_TYPE.FETCH) {
      this.fetchInterceptor.hooks.push(fn);
    } else {
      this.xhrInterceptor.hooks.push(fn);
      this.fetchInterceptor.hooks.push(fn);
    }
  }
}

export default AjaxInterceptor;
export { AjaxInterceptor };
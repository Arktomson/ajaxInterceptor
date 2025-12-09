import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';
import {
  AjaxInterceptorRequest,
  AjaxResponse,
  HookFunction,
  AjaxType,
} from './type';
import { cloneDeep, mapValues } from 'lodash-es';
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
    } catch (error) {
    }
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
          headers: {},
          body: null,
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
        hooker.request.body = body ?? null;
        hooker.request.headers = mapValues(
          hooker.xhrSetRequestHeadersAfterOpen,
          (val) => val.join(', ')
        );
        const oldRequest = cloneDeep(hooker.request);
        const newRequest = await hooker.execute(hooker.request, self.hooks);
        hooker.request = newRequest;

        const needReopen =
          oldRequest.method !== newRequest.method ||
          oldRequest.url !== newRequest.url;

        const headersChanged =
          safeStringify(oldRequest.headers) !==
          safeStringify(newRequest.headers);

        if (needReopen) {
          console.log('reopen, bingo');
          self.nativeXhrPrototype.open.apply(target, [
            hooker.request.method,
            hooker.request.url,
            ...(hooker.xhrOpenRestArgs || []),
          ]);
          // 重新 open 后需要重新设置所有 headers
          for (let [key, val] of Object.entries(hooker.request.headers || {})) {
            target.setRequestHeader(key, val);
          }
        } else if (headersChanged) {
          // 如果只修改了 headers，需要更新已设置的 headers
          for (let [key, val] of Object.entries(hooker.request.headers || {})) {
            target.setRequestHeader(key, val);
          }
        }

        self.nativeXhrPrototype.send.apply(target, [hooker.request.body]);
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
            listener(...args);
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
              value(...args);
            };
            Reflect.set(target, prop, fn);
            return true; // Proxy set trap 必须返回 true
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
          console.log(target.headers, 'target.headers');
          const hooker: FetchCycleScheduler = target[CYCLE_SCHEDULER];
          // const result = await target[methodName].apply(target, args);
          return hooker.resp[methodName];
        };
      };
      return acc;
    }, {});
    async function proxyFetch(url: string, options: RequestInit) {
      const winFetch = self.nativeFetch;
      const hooker = new FetchCycleScheduler();
      const newRequest = await hooker.execute(
        {
          type: AJAX_TYPE.FETCH,
          url,
          method: options.method,
          // TODO: 这里需要处理 headers 的类型
          headers: options.headers as Record<string, string>,
          body: options.body,
          response: () => {},
        },
        self.hooks
      );
      hooker.request = newRequest;
      const fh: Response = await winFetch(newRequest.url, {
        ...(options ? { ...options } : {}),
        ...(newRequest.headers ? { headers: newRequest.headers } : {}),
        ...(newRequest.body ? { body: newRequest.body as BodyInit } : {}),
        ...(newRequest.method ? { method: newRequest.method } : {}),
      });

      const [json, text, arrayBuffer, blob, formData] = await Promise.allSettled([
        fh.clone().json(),
        fh.clone().text(),
        fh.clone().arrayBuffer(),
        fh.clone().blob(),
        fh.clone().formData(),
      ]).then((results) => results.map((result) => result.status === 'fulfilled' ? result.value : null));
      console.log(fh.headers, 'fh.headers');
      console.log(fh.headers.get('Content-Type'), 'Content-Type');
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
      } catch (error) {
      }

      fh[CYCLE_SCHEDULER] = hooker;
      const proxyFh = new Proxy(fh, {
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
  async execute(request: AjaxInterceptorRequest, fnList: Function[]) {
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

const ajaxInterceptor: AjaxInterceptor = AjaxInterceptor.getInstance();

ajaxInterceptor.inject();
let count = 0;

ajaxInterceptor.hook((request) => {
  console.log(`%c${++count} twices-x200 pbx`, 'color: red', request.url);
  if (request.url === '/api/outer/ats-apply/website/jobs/v2') {
    const body = JSON.parse(request.body as string);
    body.keyword = '后端';
    request.body = JSON.stringify(body);
  }

  if (
    request.type === 'fetch' &&
    typeof request.url === 'string' &&
    request.url.includes('/admin/article/paging')
  ) {
    console.log(request.body, 'request.body');
    const body = JSON.parse(request.body as string);
    body.pageSize = 2;
    request.body = JSON.stringify(body);
  }
  if (request.url === 'https://jsonplaceholder.typicode.com/posts') {
    console.log('bingo');
    request.headers.kpi = '10000';
  }
  request.response = (response: AjaxResponse) => {
    if (request.url === '/portal/searchHome') {
      const result = JSON.parse(response.response as string);
      console.log(result, 'result');
      result.result.data.children = result.result.data.children?.slice?.(0, 2);
      response.response = JSON.stringify(result);
    }
    if(request.type === 'fetch') {
      console.log(response.headers, 'response.headers');
      console.log(response.finalUrl, 'finalUrl');
      console.log(`%c fetch Result  new`, 'color: purple', response.json);
      const data = response.json.data;
      if(data.length > 0) {
        data[0].name = '草泥马';
      }
      response.json.data = data;
    }
    if (
      request.type === 'fetch' &&
      response.bodyUsed &&
      request.url.includes?.('/api/docs')
    ) {
      console.log('json Result', response.json);
      response.json.data.content_updated_at = '2025-07-30T03:21:10.000Z';
    }
    // if (
    //   request.type === 'fetch' &&
    //   response.bodyUsed &&
    //   (typeof request.url === 'object' || response.url.includes?.('next'))
    // ) {
    //   console.log('youtubejson Result', response.text);
    // }
  };
  return request;
});

export default AjaxInterceptor;

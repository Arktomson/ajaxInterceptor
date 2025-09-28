import { CYCLE_SCHEDULER } from './constant';
import { AjaxHookerRequest, AjaxResponse } from './type';

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
  private xhrMethodsHandler = {
    open: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (...args: Parameters<XMLHttpRequest['open']>) {
        const hooker: CycleScheduler = target[CYCLE_SCHEDULER];
        hooker.reset();
        hooker.request = {
          type: 'XHR',
          method: args[0] || 'GET',
          url: args[1] || '',
          async: args[2] || true,
          headers: {},
          body: null,
          response: () => {},
        };
        hooker.xhrOpenRestArgs = args.slice(3);
        self.nativeXhrPrototype.open.apply(target, [
          hooker.request.method,
          hooker.request.url,
          hooker.request.async,
          ...(hooker.xhrOpenRestArgs || []),
        ]);
      };
    },
    send: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return async function (body: Parameters<XMLHttpRequest['send']>) {
        const hooker: CycleScheduler = target[CYCLE_SCHEDULER];
        hooker.request.body = body ?? null;
        const oldRequest = Object.assign({}, hooker.request);
        await hooker.execute(hooker.request, self.hooks);

        if (
          oldRequest.method !== hooker.request.method ||
          oldRequest.url !== hooker.request.url ||
          oldRequest.async !== hooker.request.async
        ) {
          self.nativeXhrPrototype.open.apply(target, [
            hooker.request.method,
            hooker.request.url,
            hooker.request.async,
            ...(hooker.xhrOpenRestArgs || []),
          ]);
          for (let [key, val] of hooker.xhrSetRequestAfterOpen) {
            target.setRequestHeader(key, val.join(','));
          }
        }

        self.nativeXhrPrototype.send.apply(target, [hooker.request.body]);
      };
    },
    setRequestHeader: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (name: string, value: string) {
        const hooker: CycleScheduler = target[CYCLE_SCHEDULER];
        // 先调用“原生”，成功后再缓存，确保与浏览器限制一致（某些禁止头会被拒）
        self.nativeXhrPrototype.setRequestHeader.call(target, name, value);

        const key = name.toLowerCase();
        const headers = hooker.xhrSetRequestAfterOpen.get(key) ?? [];
        headers.push(value);
        hooker.xhrSetRequestAfterOpen.set(key, headers);
      };
    },
  };
  _generateProxyXMLHttpRequest() {
    const self = this;
    this.xhrInstanceAttrHandler = this.xhrInstanceAttr
      .map((attr) => {
        return {
          name: attr,
          handler: function (self, target) {
            const hooker = target[CYCLE_SCHEDULER];
            if (!hooker.xhrAlreadyReturned) {
              return target[attr];
            }
            return hooker.resp[attr];
          },
        };
      })
      .reduce((acc, curr) => {
        acc[curr.name] = curr.handler;
        return acc;
      }, {});
    function proxyXhr() {
      const xhr = new self.nativeXhr();
      xhr[CYCLE_SCHEDULER] = new CycleScheduler();

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) {
          const hooker = xhr[CYCLE_SCHEDULER];
          hooker.xhrAlreadyReturned = true;
          hooker.resp = {
            status: xhr.status,
            statusText: xhr.statusText,
            response: xhr.response,
            responseText:
              xhr.responseType === 'text' || xhr.responseType === ''
                ? xhr.responseText
                : null,
            responseXML:
              xhr.responseType === 'document' || xhr.responseType === ''
                ? xhr.responseXML
                : null,
            responseType: xhr.responseType,
          };
          hooker.request.response(hooker.resp);
        }
      });
      const proxyXhr = new Proxy(xhr, {
        get(target, prop: string) {
          const perhapsHandler =
            self.xhrMethodsHandler[prop]?.(self, target) ||
            self.xhrInstanceAttrHandler[prop]?.(self, target);
          if (perhapsHandler) {
            return perhapsHandler;
          }
          if (typeof target[prop] === 'function') {
            return function (...args) {
              return target[prop].apply(target, args);
            };
          }
          return Reflect.get(target, prop);
        },
        set(target, prop: string, value) {
          return Reflect.set(target, prop, value);
        },
      });

      return proxyXhr;
    }
    Object.keys(self.nativeXhr).forEach((key) => {
      proxyXhr[key] = self.nativeXhr[key];
    });
    proxyXhr.prototype = this.nativeXhrPrototype;
    return proxyXhr;
  }
}
class FetchInterceptor {
  public readonly nativeFetch = window.fetch;
  public readonly nativeFetchPrototype = this.nativeFetch.prototype;
  public hooks: Function[] = [];
  static #instance: FetchInterceptor;
  static #token = Symbol('FetchInterceptor');
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
  _generateProxyFetch() {
    const self = this;
    async function proxyFetch(url: string, options: RequestInit) {
      const winFetch = self.nativeFetch;
      const hooker = new CycleScheduler();
      const newRequest = await hooker.execute(
        {
          type: 'FETCH',
          url,
          method: options.method || 'GET',
          headers: (options.headers || {}) as Record<string, string>,
          body: options.body || null,
          response: () => {},
        },
        self.hooks
      );
      const fh: Response = await winFetch(newRequest.url, {
        ...options,
        headers: newRequest.headers,
        body: newRequest.body as BodyInit,
        method: newRequest.method,
      });
      fh[CYCLE_SCHEDULER] = hooker;
      const proxyFh = new Proxy(fh, {
        get(target, prop) {
          if (typeof target[prop] === 'function') {
            return function (...args) {
              return target[prop].apply(target, args);
            };
          }
          return Reflect.get(target, prop);
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
}
class CycleScheduler {
  public request: AjaxHookerRequest = {} as AjaxHookerRequest;
  public resp: AjaxResponse = {} as AjaxResponse;
  public xhrOpenRestArgs: (string | boolean | URL)[] = [];
  public xhrSetRequestAfterOpen = new Map<string, string[]>();
  public xhrAlreadyReturned = false;
  constructor({
    request = {} as AjaxHookerRequest,
  }: {
    request?: AjaxHookerRequest;
  } = {}) {
    this.request = request;
  }
  reset() {
    this.request = {} as AjaxHookerRequest;
    this.resp = {} as AjaxResponse;
    this.xhrOpenRestArgs = [];
    this.xhrSetRequestAfterOpen.clear();
    this.xhrAlreadyReturned = false;
  }

  async execute(request: AjaxHookerRequest, fnList: Function[]) {
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
    window.XMLHttpRequest =
      this.xhrInterceptor._generateProxyXMLHttpRequest() as any;
    window.fetch = this.fetchInterceptor._generateProxyFetch() as any;
  }
  uninject() {
    window.XMLHttpRequest = this.xhrInterceptor.nativeXhr;
    window.fetch = this.fetchInterceptor.nativeFetch;
  }
  hook(fn: Function, type?: 'xhr' | 'fetch') {
    if (type === 'xhr') {
      this.xhrInterceptor.hooks.push(fn);
    } else if (type === 'fetch') {
      this.fetchInterceptor.hooks.push(fn);
    } else {
      this.xhrInterceptor.hooks.push(fn);
      this.fetchInterceptor.hooks.push(fn);
    }
  }
}

const ajaxInterceptor: AjaxInterceptor = AjaxInterceptor.getInstance();
ajaxInterceptor.inject();
ajaxInterceptor.hook((request: AjaxHookerRequest) => {
  console.log('hook', request.url);
  if (request.url === '/api/outer/ats-apply/website/jobs/v2') {
    const body = JSON.parse(request.body as string);
    body.keyword = '后端';
    request.body = JSON.stringify(body);
  }
  if (
    request.type === 'FETCH' &&
    request.url.includes('/admin/article/paging')
  ) {
    console.log(request.body, 'request.body');
    const body = JSON.parse(request.body);
    body.pageSize = 2;
    request.body = JSON.stringify(body);
  }
  request.response = (response: AjaxResponse) => {
    if (request.url === '/portal/searchHome') {
      const result = JSON.parse(response.responseText as string);
      result.result.data.children = result.result.data.children.slice(0, 2);
      response.responseText = JSON.stringify(result);
    }
  };
  return request;
});

export default AjaxInterceptor;

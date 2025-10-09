import { AJAX_TYPE, CYCLE_SCHEDULER } from '../constant';
import { AjaxInterceptorRequest, AjaxResponse } from '../type';
import { mapValues } from 'lodash-es';
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
        hooker.xhrReset();
        hooker.request = {
          type: 'XHR',
          method: args[0] || 'GET',
          url: args[1] || '',
          async: args[2] || true,
          headers: {},
          body: null,
          response: [],
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
        hooker.request.headers = mapValues(
          hooker.xhrSetRequestAfterOpen,
          (val) => val.join(',')
        );
        const oldRequest = Object.assign({}, hooker.request);
        const newRequest = await hooker.execute(hooker.request, self.hooks);
        hooker.request = newRequest;

        if (
          oldRequest.method !== newRequest.method ||
          oldRequest.url !== newRequest.url ||
          oldRequest.async !== newRequest.async
        ) {
          self.nativeXhrPrototype.open.apply(target, [
            hooker.request.method,
            hooker.request.url,
            hooker.request.async,
            ...(hooker.xhrOpenRestArgs || []),
          ]);
          for (let [key, val] of Object.entries(hooker.request.headers)) {
            target.setRequestHeader(key, val);
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
        const headers = hooker.xhrSetRequestAfterOpen[key] ?? [];
        headers.push(value);
        hooker.xhrSetRequestAfterOpen[key] = headers;
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

      xhr.addEventListener('readystatechange', async () => {
        if (xhr.readyState === 4) {
          const hooker: CycleScheduler = xhr[CYCLE_SCHEDULER];
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
          for (let val of hooker.request.response) {
            await val(hooker.resp);
          }
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
        set(target: XMLHttpRequest, prop: string, value) {
          if (prop === 'onreadystatechange' || prop === 'onload') {
            target[prop] = function (...args) {
              (async () => {
                if (target.readyState === 4) {
                  const hooker: CycleScheduler = target[CYCLE_SCHEDULER];
                  hooker.xhrAlreadyReturned = true;
                  hooker.resp = {
                    status: target.status,
                    statusText: target.statusText,
                    response: target.response,
                    responseText:
                      target.responseType === 'text' ||
                      target.responseType === ''
                        ? target.responseText
                        : null,
                    responseXML:
                      target.responseType === 'document' ||
                      target.responseType === ''
                        ? target.responseXML
                        : null,
                    responseType: target.responseType,
                  };
                  for (let val of hooker.request.response) {
                    await val(hooker.resp);
                  }
                }
                target[prop].apply(target, args);
              })();
            };
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
    return proxyXhr;
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
    'url',
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
  _generateProxyFetch() {
    const self = this;

    this.fetchInstanceAttrHandler = this.fetchInstanceAttr
      .map((attr) => {
        return {
          name: attr,
          handler: function (self, target) {
            const hooker = target[CYCLE_SCHEDULER];
            return hooker.resp[attr];
          },
        };
      })
      .reduce((acc, curr) => {
        acc[curr.name] = curr.handler;
        return acc;
      }, {});

    this.fetchMethodsHandler = this.fetchMethods
      .map((method) => {
        return {
          name: method,
          handler: function (self, target) {
            return async function (...args) {
              const hooker: CycleScheduler = target[CYCLE_SCHEDULER];
              const result = await target[method].apply(target, args);

              console.log(`%c fetch Result ${method}`, 'color: purple', result);
              hooker.resp.bodyUsed = hooker.fetchBodyUsed = true;
              hooker.resp[method] = result;
              if (hooker.request.url.includes?.('v1/nex')) {
                console.log('123');
              }
              for (let val of hooker.request.response) {
                await val(hooker.resp);
              }
              return hooker.resp[method];
            };
          },
        };
      })
      .reduce((acc, curr) => {
        acc[curr.name] = curr.handler;
        return acc;
      }, {});
    async function proxyFetch(url: string, options: RequestInit = {}) {
      const winFetch = self.nativeFetch;
      const hooker = new CycleScheduler();
      const newRequest = await hooker.execute(
        {
          type: AJAX_TYPE.FETCH,
          url,
          method: options.method,
          headers: options.headers as Record<string, string>,
          body: options.body,
          response: [],
        },
        self.hooks
      );
      hooker.request = newRequest;
      const fh: Response = await winFetch(newRequest.url, {
        ...options,
        ...(newRequest.headers ? { headers: newRequest.headers } : {}),
        ...(newRequest.body ? { body: newRequest.body as BodyInit } : {}),
        ...(newRequest.method ? { method: newRequest.method } : {}),
      });

      hooker.resp = {
        status: fh.status,
        statusText: fh.statusText,
        ok: fh.ok,
        headers: fh.headers,
        url: fh.url,
        redirected: fh.redirected,
        bodyUsed: hooker.fetchBodyUsed,
      };
      for (let val of hooker.request.response) {
        await val(hooker.resp);
      }
      fh[CYCLE_SCHEDULER] = hooker;
      const proxyFh = new Proxy(fh, {
        get(target, prop) {
          const perhapsHandler =
            self.fetchInstanceAttrHandler[prop]?.(self, target) ||
            self.fetchMethodsHandler[prop]?.(self, target);
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
  public request: AjaxInterceptorRequest = {} as AjaxInterceptorRequest;
  public resp: AjaxResponse = {} as AjaxResponse;
  public xhrOpenRestArgs: (string | boolean | URL)[] = [];
  public xhrSetRequestAfterOpen: Record<string, string[]> = {};
  public xhrAlreadyReturned = false;
  public fetchBodyUsed = false;
  constructor({
    request = {} as AjaxInterceptorRequest,
  }: {
    request?: AjaxInterceptorRequest;
  } = {}) {
    this.request = request;
  }
  xhrReset() {
    this.request = {} as AjaxInterceptorRequest;
    this.resp = {} as AjaxResponse;
    this.xhrOpenRestArgs = [];
    this.xhrSetRequestAfterOpen = {};
    this.xhrAlreadyReturned = false;
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
let count = 0;
ajaxInterceptor.hook((request: AjaxInterceptorRequest) => {
  request.response.push((response: AjaxResponse) => {});
  return request;
});

export default AjaxInterceptor;

import { CycleScheduler } from './common';
import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';
import { AjaxInterceptorRequest, AjaxResponse, HookFunction } from './type';
import {
  copyNativePropsAndPrototype,
  getProxyValue,
  getType,
  resolveUrl,
} from './utils';

export class XhrInterceptor {
  // ---- public 属性 ----
  public readonly nativeXhr = window.XMLHttpRequest;
  public readonly nativeXhrPrototype = window.XMLHttpRequest.prototype;
  public hooks: HookFunction[] = [];

  // ---- private 属性 ----
  private xhrResponseEvents = ['readystatechange', 'load', 'loadend'];
  private xhrInstanceAttr = [
    'response',
    'responseText',
    'responseXML',
    'status',
    'statusText',
  ];
  private xhrInstanceAttrHandler = this.xhrInstanceAttr.reduce(
    (acc, attr) => {
      acc[attr] = function (target: XMLHttpRequest) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        return hooker.xhrAlreadyReturned ? hooker.resp[attr] : target[attr];
      };
      return acc;
    },
    {} as Record<string, Function>,
  );
  private xhrMethodsHandler = {
    open: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (...args: Parameters<XMLHttpRequest['open']>) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        hooker.xhrReset();
        hooker.req = {
          type: AJAX_TYPE.XHR,
          method: args[0] || 'GET',
          url: resolveUrl(args[1]),
          headers: new Headers(),
          data: null,
          response: () => {},
        };
        hooker.xhrOpenRestArgs = args.slice(2);
        self.nativeXhrPrototype.open.apply(target, [
          hooker.req.method,
          hooker.req.url,
          ...(hooker.xhrOpenRestArgs || []),
        ]);
      };
    },
    send: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return async function (body: Parameters<XMLHttpRequest['send']>[0]) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        hooker.req.data = body ?? null;
        hooker.req.responseType = target.responseType;
        hooker.req.withCredentials = target.withCredentials;
        hooker.req.timeout = target.timeout;
        hooker.req.headers = new Headers(hooker.xhrSetRequestHeadersAfterOpen);
        const oldRequest = hooker.req;
        let newRequest = {
          ...hooker.req,
          headers: new Headers(hooker.req.headers),
        };
        try {
          newRequest = await hooker.execute(newRequest, self.hooks);
        } catch (error) {
          console.warn('[AjaxInterceptor] Error in xhr request hooks:', error);
        }
        hooker.req = newRequest;

        const needReopen =
          oldRequest.method !== newRequest.method ||
          oldRequest.url !== newRequest.url;

        // 1. reopen
        if (needReopen) {
          self.nativeXhrPrototype.open.apply(target, [
            hooker.req.method,
            hooker.req.url,
            ...(hooker.xhrOpenRestArgs || []),
          ]);
        }

        // 2. 应用钩子修改的 XHR 属性
        const xhrProps = ['responseType', 'withCredentials', 'timeout'];
        for (const prop of xhrProps) {
          if (newRequest[prop] !== oldRequest[prop]) {
            target[prop] = newRequest[prop];
          }
        }

        // 3. headers
        if (
          needReopen ||
          !self.headersEqual(oldRequest.headers, newRequest.headers)
        ) {
          hooker.req.headers.forEach((val, key) => {
            target.setRequestHeader(key, val);
          });
        }

        // 4. send
        self.nativeXhrPrototype.send.apply(target, [hooker.req.data]);
      };
    },
    setRequestHeader: function (self: XhrInterceptor, target: XMLHttpRequest) {
      return function (name: string, value: string) {
        const hooker: XhrCycleScheduler = target[CYCLE_SCHEDULER];
        self.nativeXhrPrototype.setRequestHeader.apply(target, [name, value]);
        hooker.xhrSetRequestHeadersAfterOpen.append(name, value);
      };
    },
    addEventListener: function (
      self: XhrInterceptor,
      target: XMLHttpRequest,
      receiver: any,
    ) {
      return function (type: string, listener: EventListener, ...args: any[]) {
        const isResponseEvent = self.xhrResponseEvents.includes(type);
        const newListener = async function (...args) {
          if (isResponseEvent && target.readyState === 4) {
            await self.responseProcessor(target);
          }
          Reflect.apply(listener, receiver, args);
        };
        target.addEventListener(type, newListener, ...args);
      };
    },
  };

  constructor() {}

  // ---- public 方法 ----
  public inject() {
    window.XMLHttpRequest = this._generateProxyXMLHttpRequest();
  }
  public uninject() {
    window.XMLHttpRequest = this.nativeXhr;
  }

  // ---- private 方法 ----
  private parseHeaders(
    obj: string | Headers | Record<string, string> | null | undefined,
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
      await hooker.req.response(hooker.resp);
    } catch (error) {
      console.warn('[AjaxInterceptor] Error in xhr response callback:', error);
    }
  }
  private headersEqual(a: Headers, b: Headers) {
    if (a === b) return true;
    const toSortedString = (h: Headers) => {
      const arr: string[] = [];
      h.forEach((v, k) => arr.push(`${k}: ${v}`));
      return arr.sort().toString();
    };
    return toSortedString(a) === toSortedString(b);
  }
  private getAttrHandler(target: XMLHttpRequest, attr: string, receiver?: any) {
    if (this.xhrInstanceAttr.includes(attr)) {
      return this.xhrInstanceAttrHandler[attr](target);
    }
    if (this.xhrMethodsHandler[attr]) {
      return this.xhrMethodsHandler[attr](this, target, receiver);
    }
    return null;
  }
  private _generateProxyXMLHttpRequest() {
    const self = this;
    function proxyXhr() {
      const xhr = new self.nativeXhr();
      xhr[CYCLE_SCHEDULER] = new XhrCycleScheduler();

      const proxyXhr = new Proxy(xhr, {
        get(target, prop: string, receiver) {
          return (
            self.getAttrHandler(target, prop, receiver) ??
            getProxyValue(target, prop)
          );
        },
        set(target: XMLHttpRequest, prop: string, value, receiver) {
          if (typeof value === 'function' && prop.startsWith('on')) {
            const isResponseEvent = self.xhrResponseEvents.includes(
              prop.replace(/^on/, ''),
            );
            const fn = async function (...args) {
              if (isResponseEvent && target.readyState === 4) {
                await self.responseProcessor(target);
              }
              Reflect.apply(value, receiver, args);
            };
            return Reflect.set(target, prop, fn);
          }
          return Reflect.set(target, prop, value);
        },
      });

      return proxyXhr;
    }
    copyNativePropsAndPrototype({
      source: self.nativeXhr,
      target: proxyXhr,
      prototype: this.nativeXhrPrototype,
    });
    return proxyXhr as unknown as typeof XMLHttpRequest;
  }
}

class XhrCycleScheduler extends CycleScheduler {
  public xhrAlreadyReturned = false;
  public xhrOpenRestArgs: (string | boolean | URL)[] = [];
  public xhrSetRequestHeadersAfterOpen: Headers = new Headers();
  public xhrReset() {
    this.req = {} as AjaxInterceptorRequest;
    this.resp = {} as AjaxResponse;
    this.xhrOpenRestArgs = [];
    this.xhrSetRequestHeadersAfterOpen = new Headers();
    this.xhrAlreadyReturned = false;
  }
  constructor({
    req = {} as AjaxInterceptorRequest,
  }: {
    req?: AjaxInterceptorRequest;
  } = {}) {
    super({ req });
  }
}

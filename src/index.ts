import { AjaxHookerRequest, AjaxResponse } from "./type";

class AjaxHooker {
  public hooks: Function[] = [];
  public request: AjaxHookerRequest = {} as AjaxHookerRequest;
  public resp: AjaxResponse = {} as AjaxResponse;
  public xhrOpenRestArgs: (string | boolean | URL)[] = [];
  public xhrSetRequestAfterOpen = new Map<string, string[]>();
  constructor({
    hooks,
    request,
  }: {
    hooks: Function[];
    request?: AjaxHookerRequest;
  }) {
    this.hooks = hooks;
    this.request = request;
  }
  addHook(fn: Function): void {
    this.hooks.push(fn);
  }

  async execute(request: AjaxHookerRequest) {
    let result = request;
    for (const fn of this.hooks) {
      const newResult = await fn(result);
      if (newResult) {
        result = newResult;
      }
    }
    return result;
  }
}
class AjaxInterceptor {
  private readonly nativeXhr = window.XMLHttpRequest;
  private readonly nativeFetch = window.fetch;
  private readonly nativeXhrPrototype = this.nativeXhr.prototype;
  private readonly nativeFetchPrototype = this.nativeFetch.prototype;
  private static instance: AjaxInterceptor;
  private readonly hooks: Function[] = [];
  private readonly hookSymbol = Symbol("AjaxHooker");
  private readonly xhrMethods = [
    "open",
    "send",
    "setRequestHeader",
    "getResponseHeader",
    "getAllResponseHeaders",
    "abort",
    "overrideMimeType",
    "upload",
    "onreadystatechange",
    "onerror",
    "onload",
    "onprogress",
    "onabort",
    "ontimeout",
    "onreadystatechange",
    "onerror",
    "onload",
    "onprogress",
    "onabort",
    "ontimeout",
  ];
  private readonly xhrInstanceAttr = [
    "response",
    "responseText",
    "responseXML",
    "status",
    "statusText",
  ];
  private readonly fetchMethods = [
    "fetch",
    "headers",
    "body",
    "method",
    "mode",
  ];
  private readonly fetchInstanceAttr = ["headers", "body", "method", "mode"];

  private xhrMethodsHandler = {
    open: function (self: AjaxInterceptor, target: XMLHttpRequest) {
      return function (...args: Parameters<XMLHttpRequest["open"]>) {
        const hooker: AjaxHooker = target[self.hookSymbol];
        hooker.request = {
          type: "XHR",
          method: args[0],
          url: args[1],
          async: args[2],
          headers: {},
          body: null,
          response: () => {},
        };
        hooker.xhrOpenRestArgs = args.slice(3);
        self.nativeXhrPrototype.open.apply(target, [
          hooker.request.method,
          hooker.request.url,
          hooker.request.async,
          ...hooker.xhrOpenRestArgs,
        ]);
      };
    },
    send: function (self: AjaxInterceptor, target: XMLHttpRequest) {
      return async function (body: Parameters<XMLHttpRequest["send"]>) {
        const hooker: AjaxHooker = target[self.hookSymbol];
        hooker.request.body = body ?? null;
        const oldRequest = Object.assign({}, hooker.request);
        await hooker.execute(hooker.request);

        if (
          oldRequest.method !== hooker.request.method ||
          oldRequest.url !== hooker.request.url ||
          oldRequest.async !== hooker.request.async
        ) {
          self.nativeXhrPrototype.open.apply(target, [
            hooker.request.method,
            hooker.request.url,
            hooker.request.async,
            ...hooker.xhrOpenRestArgs,
          ]);
          for (let [key, val] of hooker.xhrSetRequestAfterOpen) {
            target.setRequestHeader(key, val.join(","));
          }
        }

        self.nativeXhrPrototype.send.apply(target, [hooker.request.body]);
      };
    },
    setRequestHeader: function (self: AjaxInterceptor, target: XMLHttpRequest) {
      return function (name: string, value: string) {
        const hooker: AjaxHooker = target[self.hookSymbol];
        // 先调用“原生”，成功后再缓存，确保与浏览器限制一致（某些禁止头会被拒）
        self.nativeXhrPrototype.setRequestHeader.call(target, name, value);

        const key = name.toLowerCase();
        const headers = hooker.xhrSetRequestAfterOpen.get(key) ?? [];
        headers.push(value);
        hooker.xhrSetRequestAfterOpen.set(key, headers);
      };
    },
  };
  private xhrInstanceAttrHandler = {};

  private fetchMethodsHandler = {};
  private constructor() {}
  static getInstance() {
    if (!AjaxInterceptor.instance) {
      AjaxInterceptor.instance = new AjaxInterceptor();
    }
    return AjaxInterceptor.instance;
  }
  _generateProxyXMLHttpRequest() {
    const self = this;
    this.xhrInstanceAttrHandler = this.xhrInstanceAttr
      .map((attr) => {
        return {
          name: attr,
          handler: function (self, target) {
            const hooker = target[self.hookSymbol];
            hooker.request.response(hooker.resp);
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
      xhr[self.hookSymbol] = new AjaxHooker({
        hooks: self.hooks.slice(),
      });

      const proxyXhr = new Proxy(xhr, {
        get(target, prop: string) {
          const perhapsHandler =
            self.xhrMethodsHandler[prop]?.(self, target) ||
            self.xhrInstanceAttrHandler[prop]?.(self, target);
          if (perhapsHandler) {
            return perhapsHandler;
          }
          if (typeof target[prop] === "function") {
            return function (...args) {
              return target[prop].apply(target, args);
            };
          }
          return Reflect.get(target, prop);
        },
        set(target, prop: string, value) {
          const hooker = target[self.hookSymbol];
          if (prop === "onload") {
            target[prop] = function (...args) {
              hooker.resp = {
                status: target.status,
                statusText: target.statusText,
                response: target.response,
                responseText: target.responseText,
                responseXML: target.responseXML,
              };
              value(...args);
            };
            return true;
          }
          if (prop === "onreadystatechange") {
            target[prop] = function (...args) {
              if (target.readyState === 4) {
                hooker.resp = {
                  status: target.status,
                  statusText: target.statusText,
                  response: target.response,
                  responseText: target.responseText,
                  responseXML: target.responseXML,
                };
                value(...args);
              }
            };
            return true;
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
  _generateProxyFetch() {
    function proxyFetch(url: string, options: RequestInit) {
      return this.nativeFetch(url, options);
    }
    proxyFetch.prototype = this.nativeFetchPrototype;
    return proxyFetch;
  }
  inject() {
    window.XMLHttpRequest = this._generateProxyXMLHttpRequest() as any;
    console.log("注入成功");
    // window.fetch = this._generateProxyFetch() as any;
  }
  uninject() {}
  hook(fn: Function) {
    this.hooks.push(fn);
  }
}

const ajaxInterceptor = AjaxInterceptor.getInstance();
ajaxInterceptor.inject();
ajaxInterceptor.hook((request: AjaxHookerRequest) => {
  console.log("hook", request.url);
  if (request.url === "/api/outer/ats-apply/website/jobs/v2") {
    const body = JSON.parse(request.body as string);
    body.keyword = "后端";
    request.body = JSON.stringify(body);
  }
  request.response = (response: AjaxResponse) => {
    if (request.url === "/portal/searchHome") {
      const result = JSON.parse(response.responseText as string);
      result.result.data.children = result.result.data.children.slice(0, 2);
      response.responseText = JSON.stringify(result);
    }
  };
  return request;
});
export default AjaxInterceptor;

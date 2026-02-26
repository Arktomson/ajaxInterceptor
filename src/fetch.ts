import { CycleScheduler } from './common';
import { AjaxInterceptorRequest, HookFunction } from './type';
import {
  copyNativePropsAndPrototype,
  getProxyValue,
  resolveUrl,
} from './utils';
import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';

type PropertySource = 'request' | 'options' | 'default';

interface SourceMap {
  method: PropertySource;
  headers: PropertySource;
  data: PropertySource;
}

class FetchCycleScheduler extends CycleScheduler {
  constructor({
    req = {} as AjaxInterceptorRequest,
  }: {
    req?: AjaxInterceptorRequest;
  } = {}) {
    super({ req });
  }
}

export class FetchInterceptor {
  // ---- public 属性 ----
  public readonly nativeFetch = window.fetch;
  public readonly nativeFetchPrototype = this.nativeFetch.prototype;
  public hooks: HookFunction[] = [];

  // ---- private 属性 ----
  private fetchInstanceAttr = [
    'status',
    'statusText',
    'ok',
    'headers',
    'redirected',
  ];
  private fetchInstanceAttrHandler = this.fetchInstanceAttr.reduce(
    (acc, attr) => {
      acc[attr] = function (self, target) {
        const hooker = target[CYCLE_SCHEDULER];
        return hooker.resp[attr];
      };
      return acc;
    },
    {} as Record<string, Function>,
  );
  private fetchMethods = ['json', 'formData', 'blob', 'arrayBuffer', 'text'];
  private fetchMethodsHandler = this.fetchMethods.reduce(
    (acc, methodName) => {
      acc[methodName] = function (self, target) {
        return async function (...args) {
          const hooker: FetchCycleScheduler = target[CYCLE_SCHEDULER];
          return hooker.resp[methodName];
        };
      };
      return acc;
    },
    {} as Record<string, Function>,
  );

  constructor() {}

  // ---- public 方法 ----
  public inject() {
    window.fetch = this._generateProxyFetch();
  }
  public uninject() {
    window.fetch = this.nativeFetch;
  }

  // ---- private 方法 ----
  private getAttrHandler(target: Response, attr: string) {
    if (this.fetchInstanceAttr.includes(attr)) {
      return this.fetchInstanceAttrHandler[attr](this, target);
    }
    if (this.fetchMethodsHandler[attr]) {
      return this.fetchMethodsHandler[attr](this, target);
    }
    return null;
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
    newRequest: AjaxInterceptorRequest,
    sourceMap: SourceMap,
  ): string | URL | Request {
    const urlChanged =
      (typeof req === 'string' && newRequest.url !== req) ||
      (req instanceof URL && newRequest.url !== req.href) ||
      (req instanceof Request && newRequest.url !== req.url);

    if (typeof req === 'string') {
      return urlChanged ? newRequest.url : req;
    }
    if (req instanceof URL) {
      return urlChanged ? new URL(newRequest.url) : req;
    }
    if (req instanceof Request) {
      const needsNewRequest =
        urlChanged ||
        (sourceMap.method === 'request' && newRequest.method !== req.method) || // 原始 method 在 request 里，但被修改了
        (sourceMap.headers === 'request' &&
          newRequest.headers !== req.headers) || // headers 被修改
        (sourceMap.data === 'request' && newRequest.data !== req.body); // body 被修改

      if (needsNewRequest) {
        const methodChanged = sourceMap.method === 'request' && newRequest.method !== req.method;
        const headersChanged = sourceMap.headers === 'request' && newRequest.headers !== req.headers;
        const bodyChanged = sourceMap.data === 'request' && newRequest.data !== req.body;

        return new Request(urlChanged ? newRequest.url : req, {
          ...(methodChanged && { method: newRequest.method }),
          ...(headersChanged && { headers: newRequest.headers }),
          ...(bodyChanged && { body: newRequest.data as BodyInit }),
        });
      }
      return req;
    }
    return req;
  }
  private resolveOptions({
    options,
    newRequest,
    sourceMap,
  }: {
    options?: RequestInit;
    newRequest: AjaxInterceptorRequest;
    sourceMap: SourceMap;
  }) {
    // 保留非拦截属性（credentials, signal, mode, cache 等）
    const { method: _, headers: __, body: ___, ...rest } = options || {};
    const resolved: RequestInit = { ...rest };

    // method: 来自 options → 始终写入 init；来自 default 且被修改 → 写入 init
    if (
      sourceMap.method === 'options' ||
      (sourceMap.method === 'default' &&
        newRequest.method !== (options?.method ?? 'GET'))
    ) {
      resolved.method = newRequest.method;
    }

    // headers: 来自 options → 始终写入 init；来自 default 且被修改 → 写入 init
    if (sourceMap.headers === 'options') {
      resolved.headers = newRequest.headers;
    } else if (sourceMap.headers === 'default') {
      let isHeadersEmpty = true;
      if (newRequest.headers instanceof Headers) {
        let count = 0;
        newRequest.headers.forEach(() => {
          count++;
        });
        isHeadersEmpty = count === 0;
      } else if (newRequest.headers) {
        isHeadersEmpty = Object.keys(newRequest.headers).length === 0;
      }
      if (!isHeadersEmpty) {
        resolved.headers = newRequest.headers;
      }
    }

    // body/data: 来自 options → 始终写入 init；来自 default 且被修改 → 写入 init
    if (
      sourceMap.data === 'options' ||
      (sourceMap.data === 'default' &&
        newRequest.data !== (options?.body ?? null))
    ) {
      resolved.body = newRequest.data as BodyInit;
    }

    if (newRequest.data instanceof ReadableStream) {
      (resolved as any).duplex = 'half';
    }

    return resolved;
  }
  private resolveHeaders(headers: HeadersInit): Headers {
    if (headers instanceof Headers) {
      return headers;
    }
    return new Headers(headers);
  }
  private _generateProxyFetch() {
    const self = this;

    async function proxyFetch(
      req: string | URL | Request,
      options: RequestInit = {},
    ) {
      const request = self.normalizeRequest(req);
      const winFetch = self.nativeFetch;
      const hooker = new FetchCycleScheduler();

      // 追踪每个属性的来源
      const sourceMap: SourceMap = {
        method: 'default',
        headers: 'default',
        data: 'default',
      };

      // Request 对象上的属性
      if (req instanceof Request) {
        sourceMap.method = 'request';
        sourceMap.headers = 'request';
        if (req.body !== null) sourceMap.data = 'request';
      }

      // options 中的属性（优先级更高，覆盖 Request）
      if (options.method !== undefined) sourceMap.method = 'options';
      if (options.headers !== undefined) sourceMap.headers = 'options';
      if (options.body !== undefined) sourceMap.data = 'options';

      const originalRequest: AjaxInterceptorRequest = {
        type: AJAX_TYPE.FETCH,
        url: request.url,
        method: options.method ?? request.method ?? 'GET',
        headers: self.resolveHeaders(
          options.headers ?? request.headers ?? new Headers(),
        ),
        data: options.body ?? request.data ?? null,
        response: () => {},
      };



      let newRequest = originalRequest;
      try {
        newRequest = await hooker.execute(originalRequest, self.hooks);
      } catch (error) {
        console.warn('[AjaxInterceptor] Error in fetch request hooks:', error);
      }

      hooker.req = newRequest;

      const fh: Response = await winFetch(
        self.resolveRequest(req, newRequest, sourceMap),
        self.resolveOptions({ options, newRequest, sourceMap }),
      );

      // 检测是否为流式响应
      const contentType = fh.headers.get('content-type') || '';
      const isStreamResponse =
        contentType.includes('text/event-stream') ||
        contentType.includes('application/stream+json') ||
        contentType.includes('application/x-ndjson') ||
        contentType.includes('application/jsonl') ||
        contentType.includes('application/json-seq');

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
          await hooker.req.response(hooker.resp);
        } catch (error) {
          console.warn('[AjaxInterceptor] Error in fetch stream response callback:', error);
        }

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
              if (hooker.req.onStreamChunk) {
                const streamChunk = {
                  text,
                  raw: chunk,
                  index: chunkIndex++,
                  timestamp: Date.now(),
                };

                const result = await hooker.req.onStreamChunk(streamChunk);
                // 如果钩子返回了新文本，使用新文本；否则使用原文本
                if (typeof result === 'string') {
                  modifiedText = result;
                }
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
              result.status === 'fulfilled' ? result.value : null,
            ),
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
          await hooker.req.response(hooker.resp);
        } catch (error) {
          console.warn('[AjaxInterceptor] Error in fetch response callback:', error);
        }
      }

      interceptedResponse[CYCLE_SCHEDULER] = hooker;
      const proxyFh = new Proxy(interceptedResponse, {
        get(target, prop) {
          const attrHandler = self.getAttrHandler(target, prop as string);
          if (attrHandler) {
            return attrHandler;
          }
          return getProxyValue(target, prop);
        },
        set(target, prop, value) {
          return Reflect.set(target, prop, value);
        },
      });
      return proxyFh;
    }
    copyNativePropsAndPrototype({
      source: this.nativeFetch,
      target: proxyFetch,
      prototype: this.nativeFetchPrototype,
    });
    return proxyFetch;
  }
}

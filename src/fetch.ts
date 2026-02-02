import { CycleScheduler } from './common';
import { AjaxInterceptorRequest, HookFunction } from './type';
import {
  copyNativePropsAndPrototype,
  getProxyValue,
  resolveUrl,
} from './utils';
import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';
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
  ): string | URL | Request {
    if (typeof req === 'string') {
      return newRequest.url;
    }
    if (req instanceof URL) {
      return new URL(newRequest.url);
    }
    if (req instanceof Request) {
      return new Request(newRequest.url, req);
    }
    return req;
  }
  private resolveOptions({
    options,
    newRequest,
  }: {
    options?: RequestInit;
    newRequest: AjaxInterceptorRequest;
  }) {
    const streamOptions = {
      duplex: 'half',
    };
    return {
      ...options,
      headers: newRequest.headers,
      body: newRequest.data as BodyInit,
      method: newRequest.method,
      ...(newRequest.data instanceof ReadableStream ? streamOptions : {}),
    };
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

      let newRequest = request as AjaxInterceptorRequest;
      try {
        newRequest = await hooker.execute(
          {
            type: AJAX_TYPE.FETCH,
            url: request.url,
            method: options.method ?? request.method ?? 'GET',
            headers: self.resolveHeaders(
              options.headers ?? request.headers ?? new Headers(),
            ),
            data: options.body ?? request.data ?? null,
            response: () => {},
          },
          self.hooks,
        );
      } catch (error) {
        console.warn('[AjaxInterceptor] Error in fetch request hooks:', error);
      }

      hooker.req = newRequest;

      const fh: Response = await winFetch(
        self.resolveRequest(req, newRequest),
        self.resolveOptions({ options, newRequest }),
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

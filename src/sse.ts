import { CycleScheduler } from './common';
import { AJAX_TYPE, CYCLE_SCHEDULER } from './constant';
import { AjaxInterceptorRequest, HookFunction, StreamChunk } from './type';
import { copyNativePropsAndPrototype, resolveUrl } from './utils';

class SseCycleScheduler extends CycleScheduler {
  constructor({
    req = {} as AjaxInterceptorRequest,
  }: {
    req?: AjaxInterceptorRequest;
  } = {}) {
    super({ req });
  }
}

export class EventSourceInterceptor {
  // ---- public 属性 ----
  public readonly nativeEventSource = window.EventSource;
  public readonly nativeEventSourcePrototype =
    this.nativeEventSource?.prototype;
  public hooks: HookFunction[] = [];

  constructor() {}

  // ---- public 方法 ----
  public inject() {
    if (!this.nativeEventSource) return;
    window.EventSource = this._generateProxyEventSource();
  }
  public uninject() {
    if (!this.nativeEventSource) return;
    window.EventSource = this.nativeEventSource;
  }

  // ---- private 方法 ----
  private async processStreamChunk(
    data: string,
    hooker: SseCycleScheduler,
    getNextIndex: () => number,
  ): Promise<string> {
    const text = typeof data === 'string' ? data : String(data);
    const encoder = new TextEncoder();

    const chunk: StreamChunk = {
      text,
      raw: encoder.encode(text),
      index: getNextIndex(),
      timestamp: Date.now(),
    };

    try {
      const result = await hooker.req.onStreamChunk!(chunk);
      if (typeof result === 'string') {
        return result;
      }
    } catch (error) {
      console.warn(
        '[AjaxInterceptor] Error in sse stream chunk callback:',
        error,
      );
    }

    return text;
  }

  private wrapMessageListener(
    listener: EventListenerOrEventListenerObject,
    hooker: SseCycleScheduler,
    getNextIndex: () => number,
  ): EventListener {
    const self = this;
    return async function (event: MessageEvent) {
      const modifiedData = await self.processStreamChunk(
        event.data,
        hooker,
        getNextIndex,
      );
      const newEvent = new MessageEvent(event.type, {
        data: modifiedData,
        origin: event.origin,
        lastEventId: event.lastEventId,
      });
      if (typeof listener === 'function') {
        listener(newEvent);
      } else {
        listener.handleEvent(newEvent);
      }
    };
  }

  private createWrappedOnHandler(
    handler: (ev: MessageEvent) => any,
    hooker: SseCycleScheduler,
    getNextIndex: () => number,
  ): (ev: MessageEvent) => void {
    const self = this;
    return async function (event: MessageEvent) {
      const modifiedData = await self.processStreamChunk(
        event.data,
        hooker,
        getNextIndex,
      );
      const newEvent = new MessageEvent(event.type, {
        data: modifiedData,
        origin: event.origin,
        lastEventId: event.lastEventId,
      });
      handler.call(null, newEvent);
    };
  }

  private _generateProxyEventSource() {
    const self = this;

    function ProxyEventSource(
      url: string | URL,
      eventSourceInitDict?: EventSourceInit,
    ) {
      const hooker = new SseCycleScheduler();
      let chunkIndex = 0;

      const initialRequest: AjaxInterceptorRequest = {
        type: AJAX_TYPE.SSE,
        method: 'GET',
        url: resolveUrl(url),
        headers: new Headers(),
        data: null,
        withCredentials: eventSourceInitDict?.withCredentials ?? false,
        response: () => {},
      };

      // 真实 EventSource（异步创建）
      let realEventSource: EventSource | null = null;

      // pending 缓冲队列：在真实实例创建前缓存用户操作
      const pendingListeners: Array<{
        type: string;
        listener: EventListenerOrEventListenerObject;
        options?: boolean | AddEventListenerOptions;
      }> = [];
      const pendingOnHandlers: Record<string, any> = {};
      let pendingClose = false;

      // 异步执行 hooks 链，然后创建真实 EventSource
      (async () => {
        let newRequest = initialRequest;
        try {
          newRequest = await hooker.execute(initialRequest, self.hooks);
        } catch (error) {
          console.warn(
            '[AjaxInterceptor] Error in sse request hooks:',
            error,
          );
        }
        hooker.req = newRequest;

        if (pendingClose) return;

        realEventSource = new self.nativeEventSource(newRequest.url, {
          withCredentials: newRequest.withCredentials ?? false,
        });

        // 设置响应信息
        hooker.resp = {
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          finalUrl: newRequest.url,
        };

        try {
          await hooker.req.response(hooker.resp);
        } catch (error) {
          console.warn(
            '[AjaxInterceptor] Error in sse response callback:',
            error,
          );
        }

        // 转移缓存的 onxxx handler
        const hasStreamChunk = !!hooker.req.onStreamChunk;
        for (const [eventName, handler] of Object.entries(pendingOnHandlers)) {
          if (handler == null) continue;
          if (eventName === 'message' && hasStreamChunk) {
            realEventSource[`on${eventName}`] = self.createWrappedOnHandler(
              handler,
              hooker,
              () => chunkIndex++,
            );
          } else {
            realEventSource[`on${eventName}`] = handler;
          }
        }

        // 转移缓存的 addEventListener
        for (const { type, listener, options } of pendingListeners) {
          if (type === 'message' && hasStreamChunk) {
            realEventSource.addEventListener(
              type,
              self.wrapMessageListener(listener, hooker, () => chunkIndex++),
              options,
            );
          } else {
            realEventSource.addEventListener(type, listener, options);
          }
        }
      })();

      // 构造 proxy 对象，模拟 EventSource 接口
      const proxy = Object.create(self.nativeEventSourcePrototype);

      Object.defineProperties(proxy, {
        url: {
          get() {
            return realEventSource?.url ?? resolveUrl(url);
          },
          enumerable: true,
          configurable: true,
        },
        readyState: {
          get() {
            return realEventSource?.readyState ?? EventSource.CONNECTING;
          },
          enumerable: true,
          configurable: true,
        },
        withCredentials: {
          get() {
            return (
              realEventSource?.withCredentials ??
              (eventSourceInitDict?.withCredentials ?? false)
            );
          },
          enumerable: true,
          configurable: true,
        },
        CONNECTING: { value: 0, enumerable: true },
        OPEN: { value: 1, enumerable: true },
        CLOSED: { value: 2, enumerable: true },
      });

      // 代理 onopen / onmessage / onerror
      const eventNames = ['open', 'message', 'error'];
      for (const eventName of eventNames) {
        Object.defineProperty(proxy, `on${eventName}`, {
          get() {
            if (realEventSource) {
              return realEventSource[`on${eventName}`];
            }
            return pendingOnHandlers[eventName] ?? null;
          },
          set(handler) {
            if (realEventSource) {
              if (
                eventName === 'message' &&
                hooker.req.onStreamChunk &&
                handler
              ) {
                realEventSource.onmessage = self.createWrappedOnHandler(
                  handler,
                  hooker,
                  () => chunkIndex++,
                );
              } else {
                realEventSource[`on${eventName}`] = handler;
              }
            } else {
              pendingOnHandlers[eventName] = handler;
            }
          },
          configurable: true,
          enumerable: true,
        });
      }

      proxy.close = function () {
        if (realEventSource) {
          realEventSource.close();
        } else {
          pendingClose = true;
        }
      };

      proxy.addEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (realEventSource) {
          if (type === 'message' && hooker.req.onStreamChunk) {
            realEventSource.addEventListener(
              type,
              self.wrapMessageListener(listener, hooker, () => chunkIndex++),
              options,
            );
          } else {
            realEventSource.addEventListener(type, listener, options);
          }
        } else {
          pendingListeners.push({ type, listener, options });
        }
      };

      proxy.removeEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
      ) {
        realEventSource?.removeEventListener(type, listener, options);
      };

      proxy.dispatchEvent = function (event: Event) {
        return realEventSource?.dispatchEvent(event) ?? false;
      };

      proxy[CYCLE_SCHEDULER] = hooker;

      return proxy;
    }

    copyNativePropsAndPrototype({
      source: self.nativeEventSource as any,
      target: ProxyEventSource as any,
      prototype: self.nativeEventSourcePrototype,
    });

    (ProxyEventSource as any).CONNECTING = 0;
    (ProxyEventSource as any).OPEN = 1;
    (ProxyEventSource as any).CLOSED = 2;

    return ProxyEventSource as unknown as typeof EventSource;
  }
}

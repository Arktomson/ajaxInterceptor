import { describe, expect, it, vi } from 'vitest';
import AjaxHooker, { AjaxInterceptor } from '../src/index';
import { AjaxInterceptor as InterceptorCtor } from '../src/interceptor';
import {
  copyNativePropsAndPrototype,
  getProxyValue,
  getType,
  resolveUrl,
  safeStringify,
  sleep,
} from '../src/utils';

describe('Index exports', () => {
  it('default export and named export should be the same class', () => {
    expect(AjaxHooker).toBe(AjaxInterceptor);
  });
});

describe('Interceptor API branches', () => {
  it('should hook and unhook fetch-only hooks', () => {
    const fn = vi.fn((request) => request);

    interceptor.hook(fn, 'fetch');
    expect(interceptor.fetchInterceptor.hooks).toContain(fn);
    expect(interceptor.xhrInterceptor.hooks).not.toContain(fn);

    interceptor.unhook(fn, 'fetch');
    expect(interceptor.fetchInterceptor.hooks).not.toContain(fn);
  });

  it('unhook with non-existing fn should keep hooks unchanged', () => {
    const existing = vi.fn((request) => request);
    const missing = vi.fn((request) => request);

    interceptor.hook(existing, 'xhr');
    const before = interceptor.xhrInterceptor.hooks.length;

    interceptor.unhook(missing, 'xhr');
    expect(interceptor.xhrInterceptor.hooks.length).toBe(before);
    expect(interceptor.xhrInterceptor.hooks).toContain(existing);
  });

  it('should warn when browser APIs are missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalFetch = window.fetch;
    const originalXhr = window.XMLHttpRequest;

    Object.defineProperty(window, 'fetch', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    interceptor.inject('xhr');
    expect(warnSpy).toHaveBeenCalledWith(
      'Fetch API is not supported in this environment',
    );
    interceptor.uninject('xhr');

    Object.defineProperty(window, 'fetch', {
      value: originalFetch,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'XMLHttpRequest', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    interceptor.inject('fetch');
    expect(warnSpy).toHaveBeenCalledWith(
      'XMLHttpRequest is not supported in this environment',
    );
    interceptor.uninject('fetch');

    Object.defineProperty(window, 'XMLHttpRequest', {
      value: originalXhr,
      configurable: true,
      writable: true,
    });
    warnSpy.mockRestore();
  });

  it('constructor should reject invalid singleton token', () => {
    expect(() => new (InterceptorCtor as any)(Symbol('invalid'))).toThrow(
      'AjaxInterceptor is a singleton',
    );
  });
});

describe('Utils', () => {
  it('sleep should resolve asynchronously', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });

  it('getType and resolveUrl should work as expected', () => {
    expect(getType([])).toBe('[object Array]');
    expect(resolveUrl('/utils-test')).toContain('/utils-test');
  });

  it('safeStringify should handle string, object, and circular values', () => {
    expect(safeStringify('plain')).toBe('plain');
    expect(safeStringify({ ok: true })).toBe('{"ok":true}');

    const circular: Record<string, any> = {};
    circular.self = circular;
    expect(safeStringify(circular)).toBe('');
  });

  it('getProxyValue should keep method this-binding and return plain values', () => {
    const target = {
      value: 7,
      getValue() {
        return this.value;
      },
    };

    const plain = getProxyValue(target, 'value');
    const proxiedMethod = getProxyValue(target, 'getValue') as () => number;

    expect(plain).toBe(7);
    expect(proxiedMethod()).toBe(7);
  });

  it('copyNativePropsAndPrototype should copy static props and prototype', () => {
    const source = { A: 1, B: 2 };
    const target: Record<string, any> = {};
    const prototype = { marker: 'proto' };

    copyNativePropsAndPrototype({ source, target, prototype });

    expect(target.A).toBe(1);
    expect(target.B).toBe(2);
    expect(target.prototype).toBe(prototype);
  });
});

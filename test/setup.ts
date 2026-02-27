import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';
import AjaxInterceptor from '../src/index';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
  globalThis.interceptor = AjaxInterceptor.getInstance();
  globalThis.interceptor.inject();
});

afterEach(() => {
  server.resetHandlers();

  interceptor.unhook();
  interceptor.uninject();
  interceptor.inject();
});

afterAll(() => {
  server.close();
});

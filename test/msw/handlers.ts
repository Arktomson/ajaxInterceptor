import { http, HttpResponse } from 'msw';

// 定义 mock 的 API handlers
export const handlers = [
  // GET /api/data - 用于认证 token 测试
  http.get('/api/data', () => {
    return HttpResponse.json({ message: 'success', data: [1, 3, 2] });
  }),

  // GET /api/v1/users - 用于版本切换测试
  http.get('/api/v1/users', () => {
    return HttpResponse.json({ users: [] });
  }),

  // GET /api/v2/users - 切换后的版本
  http.get('https://example.com/api/v2/users', () => {
    return HttpResponse.json({ users: [], version: 'v2' });
  }),

  // GET old-api.com/users - 用于域名切换测试
  http.get('https://old-api.com/users', () => {
    return HttpResponse.json({ users: [] });
  }),

  // GET new-api.com/users - 切换后的域名
  http.get('https://new-api.com/users', () => {
    return HttpResponse.json({ users: [], domain: 'new' });
  }),

  // GET /api/products - 用于日志记录测试
  http.get('/api/products', () => {
    return HttpResponse.json({ products: [{ id: 1, name: 'Product 1' }] });
  }),

  // POST /api/orders - 用于日志记录测试
  http.post('/api/orders', () => {
    return HttpResponse.json(
      { orderId: '12345', status: 'created' },
      { status: 201 },
    );
  }),

  // GET /api/test - 用于多钩子协作测试
  http.get('/api/test', () => {
    return HttpResponse.json({ message: 'test' });
  }),

  // GET https://api.example.com/data - 用于公共参数测试
  http.get('https://api.example.com/data', () => {
    return HttpResponse.json({ data: 'example' });
  }),

  // GET /api/users - 用于 XHR 混合使用测试
  http.get('/api/users', () => {
    return HttpResponse.json({ users: [{ id: 1, name: 'User 1' }] });
  }),

  // GET /api/network-error - 模拟网络错误（DNS失败、网络断开等），触发 onerror
  http.get('/api/network-error', () => {
    return HttpResponse.error();
  }),

  // GET /api/timeout - 模拟请求超时，永远不返回响应，触发 ontimeout
  http.get('/api/timeout', async () => {
    await new Promise(() => {});
  }),
];

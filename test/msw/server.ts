import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// 创建 mock server
export const server = setupServer(...handlers);

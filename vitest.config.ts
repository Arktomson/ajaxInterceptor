import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 使用 jsdom 环境模拟浏览器（测试 XHR/Fetch）
    environment: 'jsdom',

    // 测试文件匹配模式
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },

    // 全局测试设置
    globals: true,
  },
});

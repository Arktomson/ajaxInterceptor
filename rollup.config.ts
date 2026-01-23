import clear from 'rollup-plugin-clear';
import define from 'rollup-plugin-define';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import { RollupOptions } from 'rollup';

const isDev = process.env.NODE_ENV === 'development';
console.log(isDev, 'isDev');

const inputFile = isDev ? 'src/demo/index.ts' : 'src/index.ts';
console.log(inputFile, 'inputFile===');
const terserPlugin = !isDev
  ? terser({
      format: {
        comments: false,
      },
      compress: {
        drop_debugger: true,
        pure_funcs: ['console.log'],
      },
    })
  : undefined;

const servePlugin = isDev
  ? serve({
      open: true,
      verbose: true,
      contentBase: ['dist'],
      host: 'localhost',
      port: 3010,
    })
  : undefined;
const config: RollupOptions = {
  input: inputFile,
  plugins: [
    clear({
      targets: ['dist'],
    }),
    nodeResolve(),
    define({
      replacements: {
        __isDev__: JSON.stringify(isDev),
      },
    }),
    typescript({
      tsconfig: './tsconfig.json',
      // noEmitOnError: false,
    }),
    ...(terserPlugin ? [terserPlugin] : []),
    ...(servePlugin ? [servePlugin] : []),
  ],
  output: [
    {
      format: 'esm',
      file: `dist/esm/index.js`,
      sourcemap: isDev,
    },
    {
      format: 'cjs',
      file: `dist/cjs/index.js`,
      sourcemap: isDev,
    },
    {
      format: 'iife',
      file: `dist/iife/index.js`,
      // name: 'ajaxInterceptor',
      sourcemap: isDev,
    },
  ],
};
export default config;

import clear from 'rollup-plugin-clear';
import define from 'rollup-plugin-define';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import nodeExternals from 'rollup-plugin-node-externals';
import { RollupOptions } from 'rollup';

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';
console.log(isDev, 'isDev');

const inputFile = isDev ? 'src/demo/index.ts' : 'src/index.ts';
console.log(inputFile, 'inputFile===');
const terserPlugin = isProd
  ? terser({
      format: {
        comments: false,
        beautify: true,
      },
      compress: {
        defaults: false,
        drop_debugger: true,
        pure_funcs: ['console.log'],
      },
      mangle: false,
    })
  : undefined;

const servePlugin = isDev
  ? serve({
      // open: true,
      verbose: true,
      contentBase: ['dist'],
      host: 'localhost',
      port: 3010,
    })
  : undefined;

type CreatePluginsOptions = {
  clearDist?: boolean;
  externalizeDeps?: boolean;
};

const createPlugins = ({
  clearDist = false,
  externalizeDeps = false,
}: CreatePluginsOptions = {}) => [
  ...(clearDist
    ? [
        clear({
          targets: ['dist'],
        }),
      ]
    : []),
  ...(externalizeDeps ? [nodeExternals()] : []),
  nodeResolve(),
  define({
    replacements: {
      __isDev__: JSON.stringify(isDev),
    },
  }),
  typescript({
    tsconfig: './tsconfig.json',
    sourceMap: isDev,
    exclude: !isDev
      ? ['src/demo/**/*', 'rollup.config.ts', 'test/**/*']
      : [],
  }),
  ...(terserPlugin ? [terserPlugin] : []),
  ...(servePlugin ? [servePlugin] : []),
];

const devConfig: RollupOptions = {
  input: inputFile,
  plugins: createPlugins({ clearDist: true }),
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
      name: 'ajaxInterceptor',
      sourcemap: isDev,
    },
  ],
};

const libraryConfig: RollupOptions = {
  input: 'src/index.ts',
  plugins: createPlugins({ clearDist: true, externalizeDeps: true }),
  output: [
    {
      format: 'esm',
      file: 'dist/esm/index.js',
      sourcemap: false,
    },
    {
      format: 'cjs',
      file: 'dist/cjs/index.js',
      sourcemap: false,
    },
  ],
};

const iifeConfig: RollupOptions = {
  input: 'src/index.ts',
  plugins: createPlugins({ clearDist: false }),
  output: {
    format: 'iife',
    file: 'dist/iife/index.js',
    name: 'AjaxHooker',
    exports: 'named',
    footer: 'AjaxHooker = Object.assign(AjaxHooker.default || AjaxHooker, AjaxHooker);',
    sourcemap: false,
  },
};

const config: RollupOptions | RollupOptions[] = isDev
  ? devConfig
  : [libraryConfig, iifeConfig];

export default config;

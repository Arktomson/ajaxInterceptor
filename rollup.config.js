import { defineConfig } from "rollup";
import clear from "rollup-plugin-clear";
import define from "rollup-plugin-define";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const isWatch = Boolean(process.env.ROLLUP_WATCH);

const baseConfig = {
  input: "src/index.ts",
  plugins: [
    clear({
      targets: ["dist"],
    }),
    nodeResolve(),
    define({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      // noEmitOnError: false,
    }),
    ...(isWatch
      ? [
          serve({
            open: true,
            verbose: true,
            contentBase: ["dist"],
            host: "localhost",
            port: 3000,
          }),
          // livereload({
          //   watch: "dist",
          // }),
        ]
      : []),
  ],
};
export default defineConfig({
  ...baseConfig,
  output: [
    {
      format: "esm",
      file: "dist/esm/index.js",
      sourcemap: true,
    },
    {
      format: "cjs",
      file: "dist/cjs/index.js",
    },
    {
      format: "iife",
      file: "dist/iife/index.js",
      name: "ajaxInterceptor",
    },
  ],
});

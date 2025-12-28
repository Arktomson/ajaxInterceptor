import { defineConfig } from "rollup";
import clear from "rollup-plugin-clear";
import define from "rollup-plugin-define";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const isWatch = Boolean(process.env.ROLLUP_WATCH);
const outputDir = isWatch ? "dist" : "output"
const inputFile = isWatch ? "src/demo/index.ts" : "src/index.ts"
const baseConfig = {
  input: inputFile,
  plugins: [
    clear({
      targets: [outputDir],
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
            port: 3010,
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
      file: `${outputDir}/esm/index.js`,
      sourcemap: true,
    },
    {
      format: "cjs",
      file: `${outputDir}/cjs/index.js`,
    },
    {
      format: "iife",
      file: `${outputDir}/iife/index.js`,
      name: "ajaxInterceptor",
    },
  ],
});

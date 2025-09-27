import { defineConfig } from "rollup";
import clear from "rollup-plugin-clear";
import define from "rollup-plugin-define";
import typescript from "@rollup/plugin-typescript";

const baseConfig = {
  input: "src/index.ts",
  plugins: [
    clear({
      targets: ["dist"],
    }),
    define({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      // noEmitOnError: false,
    }),
  ],
};
export default defineConfig({
  ...baseConfig,
  output: [
    {
      format: "esm",
      file: "dist/esm/index.js",
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

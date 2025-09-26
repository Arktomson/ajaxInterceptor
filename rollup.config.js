import { defineConfig } from "rollup";
import define from "rollup-plugin-define";
import typescript from "rollup-plugin-typescript2";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      name: "ajaxInterceptor",
      file: "dist/index.js",
      format: 'iife',
    },
    plugins: [
      define({
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      }),
      typescript(),
    ],
  },
]);

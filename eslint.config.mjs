import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Challenge engines must be pure functions of (seed, inputs) so the server can replay them
  // (CLAUDE.md, Challenge engines). Only render.ts, which draws to the canvas, may use these.
  {
    files: ["src/challenges/**/*.{ts,tsx}"],
    ignores: ["src/challenges/**/render.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use createRng(seed) from challenges/shared/prng." },
        { object: "Date", property: "now", message: "Engines take elapsed milliseconds as input, never the clock." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "performance", message: "Engines take elapsed milliseconds as input, never the clock." },
        { name: "window", message: "Engines must not touch the DOM; drawing belongs in render.ts." },
        { name: "document", message: "Engines must not touch the DOM; drawing belongs in render.ts." },
        { name: "fetch", message: "Engines must not use the network." },
        { name: "XMLHttpRequest", message: "Engines must not use the network." },
        { name: "navigator", message: "Engines must not depend on the browser." },
        { name: "crypto", message: "Use createRng(seed) from challenges/shared/prng." },
        { name: "setTimeout", message: "Engines are driven by elapsed milliseconds passed in, not timers." },
        { name: "setInterval", message: "Engines are driven by elapsed milliseconds passed in, not timers." },
        { name: "requestAnimationFrame", message: "Animation frames belong in render.ts." },
        { name: "globalThis", message: "Reaching globals through globalThis bypasses these purity rules." },
        { name: "self", message: "Reaching globals through self bypasses these purity rules." },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date']", message: "Engines take elapsed milliseconds as input, never the clock." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test and coverage output.
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// A key after a prop spread makes JSX fall back to createElement, and Next's dev build of React
// then warns that the element's children are a list missing keys (T80). Listed in every
// no-restricted-syntax block, since a later block's list replaces an earlier one.
const KEY_AFTER_SPREAD = {
  selector: "JSXOpeningElement > JSXSpreadAttribute ~ JSXAttribute[name.name='key']",
  message: "Put key before any {...spread} props.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "no-restricted-syntax": ["error", KEY_AFTER_SPREAD],
    },
  },
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
        KEY_AFTER_SPREAD,
      ],
    },
  },
  // player.ts plays the Tower for tests (simulated taps): never part of the app (T86). E2e specs
  // reach it through tests/e2e/support/tower.ts, so there is one allowed path.
  {
    files: ["**/*.{ts,tsx,mts}"],
    ignores: ["**/*.test.{ts,tsx}", "tests/e2e/support/**", "src/challenges/stacking/player.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/challenges/stacking/player"], message: "Test-only: use it from unit tests or tests/e2e/support/tower.ts." }] },
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
    // Generated test and coverage output, and the e2e server's own build folder.
    ".next-e2e/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;

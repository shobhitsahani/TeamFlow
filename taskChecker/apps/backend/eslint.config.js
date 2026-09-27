import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    // `_`-prefixed names are the deliberate-unused convention (stub handlers,
    // intentionally ignored params). Anything else unused still fails.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // k6 scripts run in the k6 runtime, not Node — declare its globals.
    files: ["k6/**/*.js"],
    languageOptions: { globals: { __ENV: "readonly" } },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];

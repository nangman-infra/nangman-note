import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-nested-ternary": "warn",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use '@/lib/config/env' instead of direct process.env access.",
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/*/*"],
              message:
                "Import domains through their public API, for example '@/domains/meeting'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/*"],
              message:
                "Shared frontend layers must not import domain modules. Move domain-specific logic into domains or compose it from app.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["domains/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/*"],
              message:
                "Domain module must not directly import other domains. Compose domains from app layer.",
            },
            {
              group: ["@/app/*"],
              message: "Domain modules must not import the app layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/config/env.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["next.config.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["proxy.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["instrumentation.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: ["lib/config/secrets-loader.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  {
    files: [
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-properties": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

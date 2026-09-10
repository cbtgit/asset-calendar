import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import type { DummyRuleMap } from "oxlint";
import { loadEnv } from "vite-plus";
import { defineConfig, lazyPlugins } from "vite-plus";

const strictApplicationRules: DummyRuleMap = {
  "max-lines": ["error", { max: 120, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  complexity: ["error", { max: 8 }],
  "max-depth": ["error", { max: 3 }],
  "max-params": ["error", { max: 3 }],
  "max-nested-callbacks": ["warn", { max: 3 }],
  "react/no-multi-comp": ["error", { ignoreStateless: false }],
  "react/no-unstable-nested-components": "error",
  "react/jsx-max-depth": ["warn", { max: 5 }],
};

const scriptRules: DummyRuleMap = {
  "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["warn", { max: 100, skipBlankLines: true, skipComments: true }],
  complexity: ["warn", { max: 12 }],
  "max-depth": ["error", { max: 3 }],
  "max-params": ["warn", { max: 4 }],
  "max-nested-callbacks": ["warn", { max: 3 }],
};

const hookRules: DummyRuleMap = {
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ["warn", { max: 12 }],
  "max-depth": ["error", { max: 3 }],
  "max-params": ["warn", { max: 4 }],
  "max-nested-callbacks": ["warn", { max: 3 }],
};

const migrationRules: DummyRuleMap = {
  "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
  complexity: ["warn", { max: 12 }],
  "max-depth": ["warn", { max: 4 }],
  "max-params": ["warn", { max: 4 }],
  "max-nested-callbacks": ["warn", { max: 3 }],
};

const testRules: DummyRuleMap = {
  "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["warn", { max: 100, skipBlankLines: true, skipComments: true }],
  complexity: ["warn", { max: 12 }],
  "max-depth": ["warn", { max: 4 }],
  "max-params": ["warn", { max: 4 }],
  "max-nested-callbacks": ["warn", { max: 3 }],
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const pocketbaseTarget = `http://127.0.0.1:${env.POCKETBASE_PORT ?? "8090"}`;

  return {
    staged: {
      "*": "vp check --fix",
    },
    fmt: {
      ignorePatterns: [
        ".github/workflows/unblock-issues.lock.yml",
        "src/types/pocketbase-types.ts",
        "src/routeTree.gen.ts",
      ],
    },
    lint: {
      ignorePatterns: ["dist/**", "src/routeTree.gen.ts", "src/types/pocketbase-types.ts"],
      plugins: ["react", "typescript", "oxc"],
      rules: {
        "react/rules-of-hooks": "error",
        "react/only-export-components": [
          "warn",
          {
            allowConstantExport: true,
          },
        ],
        "vite-plus/prefer-vite-plus-imports": "error",
      },
      overrides: [
        { files: ["src/**/*.tsx"], rules: strictApplicationRules },
        { files: ["scripts/**/*.ts", "scripts/**/*.js", "src/**/*.ts"], rules: scriptRules },
        { files: ["pb_hooks/**/*.cjs", "pb_hooks/**/*.js"], rules: hookRules },
        { files: ["pb_migrations/**/*.js"], rules: migrationRules },
        {
          files: ["tests/**/*.ts", "tests/**/*.tsx", "tests/**/*.js"],
          rules: testRules,
        },
      ],
      options: {
        typeAware: true,
        typeCheck: true,
      },
      jsPlugins: [
        {
          name: "vite-plus",
          specifier: "vite-plus/oxlint-plugin",
        },
      ],
    },
    test: {
      environment: "happy-dom",
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "tests/**/*.test.{ts,tsx}"],
    },
    server: {
      proxy: {
        "/api/": pocketbaseTarget,
        "/_/": pocketbaseTarget,
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: lazyPlugins(() => [tanstackRouter(), react(), tailwindcss()]),
  };
});

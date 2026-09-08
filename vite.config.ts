import react from "@vitejs/plugin-react";
import { loadEnv } from "vite-plus";
import { defineConfig, lazyPlugins } from "vite-plus";

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
      ],
    },
    lint: {
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
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    },
    server: {
      proxy: {
        "/api": pocketbaseTarget,
        "/_/": pocketbaseTarget,
      },
    },
    plugins: lazyPlugins(() => [react()]),
  };
});

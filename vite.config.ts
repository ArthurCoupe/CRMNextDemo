import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ConfigEnv, type PluginOption } from "vite";

export default defineConfig(async (env: ConfigEnv) => {
  const demo = env.mode === "demo";

  if (!demo) Object.assign(process.env, loadEnv(env.mode, process.cwd(), ""));

  const { recusarModoDemoFora } = await import("./supabase/stack-local.ts");
  recusarModoDemoFora(env.mode);

  if (demo) {
    const { aplicarStackDemo, nomesDoEnvExample } = await import("./supabase/stack-local.ts");
    const { readFileSync } = await import("node:fs");
    aplicarStackDemo(nomesDoEnvExample(readFileSync(".env.example", "utf8")));
  }

  const plugins: PluginOption[] = [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**", "**/*.server.*"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  return {
    plugins,
    ...(demo ? { envDir: false as const } : {}),
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      watch: {
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 },
      },
    },
  };
});

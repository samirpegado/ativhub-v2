import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem enxuta para o Coolify: o build gera .next/standalone.
  output: "standalone",
  // Nao deixar o Next gerar/reescrever AGENTS.md — este arquivo e gerido pela
  // camada de contexto da Devfy (.ai / AGENTS.md).
  agentRules: false,
  // cacheComponents/partialPrefetching desativados: o app é dinâmico por
  // request (auth via cookies/Supabase SSR, multi-tenant). Reavaliar quando
  // houver rotas que se beneficiem de cache explícito ("use cache").
  turbopack: {
    // Fixa a raiz no projeto (evita que o Next infira a raiz pelo lockfile
    // de um diretorio pai).
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

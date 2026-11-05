// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // SPA estática: o build gera HTML/JS/CSS puros para o S3 + CloudFront (ver ARQUITETURA.md, seção 11).
  // Sem servidor: não há SSR nem Cloudflare Workers, então o Nitro fica desligado.
  nitro: false,
  tanstackStart: {
    // index.html é o ponto de entrada que o S3 serve; as rotas profundas caem nele via CloudFront
    spa: { enabled: true, prerender: { outputPath: "/index" } },
  },
  vite: {
    server: {
      // Desenvolvimento local: a API FastAPI roda em http://localhost:8000.
      proxy: {
        "/api": { target: "http://localhost:8000", changeOrigin: true },
      },
    },
  },
});

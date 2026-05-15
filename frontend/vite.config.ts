/**
 * PaperChampion frontend Vite configuration.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core dependencies.
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/") || id.includes("node_modules/scheduler/")) {
            return "react-vendor";
          }
          // KaTeX is large and only needed for LaTeX content.
          if (id.includes("node_modules/katex/")) {
            return "katex";
          }
          // Markdown parser dependencies without KaTeX.
          if (id.includes("node_modules/react-markdown/") || id.includes("node_modules/remark") || id.includes("node_modules/rehype") || id.includes("node_modules/unified/") || id.includes("node_modules/mdast") || id.includes("node_modules/hast") || id.includes("node_modules/micromark") || id.includes("node_modules/vfile") || id.includes("node_modules/bail/") || id.includes("node_modules/is-plain-obj/") || id.includes("node_modules/trough/") || id.includes("node_modules/extend/")) {
            return "markdown";
          }
          // Icon library.
          if (id.includes("node_modules/lucide-react/")) {
            return "icons";
          }
          // D3 and graph rendering dependencies.
          if (id.includes("node_modules/d3") || id.includes("node_modules/@nivo") || id.includes("node_modules/force-graph") || id.includes("node_modules/three/")) {
            return "graph-vendor";
          }
          // DOMPurify
          if (id.includes("node_modules/dompurify/")) {
            return "dompurify";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});

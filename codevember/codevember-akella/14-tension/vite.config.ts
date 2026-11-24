import fs from "node:fs";
import { defineConfig, type Plugin } from "vite";
import glsl from "vite-plugin-glsl";
import { ssamExport } from "vite-plugin-ssam-export";
import { ssamFfmpeg } from "vite-plugin-ssam-ffmpeg";

// run through portless (https://<day>.localhost) it hands out a port in PORT,
// which vite ignores on its own, and the proxy 502s
const portless = process.env.PORTLESS_URL
  ? { port: Number(process.env.PORT), strictPort: true, host: process.env.HOST }
  : undefined;

// the cloth's note editor (dev only) saves its edits here, read back by the page at start
const EDITS = "public/waltz-edits.json";
const noteEdits = (): Plugin => ({
  name: "cloth-note-edits",
  configureServer(server) {
    server.middlewares.use("/__waltz-edits", (req, res) => {
      if (req.method !== "POST") return void ((res.statusCode = 405), res.end());
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          fs.writeFileSync(EDITS, JSON.stringify(JSON.parse(body), null, 2) + "\n");
          res.end("ok");
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e));
        }
      });
    });
  },
});

export default defineConfig({
  base: "./",
  // saving edits must not reload the page (and restart the sim)
  server: { ...portless, watch: { ignored: [`**/${EDITS}`] } },
  plugins: [
    noteEdits(),
    glsl({
      warnDuplicatedImports: false,
    }),
    ssamExport(),
    ssamFfmpeg(),
  ],
  clearScreen: false,
  build: {
    outDir: "./dist",
    assetsDir: ".",
    rollupOptions: { input: { main: "index.html", rope: "rope.html" } },
  },
});

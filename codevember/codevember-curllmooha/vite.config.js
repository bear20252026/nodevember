import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  appType: "mpa",
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "01-fold": resolve(__dirname, "days/01-fold/index.html"),
        "02-shatter": resolve(__dirname, "days/02-shatter/index.html"),
        "03-melt": resolve(__dirname, "days/03-melt/index.html"),
        "04-tangle": resolve(__dirname, "days/04-tangle/index.html"),
        "05-moss": resolve(__dirname, "days/05-moss/index.html"),
        "06-orrery": resolve(__dirname, "days/06-orrery/index.html"),
        "07-hollow": resolve(__dirname, "days/07-hollow/index.html"),
        "08-tesseract": resolve(__dirname, "days/08-tesseract/index.html"),
        "09-membrane": resolve(__dirname, "days/09-membrane/index.html"),
        "10-caustic": resolve(__dirname, "days/10-caustic/index.html"),
        "11-rust": resolve(__dirname, "days/11-rust/index.html"),
        "12-feather": resolve(__dirname, "days/12-feather/index.html"),
        "13-labyrinth": resolve(__dirname, "days/13-labyrinth/index.html"),
        "14-tension": resolve(__dirname, "days/14-tension/index.html"),
        "15-mirage": resolve(__dirname, "days/15-mirage/index.html"),
        "16-spore": resolve(__dirname, "days/16-spore/index.html"),
        "17-kelp": resolve(__dirname, "days/17-kelp/index.html"),
        "18-pendulum": resolve(__dirname, "days/18-pendulum/index.html"),
        "19-erosion": resolve(__dirname, "days/19-erosion/index.html"),
        "20-cocoon": resolve(__dirname, "days/20-cocoon/index.html"),
        "21-bolt": resolve(__dirname, "days/21-bolt/index.html"),
        "22-echo": resolve(__dirname, "days/22-echo/index.html"),
        "23-magma": resolve(__dirname, "days/23-magma/index.html"),
      },
    },
  },
});

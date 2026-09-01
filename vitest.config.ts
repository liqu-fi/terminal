import path from "node:path";
import { createLogger } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Логгер Vite без одного чужого сообщения.
 *
 * @remarks `@turnkey/react-wallet-kit` поставляет sourcemap'ы, ссылающиеся на
 * несуществующие исходники, и Vite печатает по строке на каждый её модуль —
 * около сорока строк перед каждым прогоном. Глушится ровно это сообщение, а не
 * весь канал через `logLevel: "error"`: предупреждения о неразрешённых импортах
 * и прочие настоящие жалобы Vite должны доходить.
 */
const logger = createLogger();
const warn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes("points to missing source files")) return;
  warn(msg, options);
};

export default defineConfig({
  customLogger: logger,
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `@liq/react` тянет `@turnkey/react-wallet-kit`, чей файл с нестандартным
    // расширением не переваривает загрузчик Node: инлайн отдаёт его Vite.
    server: { deps: { inline: [/@turnkey\//, /@liqpro\//] } },
  },
});

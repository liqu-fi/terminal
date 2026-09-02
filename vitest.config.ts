import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /**
   * Канал `warn` Vite приглушён на время прогона тестов.
   *
   * @remarks `@turnkey/react-wallet-kit` поставляет sourcemap'ы, ссылающиеся на
   * несуществующие исходники, и Vite печатает по строке на каждый её модуль —
   * семьдесят строк перед каждым прогоном, стоит любому тесту потянуть
   * `@liq/react`. Сузить до одного сообщения через `customLogger` нельзя:
   * сообщение печатает логгер *окружения* (`loadAndTransform` берёт
   * `const { config, pluginContainer, logger } = environment`), а `customLogger`
   * из корня конфига до него не доходит — проверено подменой обоих методов
   * `warn` и `warnOnce`, шум остался прежним. Цена решения: настоящие
   * предупреждения Vite в прогоне тестов тоже не видны; ошибки — видны, и
   * неразрешённый импорт роняет файл теста, а не прячется в `warn`.
   */
  logLevel: "error",
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

import { Bot } from "@maxhub/max-bot-api";
import dotenv from "dotenv";

import { registerCommands } from "./src/handlers/commands.js";
import { registerContactHandler } from "./src/handlers/contacts.js";
import { registerActions } from "./src/handlers/actions.js";
import { registerMessageHandler } from "./src/handlers/messages.js";

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("Token not provided");

const bot = new Bot(token);

// Register bot commands
bot.api.setMyCommands([
  { name: "start", description: "Начать работу с ботом" },
  { name: "help", description: "Показать справку" },
  { name: "cancel", description: "Отменить текущее действие" },
]);

// Register all handlers
registerCommands(bot);
registerContactHandler(bot);
registerActions(bot);
registerMessageHandler(bot);

// Error handling
bot.catch((error) => {
  console.error("Bot error:", error);
});
bot.on("bot_started", (ctx) => {
  return ctx.reply(
    "👋 **Бот Школы 1298 запущен!**\n\n" +
      "Бот успешно запущен и готов к работе.\n\n" +
      "📝 **Доступные команды:**\n" +
      "• /start - Начать авторизацию\n" +
      "• /help - Показать справку\n" +
      "• /status - Проверить статус\n" +
      "• /cancel - Отменить текущее действие\n\n" +
      "ℹ️ Для начала работы отправьте команду /start",
    { format: "markdown" },
  );
});
// Start bot
bot
  .start()
  .then(() => console.log("✅ Bot started"))
  .catch(console.error);

// Graceful shutdown
const shutdown = () => {
  console.log("\n👋 Stopping bot...");
  bot.stop();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

import { MESSAGES, STATES } from "../config/constants.js";
import { getUserSession } from "../services/session.js";
import { authService } from "../services/authService.js";
import { userService } from "../services/userService.js";
import { getAuthKeyboard, getMainKeyboard } from "../keyboards/index.js";

export function registerCommands(bot) {
  // /start command
  bot.command("start", async (ctx) => {
    const maxId = ctx.update?.message?.sender?.user_id; // Это и есть MAX ID
    if (!maxId) return ctx.reply(MESSAGES.SESSION_ERROR);

    // Получаем сессию (только для состояния, не для данных)
    const session = getUserSession(maxId);

    // 🔍 Проверяем авторизацию по БД
    const authorizedUser = await authService.getAuthorizedUser(maxId);

    console.log("📝 /start check:", {
      maxId,
      authorized: !!authorizedUser,
      user: authorizedUser?.fullName,
    });

    // Если пользователь авторизован в БД
    if (authorizedUser) {
      // Сбрасываем сессию в IDLE (он авторизован, никаких временных состояний не нужно)
      if (session) {
        session.state = STATES.IDLE; // Важно! Устанавливаем IDLE, а не оставляем в другом состоянии
        session.tempData = {};
      }

      // Показываем приветствие с данными ИЗ БД
      const roleEmoji =
        authorizedUser.role === "student"
          ? "👨‍🎓"
          : authorizedUser.role === "teacher"
            ? "👨‍🏫"
            : "👪";

      return ctx.reply(
        `👋 С возвращением, ${authorizedUser.fullName}!\n\n` +
          `${roleEmoji} **Ваши данные:**\n` +
          `• MAX ID: \`${maxId}\`\n` +
          `• Роль: ${
            authorizedUser.role === "student"
              ? "Ученик"
              : authorizedUser.role === "teacher"
                ? "Учитель"
                : authorizedUser.role === "parent"
                  ? "Родитель"
                  : authorizedUser.role
          }\n` +
          `• Класс/Группа: ${authorizedUser.groupName || "не указано"}\n` +
          `• Email: ${authorizedUser.email || "не указан"}`,
        {
          format: "markdown",
          attachments: [getMainKeyboard()],
        },
      );
    }

    // Пользователь не авторизован - начинаем процесс регистрации
    if (session) {
      session.state = STATES.AWAITING_CONTACT;
      session.tempData = {};
    }

    return ctx.reply(MESSAGES.WELCOME, {
      format: "markdown",
      attachments: [getAuthKeyboard()],
    });
  });

  // /status command - показывает статус из БД
  bot.command("status", async (ctx) => {
    const maxId = ctx.update?.message?.sender?.user_id;

    const authorizedUser = await authService.getAuthorizedUser(maxId);

    if (authorizedUser) {
      const roleEmoji =
        authorizedUser.role === "student"
          ? "👨‍🎓"
          : authorizedUser.role === "teacher"
            ? "👨‍🏫"
            : "👪";

      await ctx.reply(
        `📊 **Статус авторизации**\n\n` +
          `✅ **Авторизован**\n\n` +
          `${roleEmoji} **Данные из системы:**\n` +
          `• ФИО: ${authorizedUser.fullName}\n` +
          `• MAX ID: \`${maxId}\`\n` +
          `• Роль: ${
            authorizedUser.role === "student"
              ? "Ученик"
              : authorizedUser.role === "teacher"
                ? "Учитель"
                : authorizedUser.role === "parent"
                  ? "Родитель"
                  : authorizedUser.role
          }\n` +
          `• Класс/Группа: ${authorizedUser.groupName || "не указано"}\n` +
          `• Email: ${authorizedUser.email || "не указан"}\n` +
          `• Телефон: ${authorizedUser.phone || "не указан"}`,
        { format: "markdown" },
      );
    } else {
      await ctx.reply(
        `📊 **Статус авторизации**\n\n` +
          `❌ **Не авторизован**\n\n` +
          `🆔 Ваш MAX ID: \`${maxId}\`\n\n` +
          `Нажмите /start для авторизации`,
        { format: "markdown" },
      );
    }
  });

  // /cancel command
  bot.command("cancel", (ctx) => {
    const maxId = ctx.update?.message?.sender?.user_id;
    if (!maxId) return ctx.reply(MESSAGES.SESSION_ERROR);

    resetUserSession(maxId);
    return ctx.reply(MESSAGES.CANCELLED);
  });

  // /help command
  bot.command("help", async (ctx) => {
    const maxId = ctx.update?.message?.sender?.user_id;

    // Проверяем авторизацию по БД
    const isAuth = await authService.isAuthorized(maxId);

    const helpText = isAuth
      ? MESSAGES.HELP_AUTHORIZED
      : MESSAGES.HELP_UNAUTHORIZED;
    return ctx.reply(helpText, { format: "markdown" });
  });
}

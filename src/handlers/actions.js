import { MESSAGES, STATES } from "../config/constants.js";
import { getUserSession } from "../services/session.js";
import { userService } from "../services/userService.js";
import { authService } from "../services/authService.js";
import {
  sendVerificationCode,
  generateCode,
} from "../services/emailService.js";
import { getMainKeyboard } from "../keyboards/index.js";

export function registerActions(bot) {
  // Show my data action
  bot.action("show_my_data", async (ctx) => {
    try {
      const maxId = ctx.update?.callback?.user?.user_id;

      if (!maxId) {
        return ctx.answerOnCallback({
          notification: "❌ Ошибка: пользователь не идентифицирован",
        });
      }

      // 🔍 Проверяем авторизацию по БД
      const authorizedUser = await authService.getAuthorizedUser(maxId);

      if (!authorizedUser) {
        await ctx.answerOnCallback({
          notification: "❌ Вы не авторизованы",
        });
        return ctx.reply(MESSAGES.NOT_AUTHORIZED);
      }

      const roleEmoji =
        authorizedUser.role === "student"
          ? "👨‍🎓"
          : authorizedUser.role === "teacher"
            ? "👨‍🏫"
            : "👪";

      await ctx.reply(
        `📋 **Ваши данные из системы:**\n\n` +
          `${roleEmoji} **Информация:**\n` +
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

      return ctx.answerOnCallback({
        notification: "✅ Данные загружены из базы",
      });
    } catch (error) {
      console.error("Error in show_my_data:", error);
      return ctx.answerOnCallback({ notification: "❌ Ошибка" });
    }
  });

  // Help callback action
  bot.action("help_callback", async (ctx) => {
    try {
      const maxId = ctx.update?.callback?.user?.user_id;

      // Проверяем авторизацию для персонализированной помощи
      const authorizedUser = await authService.getAuthorizedUser(maxId);

      let helpText = MESSAGES.HELP_CALLBACK;

      if (authorizedUser) {
        helpText =
          `ℹ️ **Помощь для ${authorizedUser.fullName}**\n\n` +
          `• Вы авторизованы как ${
            authorizedUser.role === "student"
              ? "ученик"
              : authorizedUser.role === "teacher"
                ? "учитель"
                : authorizedUser.role === "parent"
                  ? "родитель"
                  : "пользователь"
          }\n` +
          `• Используйте кнопку "Мои данные" для просмотра информации\n` +
          `• По вопросам обращайтесь к администратору`;
      } else {
        helpText = MESSAGES.HELP_CALLBACK;
      }

      await ctx.reply(helpText, { format: "markdown" });

      return ctx.answerOnCallback({
        notification: authorizedUser
          ? "ℹ️ Персонализированная помощь"
          : "ℹ️ Помощь отправлена",
      });
    } catch (error) {
      console.error("Error in help_callback:", error);
    }
  });

  // Подтверждение данных
  bot.action("confirm_data", async (ctx) => {
    try {
      const userId = ctx.update?.callback?.user?.user_id;

      if (!userId) {
        return ctx.answerOnCallback({
          notification: "❌ Ошибка: пользователь не идентифицирован",
        });
      }

      const session = getUserSession(userId);

      if (!session || session.state !== STATES.AWAITING_CONFIRMATION) {
        await ctx.answerOnCallback({ notification: "❌ Сессия не найдена" });
        return ctx.reply(MESSAGES.SESSION_ERROR);
      }

      const { phone, maxId, schoolUser } = session.tempData;

      // Проверяем, не занят ли этот MAX ID другим пользователем
      const existingUser = await authService.getAuthorizedUser(maxId);

      if (existingUser && existingUser.phone !== phone) {
        await ctx.reply(
          `❌ **MAX ID уже используется**\n\n` +
            `MAX ID \`${maxId}\` уже привязан к другому пользователю.\n` +
            `Если это ваш MAX ID, обратитесь в поддержку.`,
          { format: "markdown" },
        );

        session.state = STATES.IDLE;
        delete session.tempData;

        return ctx.answerOnCallback({ notification: "❌ MAX ID занят" });
      }

      // Проверяем наличие email
      if (!schoolUser.email) {
        await ctx.reply(
          `❌ **Email не указан**\n\n` +
            `В вашей карточке не указан email.\n` +
            `Обратитесь в администрацию школы.`,
          { format: "markdown" },
        );

        session.state = STATES.IDLE;
        delete session.tempData;

        return ctx.answerOnCallback({ notification: "❌ Нет email" });
      }

      // Генерируем и отправляем код подтверждения
      const verificationCode = generateCode();
      const emailSent = await sendVerificationCode(
        schoolUser.email,
        verificationCode,
      );

      if (!emailSent) {
        await ctx.reply(
          `❌ **Ошибка отправки email**\n\n` +
            `Не удалось отправить код подтверждения на ${schoolUser.email}.`,
          { format: "markdown" },
        );

        session.state = STATES.IDLE;
        delete session.tempData;

        return ctx.answerOnCallback({ notification: "❌ Ошибка отправки" });
      }

      session.state = STATES.AWAITING_EMAIL_CODE;
      session.tempData = {
        phone,
        maxId,
        schoolUser,
        verificationCode,
        codeSentAt: Date.now(),
        attempts: 0,
      };

      await ctx.reply(MESSAGES.CODE_SENT(schoolUser.email), {
        format: "markdown",
      });

      return ctx.answerOnCallback({
        notification: `📧 Код отправлен на ${schoolUser.email}`,
      });
    } catch (error) {
      console.error("Error in confirm_data:", error);
      return ctx.answerOnCallback({ notification: "❌ Ошибка" });
    }
  });

  // Отклонение данных
  bot.action("reject_data", async (ctx) => {
    const userId = ctx.update?.callback?.user?.user_id;

    if (!userId) {
      return ctx.answerOnCallback({
        notification: "❌ Ошибка: пользователь не идентифицирован",
      });
    }

    const session = getUserSession(userId);

    if (session) {
      session.state = STATES.IDLE;
      delete session.tempData;
    }

    await ctx.reply(
      "❌ Данные не подтверждены. Если это ошибка, обратитесь в администрацию школы.",
    );

    return ctx.answerOnCallback({ notification: "❌ Данные отклонены" });
  });
}

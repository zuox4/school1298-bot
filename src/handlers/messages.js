import { MESSAGES, STATES } from "../config/constants.js";
import { getUserSession, updateUserSession } from "../services/session.js";
import { authService } from "../services/authService.js";
import { isCodeValid } from "../services/emailService.js";
import { getMainKeyboard } from "../keyboards/index.js";

export function registerMessageHandler(bot) {
  bot.on("message_created", async (ctx, next) => {
    // Пропускаем контакты (они обрабатываются в contacts.js)
    if (ctx.contactInfo) return next();

    const maxId = ctx.update?.message?.sender?.user_id;
    const messageText = ctx.update?.message?.body?.text;

    // Пропускаем команды (начинаются с /)
    if (messageText?.startsWith("/")) return next();

    if (!maxId) {
      return ctx.reply(MESSAGES.SESSION_ERROR);
    }

    // Получаем сессию пользователя
    const session = getUserSession(maxId);

    console.log("📝 Message handler state:", {
      maxId,
      state: session?.state,
      messageText,
      hasSession: !!session,
    });

    // 🔍 ОБРАБОТКА ВВОДА КОДА ПОДТВЕРЖДЕНИЯ
    if (session && session.state === STATES.AWAITING_EMAIL_CODE) {
      console.log("🔐 Processing verification code input:", {
        enteredCode: messageText,
        expectedCode: session.tempData?.verificationCode,
        attempts: session.tempData?.attempts,
      });

      const {
        verificationCode,
        schoolUser,
        phone,
        maxId: tempMaxId,
        codeSentAt,
        attempts = 0,
      } = session.tempData;

      // Проверяем срок действия кода
      if (!isCodeValid(codeSentAt)) {
        await ctx.reply(MESSAGES.CODE_EXPIRED, { format: "markdown" });
        session.state = STATES.IDLE;
        delete session.tempData;
        return;
      }

      // Проверяем код
      if (messageText === verificationCode) {
        console.log("✅ Code verified successfully for:", schoolUser.fullName);

        // СОХРАНЯЕМ MAX ID В БАЗЕ ДАННЫХ
        await authService.authorizeUser(phone, tempMaxId);

        // Получаем обновленные данные пользователя из БД
        const authorizedUser = await authService.getAuthorizedUser(tempMaxId);

        console.log("✅ User authorized in DB:", authorizedUser);

        // Сбрасываем сессию (больше не нужна)
        session.state = STATES.IDLE;

        // Отправляем сообщение об успехе
        await ctx.reply(MESSAGES.CODE_SUCCESS, { format: "markdown" });

        // Отправляем приветственное сообщение с данными из БД
        const roleEmoji =
          authorizedUser.role === "student"
            ? "👨‍🎓"
            : authorizedUser.role === "teacher"
              ? "👨‍🏫"
              : "👪";

        await ctx.reply(
          `✅ **Регистрация успешно завершена!**\n\n` +
            `Добро пожаловать, ${authorizedUser.fullName}!\n\n` +
            `${roleEmoji} **Ваши данные из системы:**\n` +
            `• MAX ID: \`${tempMaxId}\`\n` +
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
          { format: "markdown" },
        );

        // Отправляем клавиатуру с основными функциями
        await ctx.reply("Выберите действие:", {
          attachments: [getMainKeyboard()],
        });

        // Удаляем временные данные
        delete session.tempData;

        console.log(
          "✅ Registration completed for user:",
          authorizedUser.fullName,
        );
        return;
      } else {
        // Неверный код
        session.tempData.attempts = attempts + 1;

        console.log("❌ Invalid code attempt:", {
          attempt: attempts + 1,
          maxAttempts: 3,
        });

        if (attempts >= 2) {
          // 3 попытки (0, 1, 2)
          await ctx.reply(MESSAGES.CODE_INCORRECT, { format: "markdown" });
          session.state = STATES.IDLE;
          delete session.tempData;
        } else {
          await ctx.reply(
            `❌ **Неверный код**\n\n` +
              `Осталось попыток: ${3 - (attempts + 1)}`,
            { format: "markdown" },
          );
        }
        return;
      }
    }

    // 🔍 ПРОВЕРЯЕМ АВТОРИЗАЦИЮ ПО БД
    const isAuth = await authService.isAuthorized(maxId);

    if (!isAuth) {
      // Если не авторизован, проверяем состояние сессии
      if (session && session.state === STATES.AWAITING_CONFIRMATION) {
        return ctx.reply(
          "⏳ **Ожидается подтверждение**\n\n" +
            "Пожалуйста, нажмите кнопку '✅ Да, это я' или '❌ Нет, это не я'",
          { format: "markdown" },
        );
      }

      if (session && session.state === STATES.AWAITING_CONTACT) {
        return ctx.reply(
          "📱 **Ожидается контакт**\n\n" +
            "Для авторизации необходимо нажать кнопку **'Авторизоваться по номеру телефона'**.",
          { format: "markdown" },
        );
      }

      // Если не авторизован и нет активной сессии
      return ctx.reply(MESSAGES.NOT_AUTHORIZED);
    }

    // ПОЛЬЗОВАТЕЛЬ АВТОРИЗОВАН - получаем данные из БД
    const user = await authService.getAuthorizedUser(maxId);

    // Обработка специальных команд
    if (messageText?.toLowerCase() === "привет") {
      return ctx.reply(
        `👋 Привет, ${user?.fullName || "пользователь"}! Чем могу помочь?`,
      );
    }

    if (messageText?.toLowerCase() === "данные") {
      const roleEmoji =
        user?.role === "student"
          ? "👨‍🎓"
          : user?.role === "teacher"
            ? "👨‍🏫"
            : "👪";

      return ctx.reply(
        `📊 **Ваши данные из системы:**\n\n` +
          `${roleEmoji} **Информация:**\n` +
          `• ФИО: ${user?.fullName}\n` +
          `• MAX ID: \`${maxId}\`\n` +
          `• Роль: ${
            user?.role === "student"
              ? "Ученик"
              : user?.role === "teacher"
                ? "Учитель"
                : user?.role === "parent"
                  ? "Родитель"
                  : user?.role
          }\n` +
          `• Класс/Группа: ${user?.groupName || "не указано"}\n` +
          `• Email: ${user?.email || "не указан"}\n` +
          `• Телефон: ${user?.phone || "не указан"}`,
        { format: "markdown" },
      );
    }

    // Общий ответ для авторизованных пользователей
    return ctx.reply(
      `📝 Пока не научился отвечать на: \n\n` +
        `"${messageText}"\n\n` +
        `Используйте /help для списка команд.\n` +
        `Или отправьте "данные" для просмотра информации.`,
    );
  });
}

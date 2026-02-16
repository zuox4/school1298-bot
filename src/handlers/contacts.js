import { Keyboard } from "@maxhub/max-bot-api";
import { MESSAGES, STATES } from "../config/constants.js";
import { getUserSession } from "../services/session.js";
import { userService } from "../services/userService.js";
import {
  getRetryKeyboard,
  getConfirmationKeyboard,
  getMainKeyboard,
} from "../keyboards/index.js";
import { isOwnContact } from "../utils/validators.js";

export function registerContactHandler(bot) {
  bot.on("message_created", async (ctx, next) => {
    if (!ctx.contactInfo) return next();

    const userId = ctx.update?.message?.sender?.user_id;
    if (!userId) {
      return ctx.reply(MESSAGES.SESSION_ERROR);
    }

    const contact = ctx.contactInfo;
    const session = getUserSession(userId);

    if (!session) {
      return ctx.reply(MESSAGES.SESSION_ERROR, { format: "markdown" });
    }

    // Проверяем, ожидает ли бот контакт
    if (session.state !== STATES.AWAITING_CONTACT) {
      await ctx.reply(MESSAGES.UNEXPECTED_CONTACT, { format: "markdown" });
      return;
    }

    // Проверяем, что контакт отправлен через кнопку
    const attachment = ctx.update?.message?.body?.attachments?.[0];
    const isFromButton =
      attachment?.type === "contact" && attachment?.payload?.max_info != null;

    if (!isFromButton) {
      await ctx.reply(
        "❌ **Контакт не принят**\n\n" +
          "Для авторизации необходимо нажать кнопку **'Авторизоваться по номеру телефона'**.",
        { format: "markdown" },
      );
      return;
    }

    // Проверяем, что контакт свой
    if (!isOwnContact(ctx, contact)) {
      await ctx.reply(MESSAGES.NOT_OWN_CONTACT, { format: "markdown" });
      const authKeyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.requestContact("📱 Попробовать снова")],
      ]);
      return ctx.reply("Нажмите кнопку ниже и выберите **свой контакт**:", {
        attachments: [authKeyboard],
      });
    }

    // 🔍 ИЩЕМ ПОЛЬЗОВАТЕЛЯ В БД ПО НОМЕРУ ТЕЛЕФОНА
    const schoolUser = await userService.findByPhone(contact.tel);

    console.log("🔍 User lookup result:", {
      phone: contact.tel,
      found: !!schoolUser,
      userData: schoolUser,
    });

    // ЕСЛИ ПОЛЬЗОВАТЕЛЬ НЕ НАЙДЕН В БД
    if (!schoolUser) {
      const phoneForDisplay = contact.tel.replace(
        /(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/,
        "+$1 ($2) $3-$4-$5",
      );

      await ctx.reply(
        `❌ **Пользователь не найден**\n\n` +
          `Номер телефона ${phoneForDisplay} не найден в базе данных школы.\n\n` +
          `Пожалуйста, обратитесь в администрацию школы для регистрации.`,
        { format: "markdown" },
      );

      session.state = STATES.IDLE;
      return;
    }

    // ЕСЛИ ПОЛЬЗОВАТЕЛЬ НАЙДЕН, ПРОВЕРЯЕМ MAX ID
    if (schoolUser.maxId) {
      if (schoolUser.maxId === userId) {
        // Уже зарегистрирован с этим MAX ID
        session.state = STATES.AUTHORIZED;
        session.data = {
          maxId: userId,
          schoolId: schoolUser.schoolId,
          phoneNumber: contact.tel,
          email: schoolUser.email,
          fullName: schoolUser.fullName,
          firstName: schoolUser.firstName,
          lastName: schoolUser.lastName,
          role: schoolUser.role,
          group: schoolUser.groupName,
          authorizedAt: new Date().toISOString(),
          username: ctx.update?.message?.sender?.username,
        };

        await ctx.reply(
          `✅ **Вы уже зарегистрированы!**\n\n` +
            `Добро пожаловать, ${schoolUser.fullName}!\n` +
            `Ваш MAX ID: \`${userId}\``,
          { format: "markdown" },
        );

        return ctx.reply("Выберите действие:", {
          attachments: [getMainKeyboard()],
        });
      } else {
        // У пользователя другой MAX ID
        await ctx.reply(
          `❌ **Конфликт данных**\n\n` +
            `В базе школы указан другой MAX ID (\`${schoolUser.maxId}\`).\n` +
            `Пожалуйста, войдите с тем MAX ID, который указан в базе.`,
          { format: "markdown" },
        );

        session.state = STATES.IDLE;
        return;
      }
    }
    if (schoolUser.maxId) {
      if (schoolUser.maxId === userId) {
        // Уже зарегистрирован с этим MAX ID - авторизуем
        session.state = STATES.AUTHORIZED;
        session.data = {
          maxId: userId,
          schoolId: schoolUser.schoolId,
          phoneNumber: contact.tel,
          email: schoolUser.email,
          fullName: schoolUser.fullName,
          firstName: schoolUser.firstName,
          lastName: schoolUser.lastName,
          role: schoolUser.role,
          group: schoolUser.groupName,
          authorizedAt: new Date().toISOString(),
          username: ctx.update?.message?.sender?.username,
        };

        await ctx.reply(
          `✅ **Вы уже зарегистрированы!**\n\n` +
            `Добро пожаловать, ${schoolUser.fullName}!\n` +
            `Ваш MAX ID: \`${userId}\``,
          { format: "markdown" },
        );

        return ctx.reply("Выберите действие:", {
          attachments: [getMainKeyboard()],
        });
      } else {
        // У пользователя школы другой MAX ID - это ошибка
        await ctx.reply(
          `❌ **Конфликт данных**\n\n` +
            `В базе школы указан другой MAX ID (\`${schoolUser.maxId}\`).\n` +
            `Пожалуйста, войдите с тем MAX ID, который указан в базе.\n\n` +
            `Если вы считаете, что это ошибка, обратитесь к администратору.`,
          { format: "markdown" },
        );

        session.state = STATES.IDLE;
        return;
      }
    }
    // ПРОВЕРЯЕМ, НЕ ЗАНЯТ ЛИ ЭТОТ MAX ID ДРУГИМ ПОЛЬЗОВАТЕЛЕМ
    const userWithThisMaxId = await userService.findByMaxId(userId);
    if (userWithThisMaxId && userWithThisMaxId.phone !== contact.tel) {
      await ctx.reply(
        `❌ **MAX ID уже зарегистрирован**\n\n` +
          `Ваш MAX ID (\`${userId}\`) уже привязан к другому пользователю.\n` +
          `Если это ваш аккаунт, обратитесь в поддержку.`,
        { format: "markdown" },
      );

      session.state = STATES.IDLE;
      return;
    }

    // ПРОВЕРЯЕМ НАЛИЧИЕ EMAIL
    if (!schoolUser.email) {
      await ctx.reply(
        `❌ **Email не указан**\n\n` +
          `В вашей карточке (${schoolUser.fullName}) не указан email.\n` +
          `Пожалуйста, обратитесь в администрацию школы для добавления email.\n\n` +
          `Регистрация прервана.`,
        { format: "markdown" },
      );

      session.state = STATES.IDLE;
      return;
    }

    // ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - ПОКАЗЫВАЕМ ДАННЫЕ ДЛЯ ПОДТВЕРЖДЕНИЯ
    session.state = STATES.AWAITING_CONFIRMATION;
    session.tempData = {
      phone: contact.tel,
      maxId: userId,
      schoolUser: schoolUser, // Временные данные, не для авторизации
    };

    const displayData = {
      fullName: schoolUser.fullName,
      group: schoolUser.groupName,
      role: schoolUser.role,
      email: schoolUser.email,
    };

    await ctx.reply(MESSAGES.CONFIRM_DATA(displayData), {
      format: "markdown",
      attachments: [getConfirmationKeyboard()],
    });
  });
}

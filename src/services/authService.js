import { dbService } from "./dbService.js";

export const authService = {
  // Проверка, авторизован ли пользователь (по БД)
  async isAuthorized(maxId) {
    if (!maxId) return false;
    const user = await dbService.getUserByMaxId(maxId);
    return !!user;
  },

  // Получение данных авторизованного пользователя
  async getAuthorizedUser(maxId) {
    if (!maxId) return null;
    return dbService.getUserByMaxId(maxId);
  },

  // Авторизация пользователя (сохранение MAX ID в БД)
  async authorizeUser(phone, maxId) {
    console.log("🔐 Authorizing user:", { phone, maxId });

    // Очищаем телефон
    const cleanPhone = phone.replace(/\D/g, "");

    // Ищем пользователя по телефону
    const user = await dbService.getUserByPhone(cleanPhone);

    if (!user) {
      console.log("❌ User not found for phone:", cleanPhone);
      return null;
    }

    console.log("✅ User found:", user.fullName);

    // Обновляем MAX ID
    await dbService.updateUser(user.id, { maxId });
    console.log("✅ MAX ID saved to database");

    // Возвращаем обновленного пользователя
    return dbService.getUserByMaxId(maxId);
  },

  // Проверка, может ли пользователь авторизоваться
  async canAuthorize(phone, maxId) {
    const cleanPhone = phone.replace(/\D/g, "");

    // Проверяем, есть ли пользователь с таким телефоном
    const userByPhone = await dbService.getUserByPhone(cleanPhone);
    if (!userByPhone) return { allowed: false, reason: "PHONE_NOT_FOUND" };

    // Проверяем, не занят ли MAX ID другим пользователем
    const userByMaxId = await dbService.getUserByMaxId(maxId);
    if (userByMaxId && userByMaxId.phone !== cleanPhone) {
      return { allowed: false, reason: "MAX_ID_TAKEN" };
    }

    // Проверяем, нет ли у пользователя другого MAX ID
    if (userByPhone.maxId && userByPhone.maxId !== maxId) {
      return {
        allowed: false,
        reason: "USER_HAS_OTHER_MAX_ID",
        existingMaxId: userByPhone.maxId,
      };
    }

    return { allowed: true, user: userByPhone };
  },
};

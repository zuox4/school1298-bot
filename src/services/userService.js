// src/services/userService.js
import { dbService } from "./dbService.js";

export const userService = {
  // Поиск пользователя по номеру телефона
  async findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/\D/g, "");
    console.log("🔍 Searching for phone:", cleanPhone);
    const user = await dbService.getUserByPhone(cleanPhone);
    console.log("📊 Found user by phone:", user ? user.fullName : "not found");
    return user;
  },

  // Поиск пользователя по MAX ID
  async findByMaxId(maxId) {
    if (!maxId) return null;
    console.log("🔍 Searching for MAX ID:", maxId);
    const user = await dbService.getUserByMaxId(maxId);
    console.log("📊 Found user by MAX ID:", user ? user.fullName : "not found");
    return user;
  },

  // Сохранение MAX ID пользователя
  async saveMaxId(phone, maxId) {
    console.log("💾 Attempting to save MAX ID:", { phone, maxId });

    const user = await this.findByPhone(phone);
    if (!user) {
      console.log("❌ User not found for phone:", phone);
      return false;
    }

    // Проверяем, не занят ли MAX ID другим пользователем
    const existingUser = await this.findByMaxId(maxId);
    console.log("🔍 Existing user with this MAX ID:", existingUser);

    if (existingUser) {
      if (existingUser.phone === phone) {
        console.log("✅ MAX ID already belongs to this user");
        return true;
      } else {
        console.log(
          "❌ MAX ID already taken by different user:",
          existingUser.phone,
        );
        return false;
      }
    }

    // MAX ID свободен - сохраняем
    await dbService.updateUser(user.id, { maxId });
    console.log("✅ MAX ID saved successfully for user:", user.fullName);
    return true;
  },

  // Проверка, зарегистрирован ли MAX ID
  async isMaxIdRegistered(maxId) {
    console.log("🔍 Checking if MAX ID is registered:", maxId);
    const user = await this.findByMaxId(maxId);
    console.log("📊 isMaxIdRegistered result:", !!user);
    return user;
  },

  // Получение данных пользователя для отображения
  async getUserDisplayData(phone) {
    const user = await this.findByPhone(phone);
    if (!user) return null;

    // Получаем дополнительную информацию
    const parents = await dbService.getParentsByUserId(user.id);
    const mentors = await dbService.getMentorsByUserId(user.id);

    return {
      schoolId: user.schoolId,
      fullName: user.fullName,
      group: user.groupName,
      role: user.role,
      email: user.email,
      maxId: user.maxId,
      firstName: user.firstName,
      lastName: user.lastName,
      parents: parents,
      mentors: mentors,
    };
  },

  // Получение всех учеников класса
  async getStudentsByClass(className) {
    return dbService.getStudentsByClass(className);
  },

  // Получение всех учителей
  async getTeachers() {
    return dbService.getTeachers();
  },

  // Поиск пользователей
  async search(query) {
    return dbService.searchUsers(query);
  },
};

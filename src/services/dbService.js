// src/services/dbService.js
import { openDb } from "../config/database.js";

class DbService {
  constructor() {
    this.db = null;
  }

  async init() {
    if (!this.db) {
      const { initializeDatabase } = await import("../config/database.js");
      this.db = await initializeDatabase();
    }
    return this.db;
  }

  async getUserById(id) {
    const db = await this.init();
    return db.get("SELECT * FROM users WHERE id = ?", id);
  }

  async getUserBySchoolId(schoolId) {
    const db = await this.init();
    return db.get("SELECT * FROM users WHERE schoolId = ?", schoolId);
  }

  async getUserByPhone(phone) {
    const db = await this.init();
    // Очищаем номер от лишних символов
    const cleanPhone = phone.replace(/\D/g, "");
    return db.get("SELECT * FROM users WHERE phone = ?", cleanPhone);
  }

  async getUserByMaxId(maxId) {
    const db = await this.init();
    return db.get("SELECT * FROM users WHERE maxId = ?", maxId);
  }

  async getUserByEmail(email) {
    const db = await this.init();
    return db.get("SELECT * FROM users WHERE email = ?", email);
  }

  async createUser(userData) {
    const db = await this.init();

    const {
      schoolId,
      phone,
      email,
      fullName,
      firstName,
      lastName,
      middleName,
      role,
      groupName,
      maxId,
      birthDate,
      age,
      sex,
      snils,
      classLevel,
      additionalData = {},
    } = userData;

    // Очищаем телефон
    const cleanPhone = phone ? phone.replace(/\D/g, "") : null;

    const result = await db.run(
      `INSERT INTO users (
        schoolId, phone, email, fullName, firstName, lastName,
        middleName, role, groupName, maxId, birthDate, age,
        sex, snils, classLevel, additionalData
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolId,
        cleanPhone,
        email,
        fullName,
        firstName,
        lastName,
        middleName,
        role,
        groupName,
        maxId,
        birthDate,
        age,
        sex,
        snils,
        classLevel,
        JSON.stringify(additionalData),
      ],
    );

    return this.getUserById(result.lastID);
  }

  async updateUser(id, updates) {
    const db = await this.init();

    const allowedFields = [
      "phone",
      "email",
      "fullName",
      "firstName",
      "lastName",
      "middleName",
      "role",
      "groupName",
      "maxId",
      "birthDate",
      "age",
      "sex",
      "snils",
      "classLevel",
      "additionalData",
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        if (key === "phone") {
          values.push(value ? value.replace(/\D/g, "") : null);
        } else if (key === "additionalData") {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return null;

    values.push(id);
    await db.run(
      `UPDATE users SET ${fields.join(", ")}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      values,
    );

    return this.getUserById(id);
  }
  async getUserByMaxId(maxId) {
    const db = await this.init();
    console.log("🔍 DB: Searching for MAX ID:", maxId);
    const user = await db.get("SELECT * FROM users WHERE maxId = ?", maxId);
    console.log("📊 DB: Found user:", user ? user.fullName : "not found");
    return user;
  }
  async deleteUser(id) {
    const db = await this.init();
    await db.run("DELETE FROM users WHERE id = ?", id);
  }

  async addParent(userId, parentData) {
    const db = await this.init();

    const { name, phone, email, snils, type = "parent" } = parentData;

    const result = await db.run(
      `INSERT INTO parents (userId, name, phone, email, snils, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name, phone, email, snils, type],
    );

    return this.getParentById(result.lastID);
  }

  async getParentById(id) {
    const db = await this.init();
    return db.get("SELECT * FROM parents WHERE id = ?", id);
  }

  async getParentsByUserId(userId) {
    const db = await this.init();
    return db.all("SELECT * FROM parents WHERE userId = ?", userId);
  }

  async addMentor(userId, mentorName, mentorId = null) {
    const db = await this.init();

    const result = await db.run(
      `INSERT INTO mentors (userId, mentorName, mentorId)
       VALUES (?, ?, ?)`,
      [userId, mentorName, mentorId],
    );

    return this.getMentorById(result.lastID);
  }

  async getMentorById(id) {
    const db = await this.init();
    return db.get("SELECT * FROM mentors WHERE id = ?", id);
  }

  async getMentorsByUserId(userId) {
    const db = await this.init();
    return db.all("SELECT * FROM mentors WHERE userId = ?", userId);
  }

  async getAllUsers(filters = {}) {
    const db = await this.init();

    let query = "SELECT * FROM users";
    const where = [];
    const params = [];

    if (filters.role) {
      where.push("role = ?");
      params.push(filters.role);
    }
    if (filters.groupName) {
      where.push("groupName = ?");
      params.push(filters.groupName);
    }
    if (filters.classLevel) {
      where.push("classLevel = ?");
      params.push(filters.classLevel);
    }
    if (filters.hasMaxId !== undefined) {
      if (filters.hasMaxId) {
        where.push("maxId IS NOT NULL");
      } else {
        where.push("maxId IS NULL");
      }
    }

    if (where.length > 0) {
      query += " WHERE " + where.join(" AND ");
    }

    query += " ORDER BY fullName";

    return db.all(query, params);
  }

  async getStudentsByClass(groupName) {
    return this.getAllUsers({ role: "student", groupName });
  }

  async getTeachers() {
    return this.getAllUsers({ role: "teacher" });
  }

  async getUnregisteredUsers() {
    return this.getAllUsers({ hasMaxId: false });
  }

  async searchUsers(searchTerm) {
    const db = await this.init();

    const term = `%${searchTerm}%`;
    return db.all(
      `SELECT * FROM users 
       WHERE fullName LIKE ? 
          OR phone LIKE ? 
          OR email LIKE ? 
          OR snils LIKE ?
       ORDER BY fullName`,
      [term, term, term, term],
    );
  }
}

// Создаем и экспортируем единственный экземпляр сервиса
export const dbService = new DbService();

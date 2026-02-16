// src/config/database.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу базы данных
const dbPath = join(__dirname, "../../database.sqlite");

// Открываем соединение с базой данных
export async function openDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
}

// Инициализация базы данных (создание таблиц)
export async function initializeDatabase() {
  const db = await openDb();

  // Создаем таблицу пользователей
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schoolId INTEGER UNIQUE,
      phone TEXT UNIQUE,
      email TEXT,
      fullName TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      middleName TEXT,
      role TEXT CHECK(role IN ('student', 'teacher', 'parent', 'admin')) DEFAULT 'student',
      groupName TEXT,
      maxId TEXT UNIQUE,
      birthDate TEXT,
      age INTEGER,
      sex TEXT CHECK(sex IN ('male', 'female', 'other')),
      snils TEXT UNIQUE,
      classLevel TEXT,
      additionalData TEXT, -- JSON поле для хранения дополнительных данных
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Создаем таблицу для родителей/опекунов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      snils TEXT,
      type TEXT DEFAULT 'parent',
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Создаем таблицу для наставников/учителей
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mentors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      mentorName TEXT NOT NULL,
      mentorId INTEGER,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (mentorId) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  console.log("✅ Database initialized successfully");
  return db;
}

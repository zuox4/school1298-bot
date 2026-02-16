import { STATES } from "../config/constants.js";
// Хранилище сессий (только для временных состояний)
const userSessions = new Map();

// Состояния пользователей (импортируем из constants)

export function getUserSession(userId) {
  if (!userId) return null;

  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      state: STATES.IDLE,
      tempData: {}, // только временные данные для процесса регистрации
    });
  }

  return userSessions.get(userId);
}

export function updateUserSession(userId, data) {
  const session = getUserSession(userId);
  if (session) {
    Object.assign(session, data);
  }
  return session;
}

export function resetUserSession(userId) {
  if (userSessions.has(userId)) {
    userSessions.set(userId, {
      state: STATES.IDLE,
      tempData: {},
    });
  }
}

// ⚠️ ВНИМАНИЕ: isAuthorized больше не используем!
// Авторизация проверяется по БД, а не по сессии

import { Keyboard } from "@maxhub/max-bot-api";
import { URLS } from "../config/constants.js";

export function getAuthKeyboard() {
  return Keyboard.inlineKeyboard([
    [Keyboard.button.requestContact("📱 Авторизоваться по номеру телефона")],
    [Keyboard.button.link("🔗 Открыть MAX", URLS.MAX)],
  ]);
}

export function getRetryKeyboard() {
  return Keyboard.inlineKeyboard([
    [Keyboard.button.requestContact("📱 Попробовать снова")],
  ]);
}

export function getConfirmationKeyboard() {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback("✅ Да, это я", "confirm_data"),
      Keyboard.button.callback("❌ Нет, это не я", "reject_data"),
    ],
  ]);
}

export function getMainKeyboard() {
  return Keyboard.inlineKeyboard([
    [Keyboard.button.link("🔗 Открыть MAX", URLS.MAX)],
    [Keyboard.button.callback("📋 Мои данные", "show_my_data")],
    [Keyboard.button.callback("ℹ️ Помощь", "help_callback")],
  ]);
}

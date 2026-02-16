import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Конфигурация SMTP Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER, // ваш email
    pass: process.env.SMTP_PASS, // пароль приложения (не обычный пароль!)
  },
});

// Генерация 6-значного кода
export function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Отправка кода на email
export async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: "Код подтверждения для авторизации в боте Школы 1298",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Подтверждение email</h2>
        <p>Здравствуйте!</p>
        <p>Вы начали процесс авторизации в боте Школы 1298 Профиль Куркино.</p>
        <p>Ваш код подтверждения:</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${code}
        </div>
        <p>Код действителен в течение 5 минут.</p>
        <p>Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
        <hr>
        <p style="color: #7f8c8d; font-size: 12px;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Проверка срока действия кода
export function isCodeValid(creationTime) {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return now - creationTime < fiveMinutes;
}

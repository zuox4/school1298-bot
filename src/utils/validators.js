export function isOwnContact(ctx, contact) {
  const userPhone = ctx.update?.message?.sender?.phone;

  if (userPhone && contact.tel) {
    const cleanUserPhone = userPhone.replace(/\D/g, "");
    const cleanContactPhone = contact.tel.replace(/\D/g, "");
    return cleanUserPhone === cleanContactPhone;
  }

  // В продакшене добавить более надежную проверку
  return true;
}

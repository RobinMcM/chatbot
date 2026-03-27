const EMAIL_COOKIE_NAME = 'chatbot_email';
const EMAIL_COOKIE_MAX_AGE_DAYS = 365;

export function getEmailFromCookie() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${EMAIL_COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1].trim()) : null;
  return value || null;
}

export function setEmailCookie(email) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent((email || '').trim());
  const maxAge = value ? EMAIL_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 : 0;
  document.cookie = `${EMAIL_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

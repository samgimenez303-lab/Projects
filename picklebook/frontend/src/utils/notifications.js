// Notifications may link within PickleBook, but never to another website.
export const notificationLink = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://picklebook.invalid');
    return url.origin === 'https://picklebook.invalid' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
};

export const isUnreadNotification = (notification) => Number(notification.is_read) === 0;

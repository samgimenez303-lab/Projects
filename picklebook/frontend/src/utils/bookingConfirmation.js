export const savedBookingForRoute = (id, state) => {
  const reservation = state?.savedReservation;
  return state?.booked === true && reservation?.id != null && String(reservation.id) === String(id)
    ? reservation : null;
};

export const bookingEmailNotice = (delivery) => {
  switch (delivery?.status) {
    case 'sent':
      return delivery.receipt_attached
        ? 'Your thank-you email was sent with a printable booking receipt attached. Check your inbox or spam folder.'
        : 'Your booking email was sent. You can print your booking receipt here.';
    case 'simulated':
      return 'Email is in preview mode, so no email was sent. Your booking receipt is ready to print here.';
    case 'failed':
      return 'Your reservation is saved, but we couldn’t send the email. You can still print your booking receipt here.';
    case 'unconfirmed':
      return 'Your reservation is saved. Email delivery is not confirmed yet; please check your inbox. Your booking receipt is also ready to print here.';
    default:
      return 'Your booking receipt is ready to print. Email delivery status is unavailable.';
  }
};

export const getCourtImage = (court) => {
  const type = court.court_type === 'indoor' ? 'indoor' : 'outdoor';
  const defaultImage = `/court-${type}.svg`;
  // Courts 1–4 use the supplied photos, including existing bookings/listings
  // whose database image records still point to the original illustrations.
  const imageUrl = [1, 2, 3, 4].includes(Number(court.id))
    ? `/images/court-${type}.jpg`
    : court.images?.[0]?.image_url || court.primary_image_url || court.image_url || defaultImage;

  return { imageUrl, defaultImage };
};

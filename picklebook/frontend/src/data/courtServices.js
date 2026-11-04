// These describe court types; reservations always use a real court ID and its hourly rate.
export const COURT_SERVICES = [
  {
    category: 'indoor',
    name: 'Indoor Pickleball',
    eyebrow: 'Stay covered. Stay in the game.',
    description: 'Indoor court reservations for practice and matches. Court 3 - Indoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate and availability.',
    image_url: '/court-indoor.svg',
    features: ['Covered playing area', 'Court facilities listed before booking', 'Hourly reservations for your group'],
    idealFor: 'Covered practice and planned sessions',
  },
  {
    category: 'outdoor',
    name: 'Outdoor Pickleball',
    eyebrow: 'Fresh air. A little friendly competition.',
    description: 'Open-air court reservations for your group. Court 4 - Outdoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate, operating hours, and availability.',
    image_url: '/court-outdoor.svg',
    features: ['Open-air playing area', 'Lighting details on each court', 'Hourly reservations for your group'],
    idealFor: 'Open-air matches with friends',
  },
];

export const getCourtService = (category) => COURT_SERVICES.find((service) => service.category === category);

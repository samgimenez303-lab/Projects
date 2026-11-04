require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@picklebook.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  console.log('Seeding initial system data...');

  try {
    // 1. Seed or update Admin User
    const [existingUsers] = await pool.execute('SELECT id, email, role FROM users WHERE email = ?', [adminEmail]);

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (existingUsers.length > 0) {
      console.log(`Admin user (${adminEmail}) already exists. Updating password and permissions...`);
      await pool.execute(
        'UPDATE users SET name = ?, password = ?, role = "admin", email_verified = 1, is_active = 1 WHERE email = ?',
        [adminName, hashedPassword, adminEmail]
      );
    } else {
      console.log(`Creating default admin user: ${adminEmail}`);
      await pool.execute(
        'INSERT INTO users (name, email, password, role, email_verified, is_active) VALUES (?, ?, ?, "admin", 1, 1)',
        [adminName, adminEmail, hashedPassword]
      );
    }

    // 2. Check if default courts exist; if empty, seed default courts
    const [existingCourts] = await pool.execute('SELECT COUNT(*) as count FROM courts');
    if (existingCourts[0].count === 0) {
      console.log('No courts found. Seeding initial courts and operating hours...');
      const courtsData = [
        {
          name: 'Court 1 - Championship Court',
          description: 'Premium outdoor championship standard court with pro cushioning and LED tournament lighting.',
          court_type: 'outdoor',
          surface_type: 'cushioned acrylic',
          price_per_hour: 400.00,
          max_players: 4,
          has_lighting: 1,
          has_seating: 1,
          sort_order: 1
        },
        {
          name: 'Court 2 - Covered Pavilion Court',
          description: 'Weather-protected indoor court with high-performance sports floor and climate control.',
          court_type: 'indoor',
          surface_type: 'hardwood composite',
          price_per_hour: 500.00,
          max_players: 4,
          has_lighting: 1,
          has_seating: 1,
          sort_order: 2
        },
        {
          name: 'Court 3 - Indoor Court + Pickle Paddle and Balls',
          description: 'Indoor court with a pickleball paddle and balls included for your session.',
          court_type: 'indoor',
          surface_type: 'concrete',
          price_per_hour: 350.00,
          max_players: 4,
          has_lighting: 1,
          has_seating: 0,
          sort_order: 3
        },
        {
          name: 'Court 4 - Outdoor Court + Pickle Paddle and Balls',
          description: 'Outdoor court with a pickleball paddle and balls included for your session.',
          court_type: 'outdoor',
          surface_type: 'asphalt',
          price_per_hour: 700.00,
          max_players: 4,
          has_lighting: 1,
          has_seating: 0,
          sort_order: 4
        }
      ];

      for (const court of courtsData) {
        const [result] = await pool.execute(
          `INSERT INTO courts (name, description, court_type, surface_type, price_per_hour, max_players, has_lighting, has_seating, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            court.name,
            court.description,
            court.court_type,
            court.surface_type,
            court.price_per_hour,
            court.max_players,
            court.has_lighting,
            court.has_seating,
            court.sort_order
          ]
        );
        const courtId = result.insertId;

        // Operating hours: Monday through Sunday, 06:00 to 22:00
        for (let day = 0; day <= 6; day++) {
          await pool.execute(
            `INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed)
             VALUES (?, ?, '06:00:00', '22:00:00', 0)`,
            [courtId, day]
          );
        }
      }
      console.log('Sample courts and operating hours created.');
    }

    // 3. Check if default services exist; if empty, seed services
    const [existingServices] = await pool.execute('SELECT COUNT(*) as count FROM services');
    if (existingServices[0].count === 0) {
      console.log('No services found. Seeding initial services...');
      const servicesData = [
        {
          name: 'Indoor Pickleball',
          description: 'Indoor court reservations for practice and matches. Court 3 - Indoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate and availability.',
          category: 'indoor',
          price: 0,
          duration_minutes: null,
          max_quantity: null,
          sort_order: 1
        },
        {
          name: 'Outdoor Pickleball',
          description: 'Open-air court reservations for your group. Court 4 - Outdoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate, operating hours, and availability.',
          category: 'outdoor',
          price: 0,
          duration_minutes: null,
          max_quantity: null,
          sort_order: 2
        }
      ];

      for (const s of servicesData) {
        await pool.execute(
          `INSERT INTO services (name, description, category, price, duration_minutes, max_quantity, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.name, s.description, s.category, s.price, s.duration_minutes, s.max_quantity, s.sort_order]
        );
      }
      console.log('Sample services created.');
    }

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
};

if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('Seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed script error:', err);
      process.exit(1);
    });
}

module.exports = seedAdmin;

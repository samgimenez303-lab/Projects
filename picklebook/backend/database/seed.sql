-- PickleBook Seed Data (Development Only)
-- DO NOT use in production. Contains sample data only.

USE picklebook;

-- ============================================
-- SAMPLE COURTS
-- ============================================
INSERT INTO courts (name, description, court_type, surface_type, price_per_hour, max_players, has_lighting, has_seating, is_active, sort_order) VALUES
('Court 1 - Palm Arena', 'Premium indoor court with professional-grade surface and climate control. Perfect for competitive play.', 'indoor', 'sport_court', 800.00, 4, 1, 1, 1, 1),
('Court 2 - Sunrise Court', 'Beautiful outdoor court with panoramic views. Well-maintained surface ideal for morning games.', 'outdoor', 'concrete', 500.00, 4, 1, 0, 1, 2),
('Court 3 - Indoor Court + Pickle Paddle and Balls', 'Tournament-ready indoor court with spectator seating and professional lighting. A pickleball paddle and balls are included for your session.', 'indoor', 'sport_court', 1000.00, 4, 1, 1, 1, 3),
('Court 4 - Outdoor Court + Pickle Paddle and Balls', 'Scenic outdoor court surrounded by landscaped gardens. A relaxing place to play. A pickleball paddle and balls are included for your session.', 'outdoor', 'asphalt', 700.00, 4, 1, 0, 1, 4),
('Court 5 - Pro Court', 'Professional-grade indoor court with shock-absorbing floor and premium nets.', 'indoor', 'cushioned', 1200.00, 4, 1, 1, 1, 5),
('Court 6 - Twilight Court', 'Outdoor court with premium LED lighting for evening play sessions.', 'outdoor', 'concrete', 600.00, 4, 1, 1, 1, 6);

-- ============================================
-- COURT IMAGES
-- ============================================
INSERT INTO court_images (court_id, image_url, alt_text, is_primary, sort_order) VALUES
(1, '/court-indoor.svg', 'Palm Arena indoor court illustration', 1, 1),
(2, '/court-outdoor.svg', 'Sunrise outdoor court illustration', 1, 1),
(3, '/court-indoor.svg', 'Indoor court with pickle paddle and balls illustration', 1, 1),
(4, '/court-outdoor.svg', 'Outdoor court with pickle paddle and balls illustration', 1, 1),
(5, '/court-indoor.svg', 'Pro indoor court illustration', 1, 1),
(6, '/court-outdoor.svg', 'Twilight outdoor court illustration', 1, 1);

-- ============================================
-- COURT OPERATING HOURS (All courts: 6 AM - 10 PM, closed on some days)
-- ============================================
-- Court 1 (Mon-Sun)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(1, 0, '08:00', '20:00', 0),
(1, 1, '06:00', '22:00', 0),
(1, 2, '06:00', '22:00', 0),
(1, 3, '06:00', '22:00', 0),
(1, 4, '06:00', '22:00', 0),
(1, 5, '06:00', '22:00', 0),
(1, 6, '08:00', '20:00', 0);

-- Court 2 (Mon-Sat, closed Sunday)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(2, 0, '00:00', '00:00', 1),
(2, 1, '06:00', '20:00', 0),
(2, 2, '06:00', '20:00', 0),
(2, 3, '06:00', '20:00', 0),
(2, 4, '06:00', '20:00', 0),
(2, 5, '06:00', '20:00', 0),
(2, 6, '07:00', '18:00', 0);

-- Court 3 (Mon-Sun)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(3, 0, '08:00', '20:00', 0),
(3, 1, '06:00', '22:00', 0),
(3, 2, '06:00', '22:00', 0),
(3, 3, '06:00', '22:00', 0),
(3, 4, '06:00', '22:00', 0),
(3, 5, '06:00', '22:00', 0),
(3, 6, '08:00', '20:00', 0);

-- Court 4 (Mon-Fri only)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(4, 0, '00:00', '00:00', 1),
(4, 1, '07:00', '19:00', 0),
(4, 2, '07:00', '19:00', 0),
(4, 3, '07:00', '19:00', 0),
(4, 4, '07:00', '19:00', 0),
(4, 5, '07:00', '19:00', 0),
(4, 6, '00:00', '00:00', 1);

-- Court 5 (Mon-Sun)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(5, 0, '09:00', '21:00', 0),
(5, 1, '06:00', '22:00', 0),
(5, 2, '06:00', '22:00', 0),
(5, 3, '06:00', '22:00', 0),
(5, 4, '06:00', '22:00', 0),
(5, 5, '06:00', '22:00', 0),
(5, 6, '09:00', '21:00', 0);

-- Court 6 (Mon-Sun)
INSERT INTO court_operating_hours (court_id, day_of_week, open_time, close_time, is_closed) VALUES
(6, 0, '08:00', '22:00', 0),
(6, 1, '06:00', '22:00', 0),
(6, 2, '06:00', '22:00', 0),
(6, 3, '06:00', '22:00', 0),
(6, 4, '06:00', '22:00', 0),
(6, 5, '06:00', '22:00', 0),
(6, 6, '08:00', '22:00', 0);

-- ============================================
-- COURT SERVICES (discovery only; each booking is priced by its selected court)
-- ============================================
INSERT INTO services (name, description, category, price, duration_minutes, image_url, is_active, max_quantity, sort_order) VALUES
('Indoor Pickleball', 'Indoor court reservations for practice and matches. Court 3 - Indoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate and availability.', 'indoor', 0.00, NULL, '/court-indoor.svg', 1, NULL, 1),
('Outdoor Pickleball', 'Open-air court reservations for your group. Court 4 - Outdoor Court + Pickle Paddle and Balls includes a pickleball paddle and balls. Check each court for its hourly rate, operating hours, and availability.', 'outdoor', 0.00, NULL, '/court-outdoor.svg', 1, NULL, 2);

USE bmw_app;

SET NAMES utf8mb4;

DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS configurations;
DROP TABLE IF EXISTS interiors;
DROP TABLE IF EXISTS wheels;
DROP TABLE IF EXISTS colors;
DROP TABLE IF EXISTS models;

CREATE TABLE models (
  id              INT PRIMARY KEY,
  legacy_model_id INT,
  code            VARCHAR(10) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  package_name    VARCHAR(50) NOT NULL,
  base_price      DECIMAL(10,2) NOT NULL,
  max_power       INT,
  drive_type      VARCHAR(50)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE colors (
  id    INT PRIMARY KEY,
  name  VARCHAR(30) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_key VARCHAR(150)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE wheels (
  id    INT PRIMARY KEY,
  name  VARCHAR(120) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_key VARCHAR(150)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE interiors (
  id        INT PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  price     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_key VARCHAR(150)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE configurations (
  id                    INT PRIMARY KEY,
  legacy_combination_id INT,
  model_id              INT NOT NULL,
  color_id              INT,
  wheels_id             INT,
  interior_id           INT,
  advantages            VARCHAR(500),
  disadvantages         VARCHAR(500),
  FOREIGN KEY (model_id) REFERENCES models(id),
  FOREIGN KEY (color_id) REFERENCES colors(id),
  FOREIGN KEY (wheels_id) REFERENCES wheels(id),
  FOREIGN KEY (interior_id) REFERENCES interiors(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE images (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  configuration_id INT NOT NULL,
  type             VARCHAR(20) NOT NULL,
  image_key        VARCHAR(150) NOT NULL,
  description      VARCHAR(255),
  FOREIGN KEY (configuration_id) REFERENCES configurations(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO models
  (id, legacy_model_id, code, name, package_name, base_price, max_power, drive_type)
VALUES
  (1, 1, '3',  'BMW 3er', 'Family', 42900.00, 156, 'Heckantrieb'),
  (2, 2, 'X5', 'BMW X5',  'Sport',  72900.00, 530, 'xDrive Allrad');

INSERT INTO colors
  (id, name, price, image_key)
VALUES
  (1, 'Black', 0.00, NULL),
  (2, 'Blue', 500.00, NULL),
  (3, 'White', 0.00, NULL),
  (4, 'Blue', 800.00, NULL);

INSERT INTO wheels
  (id, name, price, image_key)
VALUES
  (1, '18" LMR V-Speiche 780 Bicolor', 0.00, NULL),
  (2, '22" M Doppelspeiche Jet Black', 0.00, NULL),
  (3, '19" M Leichtmetallraeder Plus', 2200.00, NULL),
  (4, '23" M Performance Schmiederad', 3400.00, NULL);

INSERT INTO interiors
  (id, name, price, image_key)
VALUES
  (13, 'Veganza Schwarz', 0.00, 'configurator/13_interior.jpg'),
  (14, 'Merino Elfenbeinweiss', 1800.00, 'configurator/14_interior.jpg'),
  (15, 'Merino Coffee', 2100.00, 'configurator/15_interior.jpg');

INSERT INTO configurations
  (id, legacy_combination_id, model_id, color_id, wheels_id, interior_id, advantages, disadvantages)
VALUES
  (1,  1, 1, 1, 1, NULL, 'Klassisch,Zeitlos,Sportlich',              'Zeigt schnell Schmutz'),
  (2,  2, 1, 3, 1, NULL, 'Elegant,Gepflegt,Zeitlos',                 'Pflegeintensiv'),
  (3,  3, 1, 2, 1, NULL, 'Auffaellig,Einzigartig,Selten',            'Aufpreis faellig'),
  (4,  4, 2, 1, 2, NULL, 'Dominant,Sportlich,Exklusiv',              'Zeigt schnell Schmutz'),
  (5,  5, 2, 3, 2, NULL, 'Sauber,Modern,Repraesentativ',             'Pflegeintensiv'),
  (6,  6, 2, 4, 2, NULL, 'Elegant,Auffaellig,Sportlich',             'Aufpreis faellig'),
  (7,  7, 1, 1, 3, 13, 'Praeziser Auftritt,Dynamische Linie,Upgrade', 'Hoeherer Preis,Weniger dezent'),
  (8,  8, 1, 3, 3, 14, 'Hell,Premium,Reisekomfort',                  'Pflege der Oberflaechen noetig'),
  (9,  9, 1, 2, 3, 15, 'Expressiv,Modern,Charakterstark',            'Auffaellige Konfiguration'),
  (10, 10, 2, 1, 4, 13, 'Athletisch,Selbstbewusst,Performance',      'Hoehere Folgekosten moeglich'),
  (11, 11, 2, 3, 4, 14, 'Luxurioes,Weitlaeufig,Repraesentativ',       'Grossflaechige Pflege noetig'),
  (12, 12, 2, 4, 4, 15, 'Souveraen,Technisch,Einpraegsam',           'Deutlicher Aufpreis');

INSERT INTO images
  (configuration_id, type, image_key, description)
VALUES
  (1, 'front',   'configurator/1_front.jpg',  'BMW 318i Limousine, Schwarz, front'),
  (1, 'back',    'configurator/1_back.jpg',   'BMW 318i Limousine, Schwarz, back'),
  (1, 'wheels',  'configurator/1_wheels.jpg', 'BMW 318i Limousine, Schwarz, wheels'),
  (2, 'front',   'configurator/2_front.jpg',  'BMW 318i Limousine, Weiss, front'),
  (2, 'back',    'configurator/2_back.jpg',   'BMW 318i Limousine, Weiss, back'),
  (2, 'wheels',  'configurator/2_wheels.jpg', 'BMW 318i Limousine, Weiss, wheels'),
  (3, 'front',   'configurator/3_front.jpg',  'BMW 318i Limousine, Blau, front'),
  (3, 'back',    'configurator/3_back.jpg',   'BMW 318i Limousine, Blau, back'),
  (3, 'wheels',  'configurator/3_wheels.jpg', 'BMW 318i Limousine, Blau, wheels'),
  (4, 'front',   'configurator/4_front.jpg',  'BMW X5 M60i xDrive, Schwarz, front'),
  (4, 'back',    'configurator/4_back.jpg',   'BMW X5 M60i xDrive, Schwarz, back'),
  (4, 'wheels',  'configurator/4_wheels.jpg', 'BMW X5 M60i xDrive, Schwarz, wheels'),
  (5, 'front',   'configurator/5_front.jpg',  'BMW X5 M60i xDrive, Weiss, front'),
  (5, 'back',    'configurator/5_back.jpg',   'BMW X5 M60i xDrive, Weiss, back'),
  (5, 'wheels',  'configurator/5_wheels.jpg', 'BMW X5 M60i xDrive, Weiss, wheels'),
  (6, 'front',   'configurator/6_front.jpg',  'BMW X5 M60i xDrive, Blau, front'),
  (6, 'back',    'configurator/6_back.jpg',   'BMW X5 M60i xDrive, Blau, back'),
  (6, 'wheels',  'configurator/6_wheels.jpg', 'BMW X5 M60i xDrive, Blau, wheels'),
  (7, 'front',   'configurator/7_front.jpg',  'BMW 318i Limousine Plus, Schwarz, front'),
  (7, 'back',    'configurator/7_back.jpg',   'BMW 318i Limousine Plus, Schwarz, back'),
  (7, 'wheels',  'configurator/7_wheels.jpg', 'BMW 318i Limousine Plus, Schwarz, wheels'),
  (8, 'front',   'configurator/8_front.jpg',  'BMW 318i Limousine Plus, Weiss, front'),
  (8, 'back',    'configurator/8_back.jpg',   'BMW 318i Limousine Plus, Weiss, back'),
  (8, 'wheels',  'configurator/8_wheels.jpg', 'BMW 318i Limousine Plus, Weiss, wheels'),
  (9, 'front',   'configurator/9_front.jpg',  'BMW 318i Limousine Plus, Blau, front'),
  (9, 'back',    'configurator/9_back.jpg',   'BMW 318i Limousine Plus, Blau, back'),
  (9, 'wheels',  'configurator/9_wheels.jpg', 'BMW 318i Limousine Plus, Blau, wheels'),
  (10, 'front',  'configurator/10_front.jpg',  'BMW X5 M60i xDrive Plus, Schwarz, front'),
  (10, 'back',   'configurator/10_back.jpg',   'BMW X5 M60i xDrive Plus, Schwarz, back'),
  (10, 'wheels', 'configurator/10_wheels.jpg', 'BMW X5 M60i xDrive Plus, Schwarz, wheels'),
  (11, 'front',  'configurator/11_front.jpg',  'BMW X5 M60i xDrive Plus, Weiss, front'),
  (11, 'back',   'configurator/11_back.jpg',   'BMW X5 M60i xDrive Plus, Weiss, back'),
  (11, 'wheels', 'configurator/11_wheels.jpg', 'BMW X5 M60i xDrive Plus, Weiss, wheels'),
  (12, 'front',  'configurator/12_front.jpg',  'BMW X5 M60i xDrive Plus, Blau, front'),
  (12, 'back',   'configurator/12_back.jpg',   'BMW X5 M60i xDrive Plus, Blau, back'),
  (12, 'wheels', 'configurator/12_wheels.jpg', 'BMW X5 M60i xDrive Plus, Blau, wheels');

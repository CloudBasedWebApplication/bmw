USE bmw_app;

DROP TABLE IF EXISTS car_combinations;
DROP TABLE IF EXISTS car_models;

CREATE TABLE car_models (
  id   INT PRIMARY KEY,
  code VARCHAR(10)  NOT NULL,
  name VARCHAR(100) NOT NULL,
  package_name VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL
);

INSERT INTO car_models VALUES
(1, '3',  'BMW 3er', 'Family', 42900.00),
(2, 'X5', 'BMW X5',  'Sport',  72900.00);

CREATE TABLE car_combinations (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  model_id         INT           NOT NULL,
  color            VARCHAR(20)   NOT NULL,
  image_key        VARCHAR(150)  NOT NULL,
  image_key_back   VARCHAR(150),
  image_key_wheels VARCHAR(150),
  price_modifier   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  advantages       VARCHAR(500),
  disadvantages    VARCHAR(500),
  FOREIGN KEY (model_id) REFERENCES car_models(id)
);

-- BMW 3er combinations
INSERT INTO car_combinations
  (model_id, color, image_key, image_key_back, image_key_wheels, price_modifier, advantages, disadvantages)
VALUES
  (1, 'Black', 'configurator/3BMWBlackFamily.webp', 'configurator/3BMWBlackFamilyBack.webp', 'configurator/3BMWBlackFamilyWheels.webp', 0.00,   'Klassisch,Zeitlos,Sportlich',        'Zeigt schnell Schmutz'),
  (1, 'Blue',  'configurator/3BMWBlueFamily.webp',  'configurator/3BMWBlueFamilyBack.webp',  'configurator/3BMWBlueFamilyWheels.webp',  500.00,  'Auffällig,Einzigartig,Selten',       'Aufpreis fällig'),
  (1, 'White', 'configurator/3BMWWhiteFamily.webp', 'configurator/3BMWWhiteFamilyBack.webp', 'configurator/3BMWWhiteFamilyWheels.webp', 0.00,   'Elegant,Gepflegt,Zeitlos',           'Pflegeintensiv');

-- BMW X5 combinations
INSERT INTO car_combinations
  (model_id, color, image_key, image_key_back, image_key_wheels, price_modifier, advantages, disadvantages)
VALUES
  (2, 'Black', 'configurator/X5BMWBlackSport.webp', 'configurator/X5BMWBlackSportBack.webp', NULL,                                      0.00,   'Dominant,Sportlich,Exklusiv',        'Zeigt schnell Schmutz'),
  (2, 'Blue',  'configurator/X5BMWBlueSport.webp',  'configurator/X5BMWBlueSportBack.webp',  'configurator/X5BMWBlueSportWheels.webp',  800.00,  'Elegant,Auffällig,Sportlich',        'Aufpreis fällig'),
  (2, 'White', 'configurator/X5BMWWhiteSport.webp', 'configurator/X5BMWWhiteSportBack.webp', 'configurator/X5BMWWhiteSportWheels.webp', 0.00,   'Sauber,Modern,Repräsentativ',        'Pflegeintensiv');

CREATE DATABASE IF NOT EXISTS bmw_route_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bmw_route_service;

SET NAMES utf8mb4;

DROP TABLE IF EXISTS destinations;

CREATE TABLE destinations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  destination VARCHAR(512) NOT NULL,
  label VARCHAR(255) NOT NULL,
  value VARCHAR(512) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO destinations (
  id, name, address, destination, label, value, sort_order, active
) VALUES (
  'bmw-welt',
  'BMW Welt München',
  'Am Olympiapark 1, 80809 München',
  'BMW Welt München, Am Olympiapark 1, 80809 München, Germany',
  'BMW Welt München',
  'BMW Welt München, Am Olympiapark 1, 80809 München, Germany',
  10,
  TRUE
);

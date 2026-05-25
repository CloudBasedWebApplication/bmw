const mysql = require("mysql2/promise");

function requiredEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
  return process.env[name];
}

const pool = mysql.createPool({
  host: requiredEnv("MYSQL_HOST"),
  port: process.env.MYSQL_PORT || 3306,
  user: requiredEnv("MYSQL_USER"),
  password: requiredEnv("MYSQL_PASSWORD"),
  database: "bmw_route_service",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

module.exports = {
  pool,
};

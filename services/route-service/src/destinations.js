const { pool } = require("./db");

async function listDestinations() {
  const [rows] = await pool.query(`
    SELECT id, name, address, destination, label, value
    FROM destinations
    WHERE active = TRUE
    ORDER BY sort_order, name
  `);

  return rows;
}

module.exports = {
  listDestinations,
};

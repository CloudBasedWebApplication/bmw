const assert = require("node:assert/strict");
const test = require("node:test");

const fakeRows = [
  {
    id: "bmw-welt",
    name: "BMW Welt München",
    address: "Am Olympiapark 1, 80809 München",
    destination: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
    label: "BMW Welt München",
    value: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
  },
];

const dbPath = require.resolve("../src/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    pool: {
      queries: [],
      async query(sql) {
        this.queries.push(sql);
        return [fakeRows.map((row) => ({ ...row }))];
      },
    },
  },
};

const { listDestinations } = require("../src/destinations");
const { pool } = require("../src/db");

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }
  });
}

test("route service reads predefined BMW destinations from its database", async () => {
  const destinations = await listDestinations();

  assert.ok(Array.isArray(destinations));
  assert.equal(destinations.length, 1);
  assert.deepEqual(destinations[0], {
    id: "bmw-welt",
    name: "BMW Welt München",
    address: "Am Olympiapark 1, 80809 München",
    destination: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
    label: "BMW Welt München",
    value: "BMW Welt München, Am Olympiapark 1, 80809 München, Germany",
  });
});

test("destination query only returns active rows in stable display order", async () => {
  await listDestinations();

  const sql = pool.queries.at(-1);
  assert.match(sql, /FROM destinations/);
  assert.match(sql, /WHERE active = TRUE/);
  assert.match(sql, /ORDER BY sort_order, name/);
});

test("destination list returns fresh row objects from the database adapter", async () => {
  const first = await listDestinations();
  first[0].name = "Mutated";

  const second = await listDestinations();
  assert.equal(second[0].name, "BMW Welt München");
});

test("route service exposes health and destinations", async () => {
  const app = require("../src/server");
  const server = app.listen(0, "127.0.0.1");
  const port = await new Promise((resolve) => {
    server.once("listening", () => resolve(server.address().port));
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = await healthResponse.json();
    assert.equal(healthResponse.status, 200);
    assert.equal(health.service, "route-service");

    const destinationsResponse = await fetch(`${baseUrl}/destinations`);
    const destinations = await destinationsResponse.json();
    assert.equal(destinationsResponse.status, 200);
    assert.equal(destinations[0].id, "bmw-welt");
  } finally {
    await closeServer(server);
  }
});

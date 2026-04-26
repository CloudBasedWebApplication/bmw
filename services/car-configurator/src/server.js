const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const port = process.env.PORT || 3001;

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "mysql",
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || "bmw_user",
  password: process.env.MYSQL_PASSWORD || "change_me",
  database: process.env.MYSQL_DATABASE || "bmw_app",
  waitForConnections: true,
  connectionLimit: 10,
});

const minioBase = `http://${process.env.MINIO_PUBLIC_HOST || "localhost"}:${process.env.MINIO_PORT || 9000}/${process.env.MINIO_BUCKET || "configurator-images"}`;

app.use(express.json());

const configurationSelect = `
  SELECT
    cfg.id AS configuration_id,
    cfg.legacy_combination_id,
    cfg.advantages,
    cfg.disadvantages,
    m.id AS model_id,
    m.legacy_model_id,
    m.code,
    m.name AS model_name,
    m.package_name,
    m.base_price,
    m.max_power,
    m.drive_type,
    c.id AS color_id,
    c.name AS color_name,
    c.price AS color_price,
    w.id AS wheels_id,
    w.name AS wheels_name,
    w.price AS wheels_price,
    i.id AS interior_id,
    i.name AS interior_name,
    i.price AS interior_price
  FROM configurations cfg
  JOIN models m ON cfg.model_id = m.id
  LEFT JOIN colors c ON cfg.color_id = c.id
  LEFT JOIN wheels w ON cfg.wheels_id = w.id
  LEFT JOIN interiors i ON cfg.interior_id = i.id
`;

function parseMoney(value) {
  return Number.parseFloat(value || 0);
}

function parseCsvList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function imageUrl(imageKey) {
  return imageKey ? `${minioBase}/${imageKey}` : null;
}

function mapImageUrls(images) {
  return Object.fromEntries(
    Object.entries(images).map(([type, key]) => [type, imageUrl(key)])
  );
}

function mapModel(row) {
  return {
    id: row.model_id,
    code: row.code,
    name: row.model_name,
    packageName: row.package_name,
    basePrice: parseMoney(row.base_price),
    maxPower: row.max_power,
    driveType: row.drive_type,
  };
}

function mapOption(id, name, price) {
  if (!id) return null;
  return {
    id,
    name,
    price: parseMoney(price),
  };
}

function mapOptionalEntity(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    price: parseMoney(row.price),
    imageKey: row.image_key || null,
    imageUrl: imageUrl(row.image_key),
  };
}

function buildPriceDetails(row) {
  const basePrice = parseMoney(row.base_price);
  const colorPrice = parseMoney(row.color_price);
  const wheelsPrice = parseMoney(row.wheels_price);
  const interiorPrice = parseMoney(row.interior_price);

  return {
    basePrice,
    colorPrice,
    wheelsPrice,
    interiorPrice,
    totalPrice: basePrice + colorPrice + wheelsPrice + interiorPrice,
  };
}

function mapConfigurationSummary(row) {
  return {
    id: row.configuration_id,
    model: {
      id: row.model_id,
      name: row.model_name,
      packageName: row.package_name,
    },
    color: mapOption(row.color_id, row.color_name, row.color_price),
    wheels: mapOption(row.wheels_id, row.wheels_name, row.wheels_price),
    interior: mapOption(row.interior_id, row.interior_name, row.interior_price),
    advantages: row.advantages,
    disadvantages: row.disadvantages,
    totalPrice: buildPriceDetails(row).totalPrice,
  };
}

function groupImages(rows) {
  const grouped = {};

  for (const row of rows) {
    if (!row.type || !row.image_key) continue;
    grouped[row.type] = row.image_key;
  }

  return grouped;
}

async function getImagesByConfigurationId(configurationId) {
  const [rows] = await pool.query(
    "SELECT type, image_key FROM images WHERE configuration_id = ? ORDER BY id",
    [configurationId]
  );

  return groupImages(rows);
}

async function getConfigurationRowById(configurationId) {
  const [rows] = await pool.query(
    `${configurationSelect}
     WHERE cfg.id = ?`,
    [configurationId]
  );

  return rows[0] || null;
}

async function getConfigurationRowByModelAndColor(modelCode, colorName) {
  const [rows] = await pool.query(
    `${configurationSelect}
     WHERE m.code = ? AND c.name = ?
     ORDER BY cfg.id
     LIMIT 1`,
    [modelCode, colorName]
  );

  return rows[0] || null;
}

async function getConfigurationRowByModelAndColorIds(modelId, colorId) {
  if (!modelId || !colorId) return null;

  const [rows] = await pool.query(
    `${configurationSelect}
     WHERE cfg.model_id = ? AND cfg.color_id = ?
     ORDER BY cfg.id
     LIMIT 1`,
    [modelId, colorId]
  );

  return rows[0] || null;
}

async function getConfigurationRowBySelection(modelId, colorId, wheelsId, interiorId) {
  const [rows] = await pool.query(
    `${configurationSelect}
     WHERE cfg.model_id = ?
       AND cfg.color_id <=> ?
       AND cfg.wheels_id <=> ?
       AND cfg.interior_id <=> ?
     ORDER BY cfg.id
     LIMIT 1`,
    [modelId, colorId, wheelsId, interiorId]
  );

  return rows[0] || null;
}

async function getModelById(modelId) {
  const [rows] = await pool.query(
    `SELECT id, code, name, package_name, base_price, max_power, drive_type
     FROM models
     WHERE id = ?`,
    [modelId]
  );

  return rows[0] || null;
}

async function getOptionalEntity(table, id) {
  if (id == null) return null;

  const allowedTables = new Set(["colors", "wheels", "interiors"]);
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table lookup: ${table}`);
  }

  const [rows] = await pool.query(
    `SELECT id, name, price, image_key FROM ${table} WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
}

async function getAllOptionalEntities(table, modelId = null) {
  const allowedTables = new Set(["colors", "wheels", "interiors"]);
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table lookup: ${table}`);
  }

  const joinColumn = {
    colors: "color_id",
    wheels: "wheels_id",
    interiors: "interior_id",
  }[table];

  const query = modelId == null
    ? `SELECT id, name, price, image_key
       FROM ${table}
       ORDER BY id`
    : `SELECT DISTINCT entity.id, entity.name, entity.price, entity.image_key
       FROM ${table} entity
       JOIN configurations cfg ON cfg.${joinColumn} = entity.id
       WHERE cfg.model_id = ?
       ORDER BY entity.id`;

  const params = modelId == null ? [] : [modelId];
  const [rows] = await pool.query(query, params);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: parseMoney(row.price),
    imageKey: row.image_key || null,
    imageUrl: imageUrl(row.image_key),
  }));
}

function sendJsonError(res, status, message, details) {
  return res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
  });
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/models", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         code,
         name,
         package_name AS packageName,
         base_price AS basePrice,
         max_power AS maxPower,
         drive_type AS driveType
       FROM models
       ORDER BY id`
    );

    res.json(rows.map((row) => ({
      ...row,
      basePrice: parseMoney(row.basePrice),
    })));
  } catch (err) {
    sendJsonError(res, 500, "Failed to load models", err.message);
  }
});

app.get("/options/colors", async (req, res) => {
  const modelId = req.query.modelId == null
    ? null
    : Number.parseInt(req.query.modelId, 10);

  if (req.query.modelId != null && (!Number.isInteger(modelId) || modelId <= 0)) {
    return sendJsonError(res, 400, "modelId must be a positive integer");
  }

  try {
    res.json(await getAllOptionalEntities("colors", modelId));
  } catch (err) {
    sendJsonError(res, 500, "Failed to load colors", err.message);
  }
});

app.get("/options/wheels", async (req, res) => {
  const modelId = req.query.modelId == null
    ? null
    : Number.parseInt(req.query.modelId, 10);

  if (req.query.modelId != null && (!Number.isInteger(modelId) || modelId <= 0)) {
    return sendJsonError(res, 400, "modelId must be a positive integer");
  }

  try {
    res.json(await getAllOptionalEntities("wheels", modelId));
  } catch (err) {
    sendJsonError(res, 500, "Failed to load wheels", err.message);
  }
});

app.get("/options/interiors", async (req, res) => {
  const modelId = req.query.modelId == null
    ? null
    : Number.parseInt(req.query.modelId, 10);

  if (req.query.modelId != null && (!Number.isInteger(modelId) || modelId <= 0)) {
    return sendJsonError(res, 400, "modelId must be a positive integer");
  }

  try {
    res.json(await getAllOptionalEntities("interiors", modelId));
  } catch (err) {
    sendJsonError(res, 500, "Failed to load interiors", err.message);
  }
});

app.get("/configurations", async (_req, res) => {
  try {
    const [rows] = await pool.query(`${configurationSelect} ORDER BY cfg.id`);
    res.json(rows.map(mapConfigurationSummary));
  } catch (err) {
    sendJsonError(res, 500, "Failed to load configurations", err.message);
  }
});

app.get("/configurations/:id", async (req, res) => {
  const configurationId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(configurationId) || configurationId <= 0) {
    return sendJsonError(res, 400, "configuration id must be a positive integer");
  }

  try {
    const row = await getConfigurationRowById(configurationId);

    if (!row) {
      return sendJsonError(res, 404, "Configuration not found");
    }

    const images = await getImagesByConfigurationId(configurationId);
    const imageUrls = mapImageUrls(images);

    res.json({
      id: row.configuration_id,
      model: mapModel(row),
      color: mapOption(row.color_id, row.color_name, row.color_price),
      wheels: mapOption(row.wheels_id, row.wheels_name, row.wheels_price),
      interior: mapOption(row.interior_id, row.interior_name, row.interior_price),
      advantages: row.advantages,
      disadvantages: row.disadvantages,
      images,
      imageUrls,
      price: buildPriceDetails(row),
    });
  } catch (err) {
    sendJsonError(res, 500, "Failed to load configuration", err.message);
  }
});

app.post("/configuration/calculate", async (req, res) => {
  const {
    modelId,
    colorId = null,
    wheelsId = null,
    interiorId = null,
  } = req.body || {};

  if (!Number.isInteger(modelId) || modelId <= 0) {
    return sendJsonError(res, 400, "modelId must be a positive integer");
  }

  const optionalIds = [
    { key: "colorId", value: colorId },
    { key: "wheelsId", value: wheelsId },
    { key: "interiorId", value: interiorId },
  ];

  for (const item of optionalIds) {
    if (item.value == null) continue;
    if (!Number.isInteger(item.value) || item.value <= 0) {
      return sendJsonError(res, 400, `${item.key} must be null or a positive integer`);
    }
  }

  try {
    const [model, color, wheels, interior] = await Promise.all([
      getModelById(modelId),
      getOptionalEntity("colors", colorId),
      getOptionalEntity("wheels", wheelsId),
      getOptionalEntity("interiors", interiorId),
    ]);

    if (!model) {
      return sendJsonError(res, 404, "Model not found");
    }
    if (colorId != null && !color) {
      return sendJsonError(res, 400, "Invalid colorId");
    }
    if (wheelsId != null && !wheels) {
      return sendJsonError(res, 400, "Invalid wheelsId");
    }
    if (interiorId != null && !interior) {
      return sendJsonError(res, 400, "Invalid interiorId");
    }

    const basePrice = parseMoney(model.base_price);
    const colorPrice = parseMoney(color?.price);
    const wheelsPrice = parseMoney(wheels?.price);
    const interiorPrice = parseMoney(interior?.price);

    const [exactConfig, exteriorConfig] = await Promise.all([
      getConfigurationRowBySelection(modelId, colorId, wheelsId, interiorId),
      colorId != null ? getConfigurationRowByModelAndColorIds(modelId, colorId) : Promise.resolve(null),
    ]);

    let exteriorImages = {};
    let exactImages = {};
    const imageRequests = [];

    if (exteriorConfig) {
      imageRequests.push(
        getImagesByConfigurationId(exteriorConfig.configuration_id).then((imageKeys) => {
          exteriorImages = mapImageUrls(imageKeys);
        })
      );
    }

    if (exactConfig) {
      imageRequests.push(
        getImagesByConfigurationId(exactConfig.configuration_id).then((imageKeys) => {
          exactImages = mapImageUrls(imageKeys);
        })
      );
    }

    await Promise.all(imageRequests);

    res.json({
      model: {
        id: model.id,
        code: model.code,
        name: model.name,
        packageName: model.package_name,
        basePrice: basePrice,
        maxPower: model.max_power,
        driveType: model.drive_type,
      },
      color: mapOptionalEntity(color),
      wheels: mapOptionalEntity(wheels),
      interior: mapOptionalEntity(interior),
      basePrice,
      colorPrice,
      wheelsPrice,
      interiorPrice,
      totalPrice: basePrice + colorPrice + wheelsPrice + interiorPrice,
      previewImages: {
        front: exteriorImages.front || null,
        back: exteriorImages.back || null,
        wheels: exactImages.wheels || exteriorImages.wheels || (wheels ? imageUrl(wheels.image_key) : null),
        interior: exactImages.interior || exteriorImages.interior || (interior ? imageUrl(interior.image_key) : null),
      },
      advantages: exactConfig ? parseCsvList(exactConfig.advantages) : [],
      disadvantages: exactConfig ? parseCsvList(exactConfig.disadvantages) : [],
    });
  } catch (err) {
    sendJsonError(res, 500, "Failed to calculate configuration price", err.message);
  }
});

// Compatibility endpoint for the existing frontend and AI links.
app.get("/configure", async (req, res) => {
  const { model, color } = req.query;

  if (!model || !color) {
    return sendJsonError(res, 400, "model and color are required");
  }

  try {
    const row = await getConfigurationRowByModelAndColor(model, color);

    if (!row) {
      return sendJsonError(res, 404, "Combination not found");
    }

    const images = await getImagesByConfigurationId(row.configuration_id);
    const price = buildPriceDetails(row);
    const imageUrls = mapImageUrls(images);

    res.json({
      configurationId: row.configuration_id,
      model: row.code,
      modelId: row.model_id,
      modelName: row.model_name,
      packageName: row.package_name,
      color: row.color_name,
      colorId: row.color_id,
      price: price.totalPrice,
      priceBreakdown: price,
      imageUrl: imageUrls.front || null,
      imageUrlBack: imageUrls.back || null,
      imageUrlWheels: imageUrls.wheels || null,
      imageUrlInterior:
        imageUrls.interior ||
        (row.interior_id ? imageUrl(`configurator/${row.interior_id}_interior.jpg`) : null),
      images,
      imageUrls,
      advantages: parseCsvList(row.advantages),
      disadvantages: parseCsvList(row.disadvantages),
    });
  } catch (err) {
    sendJsonError(res, 500, "Failed to resolve configuration", err.message);
  }
});

app.listen(port, () => console.log(`car-configurator listening on port ${port}`));

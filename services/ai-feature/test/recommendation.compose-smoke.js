const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const liveSmokeScript = path.join(__dirname, "recommendation.live-smoke.js");
const healthUrls = [
  process.env.WEB_HEALTH_URL || "http://localhost:3000/health",
  process.env.AI_HEALTH_URL || "http://localhost:3004/health",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function waitForHealth(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError || new Error(`${url} did not become healthy`);
}

run("docker", ["compose", "up", "--build", "-d"]);

Promise.all(healthUrls.map((url) => waitForHealth(url)))
  .then(() => {
    run(process.execPath, [liveSmokeScript], { cwd: path.dirname(liveSmokeScript) });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

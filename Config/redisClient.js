const redis = require("redis");

const REDIS_URL = process.env.REDIS_URL;
let redisErrorLogged = false;

const client = redis.createClient({
  url: REDIS_URL,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) =>
      retries >= 5 ? false : Math.min(retries * 500, 3000),
  },
});

client.on("error", (err) => {
  if (redisErrorLogged) return;
  redisErrorLogged = true;
  console.warn("Redis unavailable:", err.message);
});

client.on("ready", () => {
  redisErrorLogged = false;
});

async function connectRedis() {
  if (!REDIS_URL) {
    console.warn("REDIS_URL is not configured; continuing without Redis");
    return false;
  }

  if (client.isReady) return true;

  try {
    if (!client.isOpen) await client.connect();
    return client.isReady;
  } catch (err) {
    console.warn(
      "Could not connect to Redis; continuing without it:",
      err.message,
    );
    return false;
  }
}

module.exports = { client, connectRedis };

const redis = require("redis");

const REDIS_URL = process.env.REDIS_URL;

const client = redis.createClient({ url: REDIS_URL });

client.on("error", (err) => console.error("Redis Client Error", err));

async function connectRedis() {
  if (!client.isOpen) await client.connect();
}

module.exports = { client, connectRedis };

// Controllers/messageController.js
const Message = require("../Models/Message");
const { client } = require("../Config/redisClient");
const mongoose = require("mongoose");

const DEFAULT_ROOM = "global";

/** -------------------------------
 * Redis helpers
 * ------------------------------- */
async function saveMessagesToRedisBatch(roomId, messages) {
  if (!messages || messages.length === 0) return;
  const key = `chat:${roomId}`;
  const serialized = messages.map((m) => JSON.stringify(m));
  await client.rPush(key, serialized); // batch push
  await client.lTrim(key, -100, -1); // keep last 100
}

async function getMessagesFromRedis(roomId) {
  const key = `chat:${roomId}`;
  const items = await client.lRange(key, 0, -1);
  return items.map((s) => JSON.parse(s));
}

async function getLatestFromDB(roomId, limit = 100) {
  const messages = await Message.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "username fullname")
    .lean();
  return messages.reverse(); // oldest -> newest
}

/** -------------------------------
 * Fetch chats API
 * ------------------------------- */
const fetchChats = async (req, res) => {
  try {
    const roomId = req.query.roomId || DEFAULT_ROOM;
    const before = req.query.before;
    const limit = parseInt(req.query.limit, 10) || 50;

    // Fetch older messages (pagination)
    if (before) {
      let query = {};
      if (mongoose.Types.ObjectId.isValid(before)) {
        const refMsg = await Message.findById(before).lean();
        if (!refMsg) return res.json([]);
        query.createdAt = { $lt: refMsg.createdAt };
      } else {
        const d = new Date(before);
        if (isNaN(d.getTime()))
          return res.status(400).json({ error: "Invalid before parameter" });
        query.createdAt = { $lt: d };
      }

      const older = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("senderId", "username fullname")
        .lean();

      return res.json(older.reverse());
    }

    // First load or "latest messages"
    const cached = await getMessagesFromRedis(roomId);
    if (cached && cached.length > 0) return res.json(cached);

    // Redis empty → fetch from DB
    const dbMsgs = await getLatestFromDB(roomId, 100);

    // Save all messages to Redis in **one batch**
    saveMessagesToRedisBatch(roomId, dbMsgs).catch((err) =>
      console.error("Redis batch save error:", err)
    );

    return res.json(dbMsgs);
  } catch (err) {
    console.error("fetchChats error", err);
    res.status(500).json({ error: err.message });
  }
};

/** -------------------------------
 * Delete chat
 * ------------------------------- */
const deleteChat = async (req, res) => {
  try {
    const { messageId, userId } = req.params;
    const msg = await Message.findById(messageId);

    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.senderId.toString() !== userId)
      return res
        .status(403)
        .json({ error: "You can only delete your own messages" });

    msg.deleted = true;
    msg.deletedBy = userId;
    await msg.save();

    // update Redis efficiently
    const key = `chat:${DEFAULT_ROOM}`;
    const items = await client.lRange(key, 0, -1);
    for (let i = 0; i < items.length; i++) {
      const obj = JSON.parse(items[i]);
      if (obj._id === messageId) {
        obj.deleted = true;
        obj.deletedBy = userId;
        await client.lSet(key, i, JSON.stringify(obj));
        break;
      }
    }

    res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    console.error("deleteChat error", err);
    res.status(500).json({ error: err.message });
  }
};

async function updateRedisMessage(roomId, messageId, updates) {
  const key = `chat:${roomId}`;
  const items = await client.lRange(key, 0, -1);
  for (let i = 0; i < items.length; i++) {
    const obj = JSON.parse(items[i]);
    if (obj._id === messageId) {
      const updated = { ...obj, ...updates };
      await client.lSet(key, i, JSON.stringify(updated));
      break;
    }
  }
}

const isSameUTCDate = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
};

// Compute community streak based on message timestamps
const computeCommunityStreak = (messages) => {
  if (!messages || messages.length === 0) return 0;

  // Get all unique message dates (UTC day)
  let allDates = [
    ...new Set(
      messages.map((m) => new Date(m.createdAt).toISOString().split("T")[0])
    ),
  ]
    .sort((a, b) => new Date(b) - new Date(a))
    .map((d) => new Date(d));

  if (allDates.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0);

  for (let date of allDates) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    if (isSameUTCDate(d, currentDate)) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    } else if (d < currentDate) {
      break; // streak broken
    }
  }

  return streak;
};


module.exports = {
  fetchChats,
  deleteChat,
  saveMessagesToRedisBatch,
  getMessagesFromRedis,
  getLatestFromDB,
  updateRedisMessage,
};

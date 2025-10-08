require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookies = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cron = require("node-cron");

const User = require("./Models/User");
const Message = require("./Models/Message");

// Util
const  {scheduleWeeklyCleanup}  = require("./Util/JounralCleanUp");
const { checkAndAwardBadges } = require("./Util/checkAndAwardBadges");
const { client: redisClient, connectRedis } = require("./Config/redisClient");
const {
  saveMessagesToRedisBatch,
  updateRedisMessage,
} = require("./Controllers/messageController");

// Routers
const authRouter = require("./Routers/authRouter");
const moodRouter = require("./Routers/moodRouter");
const suggestionRouter = require("./Routers/suggestionRouter");
const activityRouter = require("./Routers/activityRouter");
const selfCareRouter = require("./Routers/selfCareRouter");
const messageRouter = require("./Routers/messageRouter");
const journalRouter = require("./Routers/journalRouter");
const dashboardRouter = require("./Routers/dashboardRouter");
const profileRouter = require("./Routers/profileRouter");

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// =======================
// Middleware
// =======================
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookies());

// Base route
app.get("/", (req, res) => res.send("Welcome to Mindmate"));

// Attach routers
app.use("/api/user", authRouter);
app.use("/api/mood", moodRouter);
app.use("/api/ai", suggestionRouter);
app.use("/api/activity", activityRouter);
app.use("/api/selfcare", selfCareRouter);
app.use("/api/chat", messageRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/journal", journalRouter);
app.use("/api/profile", profileRouter);

// Health endpoint
app.get("/api/health", (req, res) => {
  const getCurrentWeek = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    currentWeek: getCurrentWeek(),
    bucket: process.env.S3_BUCKET_NAME,
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// =======================
// Cron: Reset weekly self-care stats every Monday
// =======================
cron.schedule(
  "0 0 * * 1", // Every Monday at 00:00
  async () => {
    console.log("🗓 Resetting weekly self-care activities...");
    await User.updateMany(
      {},
      {
        $set: {
          "selfCareActivities.$[].performedDates": [],
          "selfCareActivities.$[].weeklyCount": 0,
          "selfCareActivities.$[].lastPerformed": null,
        },
      }
    );
  },
  { timezone: "Asia/Kolkata" }
);

// =======================
// Start function
// =======================
async function start() {
  try {
    // MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    // Redis
    await connectRedis();
    console.log("✅ Redis connected");

    // Socket.IO
    const io = new Server(server, {
      cors: { origin: FRONTEND_ORIGIN, credentials: true },
      transports: ["websocket", "polling"],
    });

    // Deliver offline messages
    async function deliverOfflineMessages(userId, socket) {
      const key = `offline:${userId}`;
      const messages = await redisClient.lRange(key, 0, -1);
      if (messages && messages.length > 0) {
        for (const m of messages) {
          try {
            socket.emit("chat message", JSON.parse(m));
          } catch (e) {
            console.error("Error parsing offline message", e);
          }
        }
        await redisClient.del(key);
      }
    }

    // Socket.IO connection
    io.on("connection", (socket) => {
      console.log("🔗 Socket connected:", socket.id);
      const userId = socket.handshake.query?.userId;

      if (userId) deliverOfflineMessages(userId, socket).catch(console.error);

      // Chat message event
      // Chat message event
      socket.on(
        "chat message",
        async ({ senderId, content, roomId = "global" }) => {
          try {
            // Save message
            const newMsg = await Message.create({ senderId, content });
            const populated = await newMsg.populate(
              "senderId",
              "username fullname"
            );
            const serializable = populated.toObject
              ? populated.toObject()
              : populated;

            // Save to Redis and broadcast
            await saveMessagesToRedisBatch(roomId, [serializable]);
            io.emit("chat message", serializable);

            // Increment community engagement streak and persist it
            const user = await User.findById(senderId);
            if (user) {
              user.communityEngagementStreak =
                (user.communityEngagementStreak || 0) + 1;

              // Save increment first (so even if badge awarding fails, streak persists)
              await user.save().catch((err) => {
                console.error(
                  "Error saving user after incrementing streak:",
                  err
                );
              });

              // Try awarding badges but don't allow it to block the response
              try {
                await checkAndAwardBadges(user); // modifies user.badges
                // save again if badges were added
                await user.save().catch((err) => {
                  console.error(
                    "Error saving user after awarding badges:",
                    err
                  );
                });
              } catch (badgeErr) {
                console.error("Badge awarding failed:", badgeErr);
              }
            }
          } catch (err) {
            console.error("chat message error", err);
          }
        }
      );

      // Delete message event
      socket.on(
        "delete message",
        async ({ messageId, userId, roomId = "global" }) => {
          try {
            const msg = await Message.findById(messageId);
            if (!msg || msg.senderId.toString() !== userId) return;

            msg.deleted = true;
            msg.deletedBy = userId;
            await msg.save();

            // Update Redis and notify clients
            await updateRedisMessage(roomId, messageId, {
              deleted: true,
              deletedBy: userId,
            });
            io.emit("message deleted", { messageId, deletedBy: userId });

            // Decrement community streak safely
            const user = await User.findById(userId);
            if (user) {
              user.communityEngagementStreak = Math.max(
                (user.communityEngagementStreak || 0) - 1,
                0
              );

              // Save decrement first
              await user.save().catch((err) => {
                console.error(
                  "Error saving user after decrementing streak:",
                  err
                );
              });

              // Re-check badges (optional; we usually don't revoke badges, but if you want to handle it:)
              try {
                await checkAndAwardBadges(user);
                await user.save().catch((err) => {
                  console.error("Error saving user after badge check:", err);
                });
              } catch (badgeErr) {
                console.error("Badge awarding/check failed:", badgeErr);
              }
            }
          } catch (err) {
            console.error("delete message error", err);
          }
        }
      );

      // Last seen
      socket.on("last seen", async ({ userId, lastMessageId }) => {
        if (!userId || !lastMessageId) return;
        try {
          await redisClient.set(`lastSeen:${userId}`, String(lastMessageId));
        } catch (e) {
          console.error("lastSeen error", e);
        }
      });

      socket.on("disconnect", () => {
        console.log("❌ Socket disconnected:", socket.id);
      });
    });

    // Start HTTP server
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Start error:", err);
    process.exit(1);
  }
}

// Start server
start();

// Start weekly cleanup scheduler
scheduleWeeklyCleanup(`http://localhost:${PORT}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

const axios = require("axios");
const User = require("../Models/User");
const Activity = require("../Models/Activity");
const Badge = require("../Models/Badge");
const { client: redisClient } = require("../Config/redisClient");

const FALLBACK_DAILY_QUOTES = [
  {
    q: "Give yourself room to begin again, one small step at a time.",
    a: "MindMate",
  },
  {
    q: "A little care for yourself can make today feel more manageable.",
    a: "MindMate",
  },
  { q: "You are allowed to pause and notice what you need.", a: "MindMate" },
  { q: "Progress can be quiet and still be meaningful.", a: "MindMate" },
  {
    q: "Rest is one way of continuing to care for your future self.",
    a: "MindMate",
  },
  { q: "There is value in showing up for yourself as you are.", a: "MindMate" },
  { q: "Choose one kind thing to do for yourself today.", a: "MindMate" },
];

const inFlightQuoteRequests = new Map();
let memoryQuoteCache = null;

const isValidQuote = (quote) => Boolean(quote?.q && quote?.a);

const fetchQuoteForDate = async (date, cacheKey) => {
  let quote;

  try {
    const response = await axios.get("https://zenquotes.io/api/today", {
      timeout: 10000,
      headers: { Accept: "application/json" },
    });
    const apiQuote = Array.isArray(response.data) ? response.data[0] : null;

    if (!isValidQuote(apiQuote)) {
      throw new Error("ZenQuotes returned an invalid response");
    }

    quote = { q: apiQuote.q, a: apiQuote.a };
  } catch (err) {
    console.warn("Daily quote API unavailable; using fallback:", err.message);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    quote = FALLBACK_DAILY_QUOTES[weekday];
  }

  memoryQuoteCache = { key: cacheKey, quote };

  if (redisClient.isReady) {
    try {
      await redisClient.set(cacheKey, JSON.stringify(quote), { EX: 86400 });
    } catch (err) {
      console.warn("Could not cache daily quote in Redis:", err.message);
    }
  }

  return quote;
};

const fetchDailyQuote = async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `daily-quote:${today}`;

  try {
    if (redisClient.isReady) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const quote = JSON.parse(cached);
          if (isValidQuote(quote)) return res.json(quote);
        }
      } catch (err) {
        console.warn("Could not read daily quote from Redis:", err.message);
      }
    }

    if (memoryQuoteCache?.key === cacheKey) {
      return res.json(memoryQuoteCache.quote);
    }

    let quoteRequest = inFlightQuoteRequests.get(cacheKey);
    if (!quoteRequest) {
      quoteRequest = fetchQuoteForDate(today, cacheKey);
      inFlightQuoteRequests.set(cacheKey, quoteRequest);
    }

    try {
      return res.json(await quoteRequest);
    } finally {
      if (inFlightQuoteRequests.get(cacheKey) === quoteRequest) {
        inFlightQuoteRequests.delete(cacheKey);
      }
    }
  } catch (err) {
    console.error("Daily quote handler error:", err.message);
    return res.status(500).json({ error: "Could not load daily quote" });
  }
};

// Helper: get days in current month
const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const fetchDashboard = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user
    const user = await User.findById(userId).populate("badges");
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDaysInMonth = getDaysInMonth(year, month);

    // ---------- Mood Logs ----------
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const moodLogs = await Activity.find({
      userId,
      mood: { $exists: true },
      date: { $gte: monthStart, $lte: monthEnd },
    });

    // Count unique days with mood entries
    const moodDays = new Set(
      moodLogs.map((log) => new Date(log.date).getDate()),
    ).size;

    const moodStreakPercent = Math.round((moodDays / totalDaysInMonth) * 100);

    // ---------- Self-care ----------
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday

    let selfCareLogs = user.selfCareActivities || [];

    let selfCarePercent = 0;
    if (selfCareLogs.length > 0) {
      let totalCompletionRate = 0;

      selfCareLogs.forEach((activity) => {
        const performedThisWeek = activity.performedDates.filter(
          (d) => d >= weekStart && d <= weekEnd,
        ).length;

        const rate = performedThisWeek / 7; // out of 7 days
        totalCompletionRate += rate;
      });

      selfCarePercent = Math.round(
        (totalCompletionRate / selfCareLogs.length) * 100,
      );
    }

    // ---------- Badges ----------
    const badges = await Badge.find({ _id: { $in: user.badges } });

    res.json({
      moodStreak: moodStreakPercent,
      moodLogsCount: moodDays,
      selfCareStreak: selfCarePercent,
      selfCareLogsCount: selfCareLogs.length,
      badges,
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { fetchDashboard, fetchDailyQuote };

const Journal = require("../Models/Journal");
const User = require("../Models/User");
const checkAndAwardBadges = require("../Util/checkAndAwardBadges");
const mongoose = require("mongoose");

// Helper Functions
const getCurrentWeek = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
};

const getCurrentDayName = () => {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[new Date().getDay()];
};

const validateRequiredFields = (fields, requiredFields) => {
  const missing = requiredFields.filter((field) => !fields[field]);
  return missing.length > 0 ? missing : null;
};

// =========================
// Controller Functions
// =========================

const saveJournalEntry = async (req, res) => {
  try {
    const {
      userId,
      week,
      day,
      content,
      wordCount = 0,
      characterCount = 0,
      version = 1,
    } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      "userId",
      "week",
      "day",
      "content",
    ]);
    if (missing)
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields", missing });

    const journalKey = {
      userId,
      year: Number(req.body.year) || new Date().getFullYear(),
      week: parseInt(week, 10),
      day,
    };
    let journalData = await Journal.findOne(journalKey);

    if (journalData) {
      journalData.content = content;
      journalData.wordCount = parseInt(wordCount, 10) || 0;
      journalData.characterCount = parseInt(characterCount, 10) || 0;
      journalData.version += 1;
    } else {
      journalData = new Journal({
        ...journalKey,
        content,
        wordCount: parseInt(wordCount, 10) || 0,
        characterCount: parseInt(characterCount, 10) || 0,
        version: parseInt(version, 10) || 1,
      });
    }

    await journalData.save();

    // Update user streak
    const user = await User.findById(userId);
    if (user) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const lastSavedDate = user.lastJournalSaved
        ? new Date(user.lastJournalSaved)
        : null;

      if (!lastSavedDate || lastSavedDate < today) {
        user.jorunalStreak = (user.jorunalStreak || 0) + 1;
        await checkAndAwardBadges(user);
      }

      user.lastJournalSaved = new Date().toISOString();
      await user.save();
    }

    res.status(200).json({ success: true, data: journalData });
  } catch (err) {
    console.error("Error saving journal:", err);
    res.status(500).json({
      success: false,
      error: "Failed to save journal",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getJournalEntry = async (req, res) => {
  try {
    const { week, day } = req.params;
    const { userId, year = new Date().getFullYear() } = req.query;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    const journalData = await Journal.findOne({
      userId,
      year: Number(year),
      week: parseInt(week, 10),
      day,
    }).lean();

    if (!journalData) {
      return res
        .status(404)
        .json({ success: false, message: "Journal entry not found" });
    }

    res.status(200).json({ success: true, data: journalData });
  } catch (err) {
    console.error("Error retrieving journal:", err);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve journal",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getWeeklyJournals = async (req, res) => {
  try {
    const { week } = req.params;
    const { userId, year = new Date().getFullYear() } = req.query;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    const numericWeek = parseInt(week, 10);
    const numericYear = Number(year);
    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const entries = await Journal.find({
      userId,
      week: numericWeek,
      year: numericYear,
    }).lean();
    const entriesByDay = new Map(entries.map((entry) => [entry.day, entry]));
    const journals = daysOfWeek.map((day) => {
      const entry = entriesByDay.get(day);
      return entry
        ? {
            day,
            exists: true,
            content: entry.content,
            wordCount: entry.wordCount || 0,
            characterCount: entry.characterCount || 0,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          }
        : {
            day,
            exists: false,
            content: null,
            wordCount: 0,
            characterCount: 0,
          };
    });

    res.status(200).json({ success: true, data: journals });
  } catch (err) {
    console.error("Error fetching weekly journals:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch weekly journals",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const updateJournalEntry = async (req, res) => {
  try {
    const { week, day } = req.params;
    const {
      userId,
      content,
      wordCount = 0,
      characterCount = 0,
      version,
    } = req.body;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in request body" });
    if (!content)
      return res
        .status(400)
        .json({ success: false, error: "content is required" });

    const year = Number(req.body.year) || new Date().getFullYear();
    const existingEntry = await Journal.findOne({
      userId,
      year,
      week: parseInt(week, 10),
      day,
    });

    if (!existingEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Journal entry not found" });
    }

    existingEntry.content = content;
    existingEntry.wordCount = parseInt(wordCount, 10) || 0;
    existingEntry.characterCount = parseInt(characterCount, 10) || 0;
    existingEntry.version = version
      ? parseInt(version, 10)
      : existingEntry.version + 1;
    await existingEntry.save();

    res.status(200).json({
      success: true,
      message: "Journal updated successfully",
      data: existingEntry,
    });
  } catch (err) {
    console.error("Error updating journal:", err);
    res.status(500).json({
      success: false,
      error: "Failed to update journal",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const cleanupWeeklyData = async (req, res) => {
  try {
    const { week } = req.params;
    const { year = new Date().getFullYear(), userId } = req.query;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    const result = await Journal.deleteMany({
      userId,
      week: parseInt(week, 10),
      year: Number(year),
    });

    res.status(200).json({
      success: true,
      message: `Week ${week} cleanup completed for user ${userId}`,
      data: {
        userId,
        week: parseInt(week, 10),
        year: parseInt(year, 10),
        deletedCount: result.deletedCount,
      },
    });
  } catch (err) {
    console.error("Error during cleanup:", err);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup weekly journals",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getCurrentWeekJournals = async (req, res) => {
  req.params = { week: getCurrentWeek().toString() };
  return getWeeklyJournals(req, res);
};

const getTodayJournal = async (req, res) => {
  req.params = { week: getCurrentWeek().toString(), day: getCurrentDayName() };
  return getJournalEntry(req, res);
};

const searchJournals = async (req, res) => {
  try {
    const { userId, query, week = getCurrentWeek() } = req.query;
    if (!userId || !query)
      return res
        .status(400)
        .json({ success: false, error: "userId and query are required" });

    const entries = await Journal.find({
      userId,
      week: parseInt(week, 10),
      year: Number(req.query.year) || new Date().getFullYear(),
      content: {
        $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    }).lean();
    const results = entries.map((entry) => ({
      day: entry.day,
      match: true,
      content: entry.content,
      wordCount: entry.wordCount || 0,
      characterCount: entry.characterCount || 0,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    res.status(200).json({ success: true, data: results, query });
  } catch (err) {
    console.error("Error searching journals:", err);
    res.status(500).json({
      success: false,
      error: "Failed to search journals",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const exportWeekData = async (req, res) => {
  try {
    const { week } = req.params;
    const { userId, format = "json" } = req.query;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    // Get weekly data
    req.params = { week };
    req.query = { userId, year: req.query.year };
    let weeklyData;
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        weeklyData = data;
        return mockRes;
      },
    };
    await getWeeklyJournals(req, mockRes);

    if (!weeklyData || !weeklyData.success)
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve weekly data for export",
      });

    const exportData = {
      week: parseInt(week, 10),
      year: req.query.year || new Date().getFullYear(),
      userId,
      exportedAt: new Date().toISOString(),
      journals: weeklyData.data || [],
    };

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=journal-week-${week}.json`,
      );
      return res.send(JSON.stringify(exportData, null, 2));
    } else {
      return res.status(400).json({
        success: false,
        error: "Unsupported format. Only 'json' is supported currently.",
      });
    }
  } catch (err) {
    console.error("Error exporting week data:", err);
    res.status(500).json({
      success: false,
      error: "Failed to export week data",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getJournalStats = async (req, res) => {
  try {
    const { week } = req.params;
    const { userId } = req.query;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    const mockReq = {
      params: { week },
      query: { userId, year: req.query.year },
    };
    let weeklyData;
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        weeklyData = data;
        return mockRes;
      },
    };
    await getWeeklyJournals(mockReq, mockRes);

    if (!weeklyData || !weeklyData.success)
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve data for stats calculation",
      });

    const journals = weeklyData.data || [];
    const stats = journals.reduce(
      (acc, entry) => {
        if (entry.exists) {
          acc.totalWordCount += entry.wordCount || 0;
          acc.totalCharacterCount += entry.characterCount || 0;
          acc.totalEntries += 1;
        }
        return acc;
      },
      {
        totalWordCount: 0,
        totalCharacterCount: 0,
        totalEntries: 0,
        week: parseInt(week, 10),
        userId,
      },
    );

    stats.averageWordsPerEntry =
      stats.totalEntries > 0
        ? Math.round(stats.totalWordCount / stats.totalEntries)
        : 0;
    stats.averageCharactersPerEntry =
      stats.totalEntries > 0
        ? Math.round(stats.totalCharacterCount / stats.totalEntries)
        : 0;

    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch journal stats",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const healthCheck = async (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    service: "Journal Controller",
    storage: "MongoDB",
  });
};

// =========================
module.exports = {
  saveJournalEntry,
  getJournalEntry,
  getWeeklyJournals,
  updateJournalEntry,
  cleanupWeeklyData,
  getCurrentWeekJournals,
  getTodayJournal,
  searchJournals,
  exportWeekData,
  getJournalStats,
  healthCheck,
};

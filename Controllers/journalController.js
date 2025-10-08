const AWS = require("aws-sdk");
const User = require("../Models/User");
const checkAndAwardBadges = require("../Util/checkAndAwardBadges");

// AWS S3 Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "ap-south-1",
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Logging AWS config (without secrets)
console.log("[AWS CONFIG]", {
  region: process.env.AWS_REGION || "ap-south-1",
  bucketName: BUCKET_NAME,
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
});

// Helper Functions
const generateS3Key = (userId, week, day, year = new Date().getFullYear()) => {
  return `JournalLog/users/${userId}/${year}/week-${week}/${day.toLowerCase()}.json`;
};

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

    const key = generateS3Key(userId, week, day);
    const journalData = {
      userId,
      week: parseInt(week, 10),
      day,
      content,
      wordCount: parseInt(wordCount, 10) || 0,
      characterCount: parseInt(characterCount, 10) || 0,
      version: parseInt(version, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to S3
    await s3
      .putObject({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(journalData),
        ContentType: "application/json",
        Metadata: {
          userId: userId.toString(),
          week: week.toString(),
          day,
          year: new Date().getFullYear().toString(),
          version: journalData.version.toString(),
          "word-count": journalData.wordCount.toString(),
          "character-count": journalData.characterCount.toString(),
        },
      })
      .promise();

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
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to save journal",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
  }
};

const getJournalEntry = async (req, res) => {
  try {
    const { week, day } = req.params;
    const { userId } = req.query;

    if (!userId)
      return res
        .status(401)
        .json({ success: false, error: "userId required in query parameters" });

    const key = generateS3Key(userId, week, day);
    const result = await s3
      .getObject({ Bucket: BUCKET_NAME, Key: key })
      .promise();
    const journalData = JSON.parse(result.Body.toString());

    res.status(200).json({ success: true, data: journalData });
  } catch (err) {
    if (err.code === "NoSuchKey")
      return res
        .status(404)
        .json({ success: false, message: "Journal entry not found" });
    console.error("Error retrieving journal:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to retrieve journal",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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

    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const journals = [];

    for (const day of daysOfWeek) {
      const key = generateS3Key(userId, week, day, year);
      try {
        const obj = await s3
          .getObject({ Bucket: BUCKET_NAME, Key: key })
          .promise();
        const data = JSON.parse(obj.Body.toString());
        journals.push({
          day,
          exists: true,
          content: data.content,
          wordCount: data.wordCount || 0,
          characterCount: data.characterCount || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      } catch (err) {
        if (err.code === "NoSuchKey")
          journals.push({
            day,
            exists: false,
            content: null,
            wordCount: 0,
            characterCount: 0,
          });
        else throw err;
      }
    }

    res.status(200).json({ success: true, data: journals });
  } catch (err) {
    console.error("Error fetching weekly journals:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch weekly journals",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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

    const key = generateS3Key(userId, week, day);
    let existingEntry;
    try {
      const result = await s3
        .getObject({ Bucket: BUCKET_NAME, Key: key })
        .promise();
      existingEntry = JSON.parse(result.Body.toString());
    } catch (err) {
      if (err.code === "NoSuchKey")
        return res
          .status(404)
          .json({ success: false, message: "Journal entry not found" });
      throw err;
    }

    const updatedEntry = {
      ...existingEntry,
      content,
      wordCount: parseInt(wordCount, 10) || 0,
      characterCount: parseInt(characterCount, 10) || 0,
      version: version ? parseInt(version, 10) : existingEntry.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await s3
      .putObject({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(updatedEntry),
        ContentType: "application/json",
        Metadata: {
          userId: userId.toString(),
          week: week.toString(),
          day,
          year: new Date().getFullYear().toString(),
          version: updatedEntry.version.toString(),
          "word-count": updatedEntry.wordCount.toString(),
          "character-count": updatedEntry.characterCount.toString(),
        },
      })
      .promise();

    res
      .status(200)
      .json({
        success: true,
        message: "Journal updated successfully",
        data: updatedEntry,
      });
  } catch (err) {
    console.error("Error updating journal:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update journal",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const deleteResults = await Promise.all(
      days.map(async (day) => {
        const key = generateS3Key(userId, week, day, year);
        try {
          await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
          return { day, success: true, key };
        } catch (err) {
          if (err.code === "NoSuchKey")
            return { day, success: true, key, message: "File did not exist" };
          return { day, success: false, key, error: err.message };
        }
      })
    );

    const successCount = deleteResults.filter((r) => r.success).length;
    res
      .status(200)
      .json({
        success: true,
        message: `Week ${week} cleanup completed for user ${userId}`,
        data: {
          userId,
          week: parseInt(week, 10),
          year: parseInt(year, 10),
          totalItems: days.length,
          successfulDeletions: successCount,
          results: deleteResults,
        },
      });
  } catch (err) {
    console.error("Error during cleanup:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to cleanup weekly journals",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const results = [];

    for (const day of days) {
      try {
        const key = generateS3Key(userId, week, day);
        const obj = await s3
          .getObject({ Bucket: BUCKET_NAME, Key: key })
          .promise();
        const data = JSON.parse(obj.Body.toString());
        if (
          data.content &&
          data.content.toLowerCase().includes(query.toLowerCase())
        )
          results.push({
            day,
            match: true,
            content: data.content,
            wordCount: data.wordCount || 0,
            characterCount: data.characterCount || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
      } catch (err) {
        if (err.code !== "NoSuchKey") throw err;
      }
    }

    res.status(200).json({ success: true, data: results, query });
  } catch (err) {
    console.error("Error searching journals:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to search journals",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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
      return res
        .status(500)
        .json({
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
        `attachment; filename=journal-week-${week}.json`
      );
      return res.send(JSON.stringify(exportData, null, 2));
    } else {
      return res
        .status(400)
        .json({
          success: false,
          error: "Unsupported format. Only 'json' is supported currently.",
        });
    }
  } catch (err) {
    console.error("Error exporting week data:", err);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to export week data",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
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
      return res
        .status(500)
        .json({
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
      }
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
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch journal stats",
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
  }
};

const healthCheck = async (req, res) => {
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    res
      .status(200)
      .json({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "Journal Controller",
        version: "1.0.0",
        s3: {
          connected: true,
          bucket: BUCKET_NAME,
          region: process.env.AWS_REGION || "ap-south-1",
        },
      });
  } catch (err) {
    console.error("Health check failed:", err);
    res
      .status(500)
      .json({
        success: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        service: "Journal Controller",
        error: err.message,
        s3: {
          connected: false,
          bucket: BUCKET_NAME,
          region: process.env.AWS_REGION || "ap-south-1",
        },
      });
  }
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

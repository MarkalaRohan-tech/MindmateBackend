// router.js - Combined router with comprehensive userId validation and support
const express = require("express");
const router = express.Router();

const journalController = require("../Controllers/journalController");

// Custom middleware to validate userId
const validateUserId = (req, res, next) => {
  const userId = req.body?.userId || req.query?.userId || req.params?.userId;

  if (!userId) {
    console.error(
      `[AUTH ERROR] No userId provided for ${req.method} ${req.originalUrl}`
    );
    return res.status(401).json({
      error: "Authentication required",
      details: "UserId is required for all journal operations",
    });
  }

  // Add userId to request for easy access
  req.userId = userId;
  console.log(
    `[AUTH] Request authenticated for user: ${userId} - ${req.method} ${req.originalUrl}`
  );
  next();
};

// Custom middleware to validate week parameter
const validateWeekParam = (req, res, next) => {
  const { week } = req.params;
  if (week && isNaN(parseInt(week))) {
    return res.status(400).json({
      error: "Week must be a valid number",
      received: week,
    });
  }
  next();
};

// Custom middleware to validate day parameter
const validateDayParam = (req, res, next) => {
  const { day } = req.params;
  const validDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  if (day && !validDays.includes(day)) {
    return res.status(400).json({
      error: "Day must be a valid day name",
      received: day,
      validDays: validDays,
    });
  }
  next();
};

// Comprehensive middleware for request validation
const validateJournalRequest = (req, res, next) => {
  console.log(`[DEBUG] Route hit: ${req.method} ${req.originalUrl}`);
  console.log(`[DEBUG] Params:`, req.params);
  console.log(`[DEBUG] Query:`, req.query);
  console.log(`[DEBUG] Body (sanitized):`, {
    week: req.body?.week,
    day: req.body?.day,
    userId: req.body?.userId ? "present" : "missing",
    contentLength: req.body?.content ? req.body.content.length : "no content",
  });

  const { week, day } = req.params || {};
  const { week: bodyWeek, day: bodyDay, content, userId } = req.body || {};

  // For POST requests, validate all required fields
  if (req.method === "POST") {
    if (!bodyWeek || !bodyDay || !content || !userId) {
      console.log(
        `[ERROR] Missing POST body fields - week: ${bodyWeek}, day: ${bodyDay}, content: ${
          content ? "present" : "missing"
        }, userId: ${userId ? "present" : "missing"}`
      );
      return res.status(400).json({
        error:
          "Missing required fields: week, day, content, and userId are required",
        received: {
          week: bodyWeek ? "present" : "missing",
          day: bodyDay ? "present" : "missing",
          content: content ? "present" : "missing",
          userId: userId ? "present" : "missing",
        },
      });
    }

    if (isNaN(parseInt(bodyWeek))) {
      return res.status(400).json({
        error: "Week must be a valid number",
        received: bodyWeek,
      });
    }

    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (!validDays.includes(bodyDay)) {
      return res.status(400).json({
        error: "Day must be a valid day name",
        received: bodyDay,
        validDays: validDays,
      });
    }
  }

  // For PUT requests, validate content and userId
  if (req.method === "PUT") {
    if (!content) {
      return res.status(400).json({
        error: "Content is required for updating journal entry",
      });
    }
    if (!userId) {
      return res.status(400).json({
        error: "UserId is required for updating journal entry",
      });
    }
  }

  console.log(`[DEBUG] Validation passed, proceeding to controller`);
  next();
};

// Test route - no authentication required for system health check
router.get("/test", (req, res) => {
  console.log("[DEBUG] Test route hit successfully");
  res.json({
    message: "Router is working!",
    timestamp: new Date().toISOString(),
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    note: "Authentication is working. All other routes require userId.",
  });
});

// Health check route - no authentication required
router.get("/health", (req, res) => {
  console.log("[DEBUG] Health check route hit");
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Journal API",
    version: "1.0.0",
  });
});

// Static routes - All require userId authentication
router.get(
  "/current-week",
  validateUserId,
  journalController.getCurrentWeekJournals
);
router.get("/today", validateUserId, journalController.getTodayJournal);
router.get("/search", validateUserId, journalController.searchJournals);
router.get("/stats", validateUserId, journalController.getJournalStats);

// POST route for creating new entries - requires userId in body
router.post(
  "/",
  validateJournalRequest,
  validateUserId,
  journalController.saveJournalEntry
);

// Single parameter routes with validation - userId required in query
router.get(
  "/week/:week",
  validateWeekParam,
  validateUserId,
  journalController.getWeeklyJournals
);

router.get(
  "/stats/:week",
  validateWeekParam,
  validateUserId,
  journalController.getJournalStats
);

router.get(
  "/export/:week",
  validateWeekParam,
  validateUserId,
  journalController.exportWeekData
);

router.delete(
  "/cleanup/:week",
  validateWeekParam,
  validateUserId,
  journalController.cleanupWeeklyData
);

// Two parameter routes - MUST come last to avoid route conflicts
router.get(
  "/:week/:day",
  validateWeekParam,
  validateDayParam,
  validateUserId,
  validateJournalRequest,
  journalController.getJournalEntry
);

router.put(
  "/:week/:day",
  validateWeekParam,
  validateDayParam,
  validateJournalRequest,
  validateUserId,
  journalController.updateJournalEntry
);

// Enhanced catch-all error handler for unmatched routes
router.use((req, res) => {
  console.log(`[DEBUG] Unmatched route: ${req.method} ${req.originalUrl}`);
  console.log(`[DEBUG] Headers:`, req.headers);
  console.log(
    `[DEBUG] Available userId: ${
      req.query.userId || req.body?.userId || "none"
    }`
  );

  res.status(404).json({
    error: "Route not found",
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
    note: "All routes (except /test and /health) require userId parameter",
    authenticationNote:
      "For GET requests: include userId in query. For POST/PUT requests: include userId in body.",
    availableRoutes: {
      public: ["GET /api/journal/test", "GET /api/journal/health"],
      authenticated: [
        "GET /api/journal/current-week?userId=xxx",
        "GET /api/journal/today?userId=xxx",
        "GET /api/journal/search?userId=xxx&query=xxx",
        "GET /api/journal/stats?userId=xxx",
        "GET /api/journal/week/{week}?userId=xxx&year=yyyy",
        "GET /api/journal/stats/{week}?userId=xxx",
        "GET /api/journal/export/{week}?userId=xxx&format=json",
        "GET /api/journal/{week}/{day}?userId=xxx",
        "POST /api/journal/ (body: {userId, week, day, content})",
        "PUT /api/journal/{week}/{day} (body: {userId, content})",
        "DELETE /api/journal/cleanup/{week}?userId=xxx",
      ],
    },
    examples: {
      getCurrentWeek: "GET /api/journal/current-week?userId=user123",
      saveEntry:
        'POST /api/journal/ with body: {"userId":"user123","week":38,"day":"Monday","content":"<p>Today was good</p>"}',
      getEntry: "GET /api/journal/38/Monday?userId=user123",
      updateEntry:
        'PUT /api/journal/38/Monday with body: {"userId":"user123","content":"<p>Updated content</p>"}',
    },
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error(`[ROUTER ERROR] ${error.message}`, {
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.userId || "none",
  });

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
    timestamp: new Date().toISOString(),
    requestId: req.headers["x-request-id"] || "unknown",
  });
});

module.exports = router;

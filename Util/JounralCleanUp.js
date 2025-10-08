// scheduler.js - Weekly cleanup scheduler
const cron = require("node-cron");
const axios = require("axios");

// Helper function to get current week number
const getCurrentWeek = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
};

// Helper function to get previous week
const getPreviousWeek = () => {
  const currentWeek = getCurrentWeek();
  return currentWeek === 1 ? 52 : currentWeek - 1; // Handle year transition
};

// Weekly cleanup job - runs every Monday at 12:01 AM
const scheduleWeeklyCleanup = (baseUrl = "http://localhost:3001") => {
  console.log("Setting up weekly cleanup scheduler...");

  // Run every Monday at 12:01 AM (0 1 * * 1)
  cron.schedule(
    "1 0 * * 1",
    async () => {
      try {
        console.log("Starting weekly cleanup process...");
        const previousWeek = getPreviousWeek();
        const currentYear = new Date().getFullYear();

        // Call the cleanup API endpoint
        const response = await axios.delete(
          `${baseUrl}/api/journal/cleanup/${previousWeek}?year=${currentYear}`
        );

        console.log(`Weekly cleanup completed successfully:`, response.data);

        // Optional: Send notification or log to monitoring service
        // await sendCleanupNotification(response.data);
      } catch (error) {
        console.error("Weekly cleanup failed:", error.message);

        // Optional: Send error notification
        // await sendErrorNotification(error);
      }
    },
    {
      scheduled: true,
      timezone: "America/New_York", // Adjust timezone as needed
    }
  );

  console.log("Weekly cleanup scheduler is now active");
};

// Optional: Manual cleanup function
const manualCleanup = async (week, year, baseUrl = "http://localhost:3001") => {
  try {
    console.log(`Starting manual cleanup for week ${week}, year ${year}...`);

    const response = await axios.delete(
      `${baseUrl}/api/journal/cleanup/${week}?year=${year}`
    );

    console.log("Manual cleanup completed:", response.data);
    return response.data;
  } catch (error) {
    console.error("Manual cleanup failed:", error.message);
    throw error;
  }
};

// Optional: Notification functions
const sendCleanupNotification = async (cleanupData) => {
  // Implement your notification logic here
  // Could be email, Slack, Discord, etc.
  console.log("Cleanup notification sent:", cleanupData);
};

const sendErrorNotification = async (error) => {
  // Implement your error notification logic here
  console.error("Error notification sent:", error.message);
};

// Health check for scheduler
const schedulerHealthCheck = () => {
  return {
    status: "active",
    nextCleanup: "Next Monday at 12:01 AM",
    currentWeek: getCurrentWeek(),
    previousWeek: getPreviousWeek(),
    timezone: "America/New_York",
  };
};

module.exports = {
  scheduleWeeklyCleanup,
  manualCleanup,
  schedulerHealthCheck,
  getCurrentWeek,
  getPreviousWeek,
};

// If running directly
if (require.main === module) {
  scheduleWeeklyCleanup();

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("Scheduler stopped");
    process.exit(0);
  });

  console.log("Cleanup scheduler is running. Press Ctrl+C to stop.");
}

module.exports = {
  scheduleWeeklyCleanup,
  manualCleanup,
  schedulerHealthCheck,
  getCurrentWeek,
  getPreviousWeek,
};
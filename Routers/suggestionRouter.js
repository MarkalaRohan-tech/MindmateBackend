const express = require("express");
const router = express.Router();
const { getActivities } = require("../Controllers/suggestionController");

const dotenv = require("dotenv");
dotenv.config();
router.post("/getSuggestion", getActivities);

module.exports = router;

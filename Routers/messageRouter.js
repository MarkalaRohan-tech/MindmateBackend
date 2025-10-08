const express = require("express");
const { fetchChats, deleteChat } = require("../Controllers/messageController");

const router = express.Router();

// Get all group messages
router.get("/", fetchChats);

// Delete a message
router.delete("/:messageId/:userId", deleteChat);

module.exports = router;

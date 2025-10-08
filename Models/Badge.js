const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema({
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  logo: { type: String, required: true },
});

module.exports = mongoose.model("Badge", badgeSchema);
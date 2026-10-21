const mongoose = require("mongoose");

const journalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    year: { type: Number, required: true },
    week: { type: Number, required: true, min: 1, max: 53 },
    day: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },
    content: { type: String, required: true },
    wordCount: { type: Number, default: 0 },
    characterCount: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

journalSchema.index({ userId: 1, year: 1, week: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("Journal", journalSchema);

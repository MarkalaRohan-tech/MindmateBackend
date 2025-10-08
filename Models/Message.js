const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
    content: { type: String, required: true },
    type: { type: String, default: "text" },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    edited: { type: Boolean, default: false },
    editHistory: [{ text: String, editedAt: Date }],

    deleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Types.ObjectId, default: null }, // only sender allowed
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);

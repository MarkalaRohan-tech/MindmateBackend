const mongoose = require("mongoose");

const connectToDB = async (uri) => {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully...");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
};

module.exports = { connectToDB };

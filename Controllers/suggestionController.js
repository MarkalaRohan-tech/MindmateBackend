const axios = require("axios");

const getActivities = async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-chat", 
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant. 
Always respond ONLY with a valid JSON array.
Each element must be an object with { "title": string, "description": string }. 
Make the description short.
No explanations, no extra text, no markdown.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = response.data?.choices?.[0]?.message?.content || "[]";

    // 🔹 Strip code blocks or backticks from AI output
    content = content.replace(/```(json)?/g, "").trim();

    let activities = [];
    try {
      activities = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse failed:", err);
      activities = [];
    }

    res.status(200).json({ activities });
  } catch (error) {
    console.error("AI API Error:", error.response?.data || error.message);

    // Always send a string message for frontend
    const errorMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message;

    res.status(200).json({
      activities: [],
      error: errorMsg,
    });
  }
};

module.exports = { getActivities };

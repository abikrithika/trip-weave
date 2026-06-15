import { extractTripQuery } from "../groq/extractor.js";

export const extractTripQueryController = async (req, res) => {
  const userText = req.body?.prompt ?? req.body?.text ?? req.body?.userText;

  if (typeof userText !== "string" || userText.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Request body must include a non-empty prompt string.",
    });
  }

  try {
    const result = await extractTripQuery(userText.trim());

    return res.status(result.ok ? 200 : 422).json({
      success: result.ok,
      data: result.parsed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Groq extraction error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

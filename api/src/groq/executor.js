/**
 * Backend execution function for processing user prompts through the trip extraction pipeline.
 * Handles the full flow: validation -> extraction -> verification -> response building
 */

import { extractTripQuery } from "./extractor.js";

/**
 * Execute trip query extraction from user prompt text
 *
 * Main entry point for processing a user's trip description and extracting structured data.
 * Applies defensive verification to handle malformed AI responses gracefully.
 *
 * @param {string} userPromptText - The user's raw input describing their trip preferences
 * @param {object} options - Optional configuration
 * @param {string} options.modelId - Override the default model ID
 * @returns {Promise<object>} Result object with structure:
 *   {
 *     ok: boolean,              // true if extraction succeeded with valid data
 *     parsed: object|null,      // The extracted trip query data (or null if failed)
 *     errors: string[],         // Array of error messages if any
 *     rawInput: string,         // Echo of the input for debugging
 *     timestamp: string         // ISO timestamp of execution
 *   }
 *
 * @example
 * const result = await executeTripExtraction("I want to fly from Copenhagen to Lisbon in July for 3000 DKK, beach vibes only");
 * if (result.ok) {
 *   console.log("Extracted:", result.parsed);
 * } else {
 *   console.log("Errors:", result.errors);
 * }
 */
export async function executeTripExtraction(userPromptText, options = {}) {
  // Validate input
  if (!userPromptText || typeof userPromptText !== "string") {
    return {
      ok: false,
      parsed: null,
      errors: ["Input must be a non-empty string"],
      rawInput: userPromptText,
      timestamp: new Date().toISOString(),
    };
  }

  const trimmedInput = userPromptText.trim();

  if (trimmedInput.length === 0) {
    return {
      ok: false,
      parsed: null,
      errors: ["Input text is empty after trimming"],
      rawInput: userPromptText,
      timestamp: new Date().toISOString(),
    };
  }

  if (trimmedInput.length > 2000) {
    return {
      ok: false,
      parsed: null,
      errors: ["Input text exceeds maximum length of 2000 characters"],
      rawInput: userPromptText.substring(0, 100) + "...",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Call the extraction pipeline which includes verification
    const extractionResult = await extractTripQuery(trimmedInput, options);

    // Enhance the result with metadata
    return {
      ...extractionResult,
      rawInput: trimmedInput,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      parsed: null,
      errors: [
        `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
      rawInput: trimmedInput,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Batch execute multiple trip queries
 * Useful for processing multiple user inputs in parallel
 *
 * @param {string[]} prompts - Array of user prompt texts
 * @param {object} options - Optional configuration passed to each execution
 * @returns {Promise<object[]>} Array of result objects (order preserved)
 */
export async function executeBatchTripExtraction(prompts, options = {}) {
  if (!Array.isArray(prompts)) {
    throw new Error("prompts must be an array");
  }

  const results = await Promise.allSettled(
    prompts.map((prompt) => executeTripExtraction(prompt, options)),
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        ok: false,
        parsed: null,
        errors: [
          `Promise rejection: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        ],
        rawInput: null,
        timestamp: new Date().toISOString(),
      };
    }
  });
}

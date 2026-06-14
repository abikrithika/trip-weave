/**
 * Defensive verification handlers for TripQuery fields.
 * Attempts to fix malformed or missing data from AI responses.
 */

/**
 * Verify and normalize airport code (IATA code)
 * @param {any} value - The value to verify
 * @returns {string|null} - Valid IATA code or null
 */
export function verifyAirportCode(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  // Extract only letters, convert to uppercase, trim
  const cleaned = value
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .trim();

  // Must be exactly 3 letters
  if (cleaned.length !== 3) {
    return null;
  }

  // Verify pattern matches schema requirement
  if (!/^[A-Z]{3}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Verify and normalize date to YYYY-MM-DD format
 * @param {any} value - The value to verify
 * @returns {string|null} - Valid date string or null
 */
export function verifyDepartureDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    // Try converting to string if it's a number (timestamp)
    if (typeof value === "number") {
      value = new Date(value).toISOString().split("T")[0];
    } else {
      return null;
    }
  }

  // Remove common date separators and normalize
  let cleaned = value.trim();

  // Handle common formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const datePatterns = [
    // YYYY-MM-DD (already correct)
    { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, groups: [1, 2, 3] },
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    { pattern: /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/, groups: [3, 2, 1] }, // DD/MM/YYYY -> YYYY-MM-DD
    // MM/DD/YYYY (US format)
    {
      pattern: /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/,
      groups: [3, 1, 2],
      usFormat: true,
    },
  ];

  for (const { pattern, groups, usFormat } of datePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let year, month, day;

      if (!usFormat) {
        [, year, month, day] = [
          match[0],
          match[groups[0]],
          match[groups[1]],
          match[groups[2]],
        ];
      } else {
        // For US format, try to determine if it makes sense
        const pot_month = match[groups[0]];
        const pot_day = match[groups[1]];
        if (parseInt(pot_month) > 12) {
          // pot_month must be day, pot_day must be month
          [year, month, day] = [match[groups[2]], pot_day, pot_month];
        } else {
          [year, month, day] = [match[groups[2]], pot_month, pot_day];
        }
      }

      year = String(year).padStart(4, "0");
      month = String(month).padStart(2, "0");
      day = String(day).padStart(2, "0");

      // Validate the date is reasonable
      if (!isValidDate(year, month, day)) {
        return null;
      }

      return `${year}-${month}-${day}`;
    }
  }

  // If no pattern matched, return null
  return null;
}

/**
 * Helper to validate if date components make sense
 */
function isValidDate(year, month, day) {
  const y = parseInt(year);
  const m = parseInt(month);
  const d = parseInt(day);

  // Basic sanity checks
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // Check 30-day months
  if ([4, 6, 9, 11].includes(m) && d > 30) return false;

  // Check February
  if (m === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (d > (isLeap ? 29 : 28)) return false;
  }

  // Year should be reasonable (current year +/- 2 years)
  const currentYear = new Date().getFullYear();
  if (y < currentYear - 2 || y > currentYear + 2) {
    return false;
  }

  return true;
}

/**
 * Verify and normalize max price (should be integer >= 0)
 * @param {any} value - The value to verify
 * @returns {number|null} - Valid price or null
 */
export function verifyMaxPrice(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  let parsed = value;

  // If string, try to parse as number
  if (typeof value === "string") {
    // Remove common currency symbols and separators
    const cleaned = value
      .replace(/[^\d.,]/g, "") // Keep only digits, dots, commas
      .replace(/[,.]/g, ""); // Remove all separators (e.g., 1,500 -> 1500)

    parsed = parseInt(cleaned, 10);
  } else if (typeof value === "number") {
    parsed = Math.floor(value);
  } else {
    return null;
  }

  // Check if parsing resulted in a valid number
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * Verify and normalize vibe tags array
 * @param {any} value - The value to verify
 * @returns {string[]|null} - Valid tags array or null
 */
export function verifyVibeTags(value) {
  if (value === null || value === undefined) {
    return null;
  }

  let tags = value;

  // If it's a string, try to parse as JSON array or split by common delimiters
  if (typeof value === "string") {
    // Try JSON parse first
    try {
      tags = JSON.parse(value);
    } catch (e) {
      // Try splitting by comma or semicolon
      tags = value.split(/[,;]/).map((t) => t.trim());
    }
  }

  // Ensure it's an array
  if (!Array.isArray(tags)) {
    return null;
  }

  // Filter and validate each tag
  const validTags = tags
    .filter((tag) => {
      // Must be a string
      if (typeof tag !== "string") return false;
      // Must be 1-32 characters
      if (tag.length < 1 || tag.length > 32) return false;
      return true;
    })
    .map((tag) => tag.toLowerCase().trim()) // Normalize to lowercase
    .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates

  return validTags.length > 0 ? validTags : null;
}

/**
 * Main verification function that applies all defensive checks
 * @param {object} parsed - The parsed object from AI response
 * @returns {object} - Verified and corrected object with validation_error field set if issues found
 */
export function verifyTripQuery(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return {
      origin_airport: null,
      destination_airport: null,
      departure_date: null,
      max_price_dkk: null,
      vibe_tags: null,
      validation_error: "Invalid parsed object structure",
    };
  }

  const verified = {
    origin_airport: verifyAirportCode(parsed.origin_airport),
    destination_airport: verifyAirportCode(parsed.destination_airport),
    departure_date: verifyDepartureDate(parsed.departure_date),
    max_price_dkk: verifyMaxPrice(parsed.max_price_dkk),
    vibe_tags: verifyVibeTags(parsed.vibe_tags),
    validation_error: null,
  };

  // Check for required fields and set validation_error if any are missing
  const missingFields = [];
  if (!verified.origin_airport) missingFields.push("origin_airport");
  if (!verified.destination_airport) missingFields.push("destination_airport");
  if (!verified.departure_date) missingFields.push("departure_date");
  if (!verified.max_price_dkk && verified.max_price_dkk !== 0) {
    missingFields.push("max_price_dkk");
  }
  if (!verified.vibe_tags) missingFields.push("vibe_tags");

  if (missingFields.length > 0) {
    verified.validation_error = `Could not extract or fix: ${missingFields.join(", ")}`;
  }

  return verified;
}

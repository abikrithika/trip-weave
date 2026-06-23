const COUNTRY_TO_IATA = {
  DK: "CPH",
  GB: "LHR",
  UK: "LHR",
  US: "JFK",
  FR: "CDG",
  ES: "MAD",
  DE: "FRA",
  IT: "FCO",
  NL: "AMS",
  SE: "ARN",
};

async function detectOriginFromIp(req) {
  try {
    // Prefer X-Forwarded-For header when behind proxies
    const xf = req.headers["x-forwarded-for"];
    const ip = xf ? xf.split(",")[0].trim() : req.socket.remoteAddress;

    // ipapi.co ignores the IP if omitted and returns the caller IP, so we can call without IP
    const url = "https://ipapi.co/json/";
    const res = await fetch(url, { timeout: 3000 });
    if (!res.ok) return null;
    const data = await res.json();
    const country = data.country || data.country_code || data.country_name;
    if (!country) return null;

    const code = String(country).toUpperCase();
    // If we received a full country name, try to extract ISO code
    const iso =
      code.length === 2 ? code : (data.country_code || "").toUpperCase();
    if (iso && COUNTRY_TO_IATA[iso]) return COUNTRY_TO_IATA[iso];
    return null;
  } catch (e) {
    return null;
  }
}

async function detectFallbackOrigin(req) {
  // Attempt IP-based detection
  const fromIp = await detectOriginFromIp(req);
  if (fromIp) return fromIp;

  // Fallback default
  return "CPH";
}

export { detectFallbackOrigin };

import L from "leaflet"

export const douglasPeucker = (points: { lat: number, lng: number, alt: number }[], epsilon: number) => {
  if (points.length < 3) return points;

  const getPerpendicularDistance = (point: { lat: number, lng: number }, lineStart: { lat: number, lng: number }, lineEnd: { lat: number, lng: number }) => {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const u = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (mag * mag);
    const x = lineStart.lng + u * dx;
    const y = lineStart.lat + u * dy;
    const dx1 = point.lng - x;
    const dy1 = point.lat - y;
    return Math.sqrt(dx1 * dx1 + dy1 * dy1);
  };

  let dmax = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = getPerpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const recResults1: { lat: number, lng: number, alt: number }[] = douglasPeucker(points.slice(0, index + 1), epsilon);
    const recResults2: { lat: number, lng: number, alt: number }[] = douglasPeucker(points.slice(index), epsilon);
    return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
  } else {
    return [points[0], points[points.length - 1]];
  }
};

export const getColourByAlt = (alt: number) => {
  const maxAlt = 45_000;
  const ratio = alt / maxAlt;
  const red = Math.min(255, Math.floor(255 * ratio));
  const blue = Math.min(255, Math.floor(255 * (1 - ratio)));
  return `rgb(${red}, 0, ${blue})`;
};

export const generateCircle = (lat: number, lng: number, col: string, callsign: string) => {
  const circle = L.circle([lat, lng], {
    color: col,
    fillColor: col,
    fillOpacity: 0.5,
    radius: 750
  });
  circle.bindTooltip(callsign, { permanent: false, direction: 'top' });
  return circle;
};

export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const getColorFromAtc = (atco: string): string => {
  if (!atco) return "#3388ff"; // Default color if no input

  const hash = hashString(atco);
  // Use HSL color model for better brightness control
  // Hue: 0-360 (full color spectrum)
  // Saturation: 60-100% (fairly saturated colors)
  // Lightness: 50-80% (medium to bright, never dark)
  const hue = Math.abs(hash % 360);
  const saturation = 70 + (hash % 30); // 70-100%
  const lightness = 50 + (Math.abs((hash >> 8) % 30)); // 50-80%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getColorFromAirport = (airport: string): string => {
  if (!airport) return "#3388ff"; // Default color if no input

  const hash = hashString(airport);
  // Similar HSL approach but with a different hash shift to create variety
  const hue = Math.abs((hash + 120) % 360); // Offset hue by 120 from the ATC color
  const saturation = 65 + (hash % 35); // 65-100%
  const lightness = 55 + (Math.abs((hash >> 4) % 25)); // 55-80%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const findNextCallsignOffset = (callsign: string, replayLog: { [fileName: string]: any[] }, counter: number) => {
  for (let i = counter + 1; i < Object.keys(replayLog).length; i++) {
    for (const fileName in replayLog) {
      if (replayLog[fileName][i] && replayLog[fileName][i].callsign === callsign) {
        return i;
      }
    }
  }
  return -1; // Return -1 if the callsign is not found
};

/**
 * Parse airport filter string into individual patterns
 * Supports comma-separated airports and wildcards
 * Examples: "EGLL,KJFK", "EG*", "EGLL,EG*,KJFK"
 */
export const parseAirportFilter = (filterString: string): string[] => {
  if (!filterString.trim()) return [];
  
  return filterString
    .split(',')
    .map(airport => airport.trim().toUpperCase())
    .filter(airport => airport.length > 0);
};

/**
 * Check if an airport code matches a pattern (supports wildcards)
 * Examples:
 * - "EGLL" matches "EGLL" exactly
 * - "EGLL" matches "EG*" pattern
 * - "KJFK" matches "K*" pattern
 */
export const matchesAirportPattern = (airportCode: string, pattern: string): boolean => {
  if (!airportCode || !pattern) return false;
  
  const code = airportCode.toUpperCase();
  const pat = pattern.toUpperCase();
  
  // Exact match
  if (code === pat) return true;
  
  // Wildcard match
  if (pat.includes('*')) {
    const prefix = pat.replace('*', '');
    return code.startsWith(prefix);
  }
  
  return false;
};

/**
 * Check if an airport code matches any of the provided patterns
 */
export const matchesAnyAirportPattern = (airportCode: string, patterns: string[]): boolean => {
  if (!patterns.length) return true; // No filter = show all
  
  return patterns.some(pattern => matchesAirportPattern(airportCode, pattern));
};
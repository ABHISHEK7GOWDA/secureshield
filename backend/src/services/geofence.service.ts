import { logger } from "../config/logger";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export class GeofenceService {
  // Haversine formula to compute distance in meters between two points
  static calculateDistance(coords1: GeoLocation, coords2: GeoLocation): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (coords1.latitude * Math.PI) / 180;
    const phi2 = (coords2.latitude * Math.PI) / 180;
    const deltaPhi = ((coords2.latitude - coords1.latitude) * Math.PI) / 180;
    const deltaLambda = ((coords2.longitude - coords1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // In meters
  }

  // Detect impossible travel between logins
  static checkImpossibleTravel(
    lastLogin: { coords: GeoLocation; timestamp: Date },
    currentLogin: { coords: GeoLocation; timestamp: Date }
  ): { impossible: boolean; speedKmh: number; distanceKm: number } {
    const distanceMeters = this.calculateDistance(lastLogin.coords, currentLogin.coords);
    const distanceKm = distanceMeters / 1000;

    const timeDiffMs = Math.abs(currentLogin.timestamp.getTime() - lastLogin.timestamp.getTime());
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    if (timeDiffHours <= 0) {
      return { impossible: distanceKm > 10, speedKmh: 0, distanceKm };
    }

    const speedKmh = distanceKm / timeDiffHours;

    // Standard threshold: 800 km/h (speed of a commercial airliner)
    // If the velocity is > 800 km/h and distance is > 50km, it's impossible travel.
    const impossible = speedKmh > 800 && distanceKm > 50;

    if (impossible) {
      logger.warn(
        `🚨 Impossible Travel Flagged: Distance = ${distanceKm.toFixed(2)} km, Time Delta = ${timeDiffHours.toFixed(
          2
        )} hrs, Implied Speed = ${speedKmh.toFixed(2)} km/h`
      );
    }

    return { impossible, speedKmh, distanceKm };
  }

  // IP Reputation Analysis: Checks the reputation score (0 to 100, 100 = dangerous)
  static checkIpReputation(ip: string): { score: number; details: string; isProxyOrVpn: boolean } {
    // Check for local IP addresses (clean score)
    if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return { score: 0, details: "Local trusted subnet IP address.", isProxyOrVpn: false };
    }

    // Enterprise mock database check: certain IP segments have high risks for demo testing
    if (ip.startsWith("198.51.100.")) {
      return { score: 85, details: "IP flagged for known botnet activity.", isProxyOrVpn: true };
    }
    if (ip.startsWith("203.0.113.")) {
      return { score: 65, details: "High density Tor exit node subnet.", isProxyOrVpn: true };
    }

    // Default clean/neutral score
    return { score: 10, details: "Standard residential IP lease.", isProxyOrVpn: false };
  }

  // Basic IP Geolocation mockup (can integrate with external API like ip-api.com in prod)
  static async geolocateIp(ip: string): Promise<GeoLocation> {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
      return {
        latitude: 12.9716, // Default to Bangalore, India for demo
        longitude: 77.5946,
        city: "Bengaluru",
        country: "India",
      };
    }

    // Return dummy locations depending on IP to simulate impossible travel or foreign logins
    if (ip.startsWith("198.51.100.")) {
      return {
        latitude: 40.7128, // New York
        longitude: -74.006,
        city: "New York",
        country: "United States",
      };
    }

    if (ip.startsWith("203.0.113.")) {
      return {
        latitude: 52.52, // Berlin
        longitude: 13.405,
        city: "Berlin",
        country: "Germany",
      };
    }

    return {
      latitude: 12.9716, // Bengaluru
      longitude: 77.5946,
      city: "Bengaluru",
      country: "India",
    };
  }
}

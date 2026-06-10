/**
 * Generates a unique, persistent hardware fingerprint for the browser
 */
export async function getDeviceFingerprint(): Promise<{ fingerprint: string; name: string }> {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || "unknown",
      navigator.platform || "unknown",
    ];

    // Generate canvas fingerprint (highly unique per browser/GPU engine)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("SecureShield, 2026!", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("SecureShield, 2026!", 4, 17);
      
      const canvasHash = canvas.toDataURL();
      components.push(canvasHash);
    }

    const rawString = components.join("||");
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawString));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Guess a user-friendly device name
    const ua = navigator.userAgent;
    let name = "Web Browser Client";

    if (/Windows/i.test(ua)) name = "Windows PC";
    else if (/Macintosh/i.test(ua)) name = "macOS workstation";
    else if (/Android/i.test(ua)) name = "Android Device";
    else if (/iPhone/i.test(ua)) name = "Apple iPhone";
    else if (/Linux/i.test(ua)) name = "Linux station";

    return { fingerprint, name };
  } catch (error) {
    // Fallback simple fingerprint
    const fallback = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return { fingerprint: fallback, name: "Secured client browser" };
  }
}

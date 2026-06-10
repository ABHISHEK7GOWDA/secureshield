const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load environment variables from .env if it exists
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    });
  }
} catch (error) {
  console.error("Error parsing .env file:", error);
}

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const otpStore = new Map();
const otpExpiryMs = 5 * 60 * 1000;
const maxOtpAttempts = 5;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  const cleaned = raw.replace(/[^\d+]/g, "");

  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  if (/^\d{11,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return "";
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendSmsFast2Sms(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const cleanPhone = phone.replace(/[^\d]/g, "").slice(-10);

  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      "authorization": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: otp,
      numbers: cleanPhone
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Fast2SMS provider rejected the message");
  }

  const data = await response.json();
  if (!data.return) {
    throw new Error(data.message || "Fast2SMS failed to send message");
  }

  return {
    delivered: true
  };
}

async function sendSms(phone, otp) {
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey) {
    try {
      return await sendSmsFast2Sms(phone, otp);
    } catch (error) {
      console.error("Fast2SMS Error:", error);
      throw error;
    }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return {
      delivered: false,
      reason: "SMS provider not configured"
    };
  }

  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `Your SecureShield OTP is ${otp}. It expires in 5 minutes.`
  });

  const result = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!result.ok) {
    const details = await result.text();
    throw new Error(details || "Twilio provider rejected the message");
  }

  return {
    delivered: true
  };
}

async function handleSendOtp(request, response) {
  try {
    const body = await readJsonBody(request);
    const phone = normalizePhone(body.phone);

    if (!phone) {
      sendJson(response, 400, {
        ok: false,
        message: "Enter a valid phone number with country code."
      });
      return;
    }

    const otp = generateOtp();
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + otpExpiryMs,
      attempts: 0
    });

    const smsResult = await sendSms(phone, otp);
    sendJson(response, 200, {
      ok: true,
      phone,
      message: smsResult.delivered
        ? `OTP sent to ${phone}.`
        : "SMS provider is not configured. Development OTP is shown on screen.",
      devOtp: smsResult.delivered ? undefined : otp
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: "Unable to send OTP message.",
      details: error.message
    });
  }
}

async function handleVerifyOtp(request, response) {
  try {
    const body = await readJsonBody(request);
    const phone = normalizePhone(body.phone);
    const otp = String(body.otp || "").trim();
    const record = otpStore.get(phone);

    if (!phone || !otp) {
      sendJson(response, 400, {
        ok: false,
        message: "Phone number and OTP are required."
      });
      return;
    }

    if (!record || Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      sendJson(response, 400, {
        ok: false,
        message: "OTP expired or not found. Send a new OTP."
      });
      return;
    }

    if (record.otp !== otp) {
      record.attempts += 1;

      if (record.attempts >= maxOtpAttempts) {
        otpStore.delete(phone);
        sendJson(response, 401, {
          ok: false,
          message: "Too many incorrect OTP attempts. Send a new OTP."
        });
        return;
      }

      sendJson(response, 401, {
        ok: false,
        message: `Incorrect OTP. ${maxOtpAttempts - record.attempts} attempts left.`
      });
      return;
    }

    otpStore.delete(phone);
    sendJson(response, 200, {
      ok: true,
      message: "OTP verified successfully."
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: "Unable to verify OTP.",
      details: error.message
    });
  }
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(request.url.split("?")[0]);

  if (request.method === "POST" && requestPath === "/api/send-otp") {
    handleSendOtp(request, response);
    return;
  }

  if (request.method === "POST" && requestPath === "/api/verify-otp") {
    handleVerifyOtp(request, response);
    return;
  }

  const cleanPath = requestPath === "/" ? "index.html" : requestPath.replace(/^[/\\]+/, "");
  const safePath = path.normalize(cleanPath);
  const filePath = path.resolve(root, safePath);

  if (!filePath.startsWith(path.resolve(root))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, () => {
  console.log(`SecureShield is running at http://localhost:${port}`);
});

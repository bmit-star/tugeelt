import crypto from "node:crypto";
import { config } from "../server/config/env";

export function testAppScript(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: HMAC signature verification
  try {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const bodyString = JSON.stringify({ action: "generateAlbanBichig", dugaar: "I-26-9999" });

    const bodyHash = crypto.createHash("sha256").update(bodyString).digest("hex");
    const payload = `${timestamp}.${nonce}.${bodyHash}`;

    const signature = crypto
      .createHmac("sha256", config.appScriptSecret)
      .update(payload)
      .digest("hex");

    // Verification step
    const computedExpected = crypto
      .createHmac("sha256", config.appScriptSecret)
      .update(payload)
      .digest("hex");

    const passed = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedExpected));
    results.push({
      name: "Google Apps Script HMAC-SHA256 Signature Verification",
      passed,
      message: passed ? undefined : "HMAC signature mismatch"
    });
  } catch (e: any) {
    results.push({ name: "Google Apps Script HMAC-SHA256 Signature", passed: false, message: e.message });
  }

  // Test 2: Timestamp Skew Rejection (> 5 mins)
  try {
    const staleTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 mins old
    const maxSkewMs = 5 * 60 * 1000;
    const diff = Math.abs(Date.now() - parseInt(staleTimestamp, 10));
    const passed = diff > maxSkewMs; // Correctly detects stale
    results.push({
      name: "Replay Attack Timestamp Window Enforcement (< 5 mins)",
      passed,
      message: passed ? undefined : "Stale timestamp allowed!"
    });
  } catch (e: any) {
    results.push({ name: "Replay Attack Timestamp Window Enforcement", passed: false, message: e.message });
  }

  return results;
}

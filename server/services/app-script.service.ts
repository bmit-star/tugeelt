import crypto from "node:crypto";
import { config } from "../config/env";
import { logger } from "../utils/logger";

export interface GenerateLetterPayload {
  orderId?: string;
  assignmentId?: string;
  dugaar?: string;
  ognoo?: string;
  chiglel?: string;
  mashin?: string;
  tug1?: string;
  tug2?: string;
  niit_mungu?: string | number;
}

export interface LetterGenerationResult {
  success: boolean;
  status: "DONE" | "FAILED" | "PENDING";
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  dugaar?: string;
  error?: string;
}

export class AppScriptService {
  /**
   * Generates authentication headers for Google Apps Script
   */
  private static generateAuthHeaders(bodyString: string, action: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();

    const bodyHash = crypto.createHash("sha256").update(bodyString).digest("hex");
    const payload = `${timestamp}.${nonce}.${bodyHash}`;

    const signature = crypto
      .createHmac("sha256", config.appScriptSecret)
      .update(payload)
      .digest("hex");

    return {
      "X-Signature": signature,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Action": action,
      "Content-Type": "application/json"
    };
  }

  /**
   * Request next letter number from Apps Script / Google Sheets
   */
  static async getNextDugaar(): Promise<string> {
    const url = `${config.appScriptUrl}?action=getNextDugaar`;
    const headers = this.generateAuthHeaders("", "getNextDugaar");

    try {
      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) {
        throw new Error(`Apps Script responded with HTTP ${response.status}`);
      }
      const data = (await response.json()) as any;
      if (data.success && data.nextDugaar) {
        return data.nextDugaar;
      }
      throw new Error(data.error || "Failed to retrieve next dugaar");
    } catch (err) {
      logger.warn("Could not fetch next dugaar from Apps Script, using fallback sequence", { err });
      return `I-26-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Generate official letter document (Alban bichig)
   */
  static async generateOfficialLetter(payload: GenerateLetterPayload): Promise<LetterGenerationResult> {
    const body = {
      action: "generateAlbanBichig",
      ...payload
    };
    const bodyString = JSON.stringify(body);
    const headers = this.generateAuthHeaders(bodyString, "generateAlbanBichig");

    logger.info("Sending signed request to Apps Script to generate letter", {
      orderId: payload.orderId,
      dugaar: payload.dugaar
    });

    try {
      const response = await fetch(config.appScriptUrl, {
        method: "POST",
        headers,
        body: bodyString
      });

      if (!response.ok) {
        throw new Error(`Apps Script responded with HTTP ${response.status}`);
      }

      const result = (await response.json()) as any;
      logger.info("Received Apps Script response", { success: result.success, fileId: result.fileId });
      return result;
    } catch (error: any) {
      logger.error("Apps Script letter generation failed", error);
      return {
        success: false,
        status: "FAILED",
        error: error.message || "Failed to communicate with Google Apps Script"
      };
    }
  }

  /**
   * Fetch completed documents from Google Drive
   */
  static async getCompletedDocuments(): Promise<any[]> {
    const url = `${config.appScriptUrl}?action=getDoneDocuments`;
    const headers = this.generateAuthHeaders("", "getDoneDocuments");

    try {
      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as any;
      return data.documents || [];
    } catch (err) {
      logger.error("Failed to fetch completed documents from Apps Script", err);
      return [];
    }
  }
}

import crypto from "node:crypto";
import { getDatabase } from "../client";
import { generatePublicToken, hashPublicToken } from "../../auth/token.service";
import { logger } from "../../utils/logger";

export type PublicTokenScope = "imd_order_view" | "driver_trip_view" | "document_view";

export interface PublicTokenRecord {
  id: string;
  tokenHash: string;
  scope: PublicTokenScope;
  resourceType: string;
  resourceId: string;
  expiresAt: number;
  revokedAt?: number;
  createdAt: number;
  createdBy?: string;
  lastAccessedAt?: number;
  accessCount: number;
}

export class PublicTokenRepository {
  static createToken(
    scope: PublicTokenScope,
    resourceType: string,
    resourceId: string,
    createdBy = "system",
    expiresInMs = 7 * 24 * 60 * 60 * 1000 // 7 days default
  ): { rawToken: string; record: PublicTokenRecord } {
    const { rawToken, tokenHash } = generatePublicToken();
    const id = `ptok_${crypto.randomUUID().slice(0, 12)}`;
    const now = Date.now();
    const expiresAt = now + expiresInMs;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO public_share_tokens (
        id, token_hash, scope, resource_type, resource_id, expires_at, created_at, created_by, access_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, tokenHash, scope, resourceType, resourceId, expiresAt, now, createdBy);

    const record: PublicTokenRecord = {
      id,
      tokenHash,
      scope,
      resourceType,
      resourceId,
      expiresAt,
      createdAt: now,
      createdBy,
      accessCount: 0
    };

    logger.info("Created public share token", { id, scope, resourceType, resourceId, expiresAt });
    return { rawToken, record };
  }

  static verifyToken(rawToken: string, expectedScope?: PublicTokenScope): PublicTokenRecord | null {
    if (!rawToken || typeof rawToken !== "string") return null;

    const tokenHash = hashPublicToken(rawToken);
    const db = getDatabase();
    const row = db.prepare(`
      SELECT * FROM public_share_tokens
      WHERE token_hash = ?
    `).get(tokenHash) as any;

    if (!row) {
      logger.warn("Public token lookup failed: hash not found");
      return null;
    }

    const now = Date.now();
    if (row.revoked_at) {
      logger.warn("Public token access denied: token revoked", { id: row.id });
      return null;
    }

    if (now > row.expires_at) {
      logger.warn("Public token access denied: token expired", { id: row.id, expiresAt: row.expires_at });
      return null;
    }

    if (expectedScope && row.scope !== expectedScope) {
      logger.warn("Public token access denied: scope mismatch", {
        id: row.id,
        expected: expectedScope,
        actual: row.scope
      });
      return null;
    }

    // Update access statistics
    db.prepare(`
      UPDATE public_share_tokens
      SET last_accessed_at = ?, access_count = access_count + 1
      WHERE id = ?
    `).run(now, row.id);

    return {
      id: row.id,
      tokenHash: row.token_hash,
      scope: row.scope,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at || undefined,
      createdAt: row.created_at,
      createdBy: row.created_by || undefined,
      lastAccessedAt: now,
      accessCount: (row.access_count || 0) + 1
    };
  }

  static revokeToken(tokenIdOrHash: string): boolean {
    const db = getDatabase();
    const now = Date.now();
    const res = db.prepare(`
      UPDATE public_share_tokens
      SET revoked_at = ?
      WHERE id = ? OR token_hash = ?
    `).run(now, tokenIdOrHash, tokenIdOrHash);
    return res.changes > 0;
  }
}

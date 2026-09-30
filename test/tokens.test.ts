import { PublicTokenRepository } from "../server/database/repositories/token.repository";

export function testTokens(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Crypto 64-char token creation and hash verification
  try {
    const { rawToken, record } = PublicTokenRepository.createToken(
      "imd_order_view",
      "order",
      "ORD-TEST-001",
      "test_suite"
    );

    const is64Chars = rawToken.length === 64;
    const verified = PublicTokenRepository.verifyToken(rawToken, "imd_order_view");

    const passed = is64Chars && verified !== null && verified.resourceId === "ORD-TEST-001";
    results.push({
      name: "Cryptographic 64-Char Token Generation & Lookup",
      passed,
      message: passed ? undefined : `Length: ${rawToken.length}, verified: ${!!verified}`
    });
  } catch (e: any) {
    results.push({ name: "Cryptographic 64-Char Token Generation & Lookup", passed: false, message: e.message });
  }

  // Test 2: Token Revocation
  try {
    const { rawToken, record } = PublicTokenRepository.createToken(
      "imd_order_view",
      "order",
      "ORD-TEST-002",
      "test_suite"
    );

    PublicTokenRepository.revokeToken(record.id);
    const verifiedAfterRevoke = PublicTokenRepository.verifyToken(rawToken);

    const passed = verifiedAfterRevoke === null;
    results.push({
      name: "Token Revocation Enforcement",
      passed,
      message: passed ? undefined : "Revoked token was still accepted!"
    });
  } catch (e: any) {
    results.push({ name: "Token Revocation Enforcement", passed: false, message: e.message });
  }

  // Test 3: Scope Enforcement (Scope mismatch returns null)
  try {
    const { rawToken } = PublicTokenRepository.createToken(
      "imd_order_view",
      "order",
      "ORD-TEST-003",
      "test_suite"
    );

    const verifiedWrongScope = PublicTokenRepository.verifyToken(rawToken, "document_view");
    const passed = verifiedWrongScope === null;
    results.push({
      name: "Token Scope Authorization Boundary",
      passed,
      message: passed ? undefined : "Token verified under wrong scope!"
    });
  } catch (e: any) {
    results.push({ name: "Token Scope Authorization Boundary", passed: false, message: e.message });
  }

  return results;
}

import { OdoService } from "../server/modules/telemetry/odo.service";

export function testOdo(): { name: string; passed: boolean; message?: string }[] {
  const results: { name: string; passed: boolean; message?: string }[] = [];

  // Test 1: Valid ODO progression
  try {
    const res = OdoService.validateAndCalculateTripOdo(100000, 100150);
    const passed = res.isValid && res.totalKm === 150 && res.status === "valid";
    results.push({
      name: "Valid ODO Calculation (100,000 -> 100,150 = 150 km)",
      passed,
      message: passed ? undefined : `Expected 150km valid, got ${res.totalKm} (${res.status})`
    });
  } catch (e: any) {
    results.push({ name: "Valid ODO Calculation", passed: false, message: e.message });
  }

  // Test 2: Inverted ODO (End < Start) must be rejected
  try {
    const res = OdoService.validateAndCalculateTripOdo(100200, 100100);
    const passed = !res.isValid && res.status === "invalid";
    results.push({
      name: "Inverted ODO Rejection (End < Start)",
      passed,
      message: passed ? undefined : "Inverted ODO was accepted as valid!"
    });
  } catch (e: any) {
    results.push({ name: "Inverted ODO Rejection", passed: false, message: e.message });
  }

  // Test 3: Excessive daily jump (> 1500 km) flags requires_review
  try {
    const res = OdoService.validateAndCalculateTripOdo(100000, 102000);
    const passed = res.isValid && res.status === "requires_review" && res.totalKm === 2000;
    results.push({
      name: "Excessive Daily Jump Detection (> 1500 km requires review)",
      passed,
      message: passed ? undefined : `Expected requires_review, got ${res.status}`
    });
  } catch (e: any) {
    results.push({ name: "Excessive Daily Jump Detection", passed: false, message: e.message });
  }

  // Test 4: Fuel parsing sanitization
  try {
    const p1 = OdoService.parseNumericFuel("45.5 л");
    const p2 = OdoService.parseNumericFuel(80);
    const p3 = OdoService.parseNumericFuel("—");

    const passed = p1.liters === 45.5 && p2.liters === 80 && p3.liters === undefined;
    results.push({
      name: "Numeric Fuel Sanitization",
      passed,
      message: passed ? undefined : "Fuel parsing failed"
    });
  } catch (e: any) {
    results.push({ name: "Numeric Fuel Sanitization", passed: false, message: e.message });
  }

  return results;
}

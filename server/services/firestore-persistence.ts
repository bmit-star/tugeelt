import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  writeBatch,
  Firestore
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let dbInstance: Firestore | null = null;
let quotaExhaustedUntil = 0; // Timestamp until which Firestore writes are paused

function isQuotaExhausted(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "");
  return (
    code === "resource-exhausted" ||
    code === "8" ||
    err.code === 8 ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota limit exceeded") ||
    msg.includes("quota metric") ||
    msg.includes("free tier database")
  );
}

function handleFirestoreError(context: string, err: any): void {
  if (isQuotaExhausted(err)) {
    // Free daily quota exhausted on Firestore free tier; pause cloud writes for 1 hour
    quotaExhaustedUntil = Date.now() + 60 * 60 * 1000;
    dirtyDrivers.clear();
    dirtyAssignments.clear();
    dirtyOrders.clear();
    dirtyConfigs.clear();
    console.warn(`[FIRESTORE] Free tier daily write quota limit reached in ${context}. Pausing cloud writes for 1 hour. Local database operates with zero disruption.`);
  } else {
    console.warn(`[FIRESTORE] Cloud sync notice in ${context}:`, err?.message || err);
  }
}

function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

export function getFirestoreDB(): Firestore | null {
  if (dbInstance) return dbInstance;
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    dbInstance = getFirestore(app, config.firestoreDatabaseId);
    return dbInstance;
  } catch (err: any) {
    console.error("[FIRESTORE_PERSISTENCE] Failed to initialize Firestore:", err.message);
    return null;
  }
}

// Dirty tracking sets to prevent redundant Firestore writes and avoid quota exhaustion
const dirtyDrivers = new Set<string>();
const dirtyAssignments = new Set<string>();
const dirtyOrders = new Set<string>();
const dirtyConfigs = new Set<string>();

export function markDirtyDriver(id: string): void {
  if (id) dirtyDrivers.add(String(id).toUpperCase());
}

export function markDirtyAssignment(id: string): void {
  if (id) dirtyAssignments.add(String(id));
}

export function markDirtyOrder(id: string): void {
  if (id) dirtyOrders.add(String(id));
}

export function markDirtyConfig(key: string): void {
  if (key) dirtyConfigs.add(String(key));
}

/**
 * Save single assignment to Firestore
 */
export async function saveAssignmentToFirestore(asn: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !asn || !asn.id) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    const clean = sanitizeForFirestore({
      ...asn,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_assignments", String(asn.id)), clean, { merge: true });
  } catch (err: any) {
    handleFirestoreError("saveAssignmentToFirestore", err);
  }
}

/**
 * Delete assignment from Firestore
 */
export async function deleteAssignmentFromFirestore(asnId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !asnId) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    await deleteDoc(doc(db, "fleet_assignments", String(asnId)));
  } catch (err: any) {
    handleFirestoreError("deleteAssignmentFromFirestore", err);
  }
}

/**
 * Save single order to Firestore
 */
export async function saveOrderToFirestore(order: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !order || !order.id) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    const clean = sanitizeForFirestore({
      ...order,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_orders", String(order.id)), clean, { merge: true });
  } catch (err: any) {
    handleFirestoreError("saveOrderToFirestore", err);
  }
}

/**
 * Delete order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !orderId) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    await deleteDoc(doc(db, "fleet_orders", String(orderId)));
  } catch (err: any) {
    handleFirestoreError("deleteOrderFromFirestore", err);
  }
}

/**
 * Save driver modifications to Firestore (Full document without merge so cleared fields are removed)
 */
export async function saveDriverToFirestore(driver: any): Promise<void> {
  const db = getFirestoreDB();
  if (!driver || !driver.id) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    const clean = sanitizeForFirestore({
      ...driver,
      _syncedAt: new Date().toISOString()
    });
    // Write full document WITHOUT merge: true so cleared fields (phone, salesRep, etc.) are deleted in Firestore
    await setDoc(doc(db, "fleet_drivers", String(driver.id)), clean);
  } catch (err: any) {
    handleFirestoreError("saveDriverToFirestore", err);
  }
}

/**
 * Delete driver from Firestore
 */
export async function deleteDriverFromFirestore(driverId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !driverId) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    await deleteDoc(doc(db, "fleet_drivers", String(driverId)));
  } catch (err: any) {
    handleFirestoreError("deleteDriverFromFirestore", err);
  }
}

/**
 * Save system configuration documents (work_schedule, gpsbox, fines, daily_assignments)
 */
export async function saveConfigToFirestore(key: string, data: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !key || !data) return;
  if (Date.now() < quotaExhaustedUntil) return;

  try {
    const clean = sanitizeForFirestore({
      key,
      data,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_configs", key), clean);
  } catch (err: any) {
    handleFirestoreError("saveConfigToFirestore", err);
  }
}

/**
 * Load all persistent data from Firestore on boot
 */
export async function loadAllFromFirestore(): Promise<{
  assignments: any[];
  orders: any[];
  drivers: any[];
  configs: Record<string, any>;
} | null> {
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    console.log("[FIRESTORE] Loading cloud persistent state...");
    const [asnSnap, ordSnap, drvSnap, cfgSnap] = await Promise.all([
      getDocs(collection(db, "fleet_assignments")),
      getDocs(collection(db, "fleet_orders")),
      getDocs(collection(db, "fleet_drivers")),
      getDocs(collection(db, "fleet_configs"))
    ]);

    const assignments = asnSnap.docs.map(d => d.data());
    const orders = ordSnap.docs.map(d => d.data());
    const drivers = drvSnap.docs.map(d => d.data());
    const configs: Record<string, any> = {};
    cfgSnap.docs.forEach(d => {
      const data = d.data();
      configs[d.id] = data.data !== undefined ? data.data : data;
    });

    console.log(`[FIRESTORE] Loaded from cloud: ${assignments.length} assignments, ${orders.length} orders, ${drivers.length} drivers, ${Object.keys(configs).length} configs`);
    return { assignments, orders, drivers, configs };
  } catch (err: any) {
    console.warn("[FIRESTORE] Cloud state load notice:", err.message);
    return null;
  }
}

/**
 * Hydrate in-memory state with persistent Firestore records
 * Strictly honors tombstones and timestamps (local newer wins).
 */
export function hydrateStateWithFirestore(state: any, cloudData: {
  assignments: any[];
  orders: any[];
  drivers: any[];
  configs: Record<string, any>;
}): boolean {
  if (!state || !cloudData) return false;
  let modified = false;

  const deletedDrivers = new Set(Object.keys(state.deleted?.drivers || {}));
  const deletedAssignments = new Set(Object.keys(state.deleted?.assignments || {}));
  const deletedOrders = new Set(Object.keys(state.deleted?.orders || {}));

  // 1. Hydrate Assignments (Томилолт)
  if (cloudData.assignments && cloudData.assignments.length > 0) {
    if (!state.assignments) state.assignments = [];
    const existingAsnMap = new Map<string, any>();
    state.assignments.forEach((a: any) => {
      if (a && a.id) existingAsnMap.set(String(a.id), a);
    });

    cloudData.assignments.forEach(cloudAsn => {
      if (!cloudAsn || !cloudAsn.id) return;
      if (deletedAssignments.has(String(cloudAsn.id))) return; // Skip tombstoned

      const existing = existingAsnMap.get(String(cloudAsn.id));
      if (!existing) {
        state.assignments.push(cloudAsn);
        modified = true;
      } else {
        const cloudTime = new Date(cloudAsn.updatedAt || cloudAsn._syncedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime > localTime) {
          Object.assign(existing, cloudAsn);
          modified = true;
        }
      }
    });

    state.assignments.sort((a: any, b: any) => 
      String(b.departureDate || "").localeCompare(String(a.departureDate || ""))
    );
  }

  // 2. Hydrate Orders (Захиалга)
  if (cloudData.orders && cloudData.orders.length > 0) {
    if (!state.orders) state.orders = [];
    const existingOrdMap = new Map<string, any>();
    state.orders.forEach((o: any) => {
      if (o && o.id) existingOrdMap.set(String(o.id), o);
    });

    cloudData.orders.forEach(cloudOrd => {
      if (!cloudOrd || !cloudOrd.id) return;
      if (deletedOrders.has(String(cloudOrd.id))) return; // Skip tombstoned

      const existing = existingOrdMap.get(String(cloudOrd.id));
      if (!existing) {
        state.orders.push(cloudOrd);
        modified = true;
      } else {
        const cloudTime = new Date(cloudOrd.updatedAt || cloudOrd._syncedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime > localTime) {
          Object.assign(existing, cloudOrd);
          modified = true;
        }
      }
    });
  }

  // 3. Hydrate Drivers (Жолоочийн өөрчлөлт, тохиргоо)
  if (cloudData.drivers && cloudData.drivers.length > 0) {
    if (!state.drivers) state.drivers = [];
    const driverMap = new Map<string, any>();
    state.drivers.forEach((d: any) => {
      if (d && d.id) driverMap.set(String(d.id).toUpperCase(), d);
    });

    cloudData.drivers.forEach(cloudDriver => {
      if (!cloudDriver || !cloudDriver.id) return;
      const cleanId = String(cloudDriver.id).toUpperCase();
      if (deletedDrivers.has(cleanId) || cloudDriver.status === "deleted") return; // Skip tombstoned

      const existing = driverMap.get(cleanId);
      if (existing) {
        const cloudTime = new Date(cloudDriver.updatedAt || cloudDriver._syncedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        const cloudRev = Number(cloudDriver.rev || 0);
        const localRev = Number(existing.rev || 0);

        // Local wins if newer or higher revision
        if (cloudTime > localTime || cloudRev > localRev) {
          existing.name = cloudDriver.name ?? existing.name;
          existing.phone = cloudDriver.phone ?? "";
          existing.vehicle = cloudDriver.vehicle ?? existing.vehicle;
          existing.model = cloudDriver.model ?? existing.model;
          existing.salesRep = cloudDriver.salesRep ?? "";
          existing.defaultRoute = cloudDriver.defaultRoute ?? "";
          existing.zone = cloudDriver.zone ?? "";
          existing.isIMD = cloudDriver.isIMD ?? existing.isIMD;
          existing.organization = cloudDriver.organization ?? existing.organization;
          existing.jobTitle = cloudDriver.jobTitle ?? existing.jobTitle;
          existing.autoOdoConfig = cloudDriver.autoOdoConfig ?? existing.autoOdoConfig;
          existing.status = cloudDriver.status ?? existing.status;
          existing.rev = Math.max(cloudRev, localRev);
          existing.updatedAt = cloudDriver.updatedAt || new Date().toISOString();
          modified = true;
        }
      } else {
        state.drivers.push(cloudDriver);
        modified = true;
      }
    });
  }

  // 4. Hydrate Configs (Тохиргоо)
  if (cloudData.configs) {
    if (cloudData.configs.work_schedule && !state.workScheduleConfig?.months) {
      state.workScheduleConfig = {
        ...state.workScheduleConfig,
        ...cloudData.configs.work_schedule
      };
      modified = true;
    }
    if (cloudData.configs.gpsbox) {
      state.gpsboxConfig = {
        ...state.gpsboxConfig,
        ...cloudData.configs.gpsbox
      };
      modified = true;
    }
    if (cloudData.configs.fine_config) {
      state.fineConfig = cloudData.configs.fine_config;
      modified = true;
    }
    if (cloudData.configs.daily_assignments && Array.isArray(cloudData.configs.daily_assignments)) {
      if (!state.dailyAssignments) state.dailyAssignments = [];
      const localMap = new Map<string, any>();
      state.dailyAssignments.forEach((a: any) => {
        if (a && a.id) localMap.set(a.id, a);
      });
      for (const cloudItem of cloudData.configs.daily_assignments) {
        if (!cloudItem || !cloudItem.id) continue;
        const local = localMap.get(cloudItem.id);
        if (!local) {
          state.dailyAssignments.push(cloudItem);
          modified = true;
        } else {
          const cloudTime = new Date(cloudItem.updatedAt || cloudItem._syncedAt || 0).getTime();
          const localTime = new Date(local.updatedAt || 0).getTime();
          if (cloudTime > localTime) {
            Object.assign(local, cloudItem);
            modified = true;
          }
        }
      }
    }
  }

  return modified;
}

// Debounced background selective sync (runs at most once every 60s for DIRTY entities only)
let syncTimeout: NodeJS.Timeout | null = null;
let lastSyncTimestamp = 0;

export function triggerFullFirestoreSync(state: any, delayMs = 60000) {
  if (Date.now() < quotaExhaustedUntil) return;
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    const db = getFirestoreDB();
    if (!db || !state) return;
    if (Date.now() < quotaExhaustedUntil) return;

    // Check if there is anything dirty to write
    const hasDirty = dirtyDrivers.size > 0 || dirtyAssignments.size > 0 || dirtyOrders.size > 0 || dirtyConfigs.size > 0;
    if (!hasDirty) return;

    try {
      const now = Date.now();
      if (now - lastSyncTimestamp < 30000) return; // Min 30s interval
      lastSyncTimestamp = now;

      const batch = writeBatch(db);
      let opCount = 0;

      // 1. Sync dirty drivers only
      for (const dId of Array.from(dirtyDrivers)) {
        if (opCount >= 400) break;
        const drv = (state.drivers || []).find((d: any) => String(d.id).toUpperCase() === dId);
        if (drv) {
          const clean = sanitizeForFirestore({ ...drv, _syncedAt: new Date().toISOString() });
          batch.set(doc(db, "fleet_drivers", String(drv.id)), clean);
          opCount++;
        }
        dirtyDrivers.delete(dId);
      }

      // 2. Sync dirty assignments only
      for (const aId of Array.from(dirtyAssignments)) {
        if (opCount >= 400) break;
        const asn = (state.assignments || []).find((a: any) => String(a.id) === aId);
        if (asn) {
          const clean = sanitizeForFirestore({ ...asn, _syncedAt: new Date().toISOString() });
          batch.set(doc(db, "fleet_assignments", String(asn.id)), clean);
          opCount++;
        }
        dirtyAssignments.delete(aId);
      }

      // 3. Sync dirty orders only
      for (const oId of Array.from(dirtyOrders)) {
        if (opCount >= 400) break;
        const ord = (state.orders || []).find((o: any) => String(o.id) === oId);
        if (ord) {
          const clean = sanitizeForFirestore({ ...ord, _syncedAt: new Date().toISOString() });
          batch.set(doc(db, "fleet_orders", String(ord.id)), clean);
          opCount++;
        }
        dirtyOrders.delete(oId);
      }

      // 4. Sync dirty configs only
      for (const cKey of Array.from(dirtyConfigs)) {
        if (opCount >= 400) break;
        let cfgData: any = null;
        if (cKey === "work_schedule") cfgData = state.workScheduleConfig;
        else if (cKey === "gpsbox") cfgData = state.gpsboxConfig;
        else if (cKey === "fine_config") cfgData = state.fineConfig;
        else if (cKey === "daily_assignments") cfgData = state.dailyAssignments;

        if (cfgData) {
          const clean = sanitizeForFirestore({ key: cKey, data: cfgData, _syncedAt: new Date().toISOString() });
          batch.set(doc(db, "fleet_configs", cKey), clean);
          opCount++;
        }
        dirtyConfigs.delete(cKey);
      }

      if (opCount > 0) {
        await batch.commit();
        console.log(`[FIRESTORE] Committed batch of ${opCount} dirty entities to cloud.`);
      }
    } catch (err: any) {
      handleFirestoreError("triggerFullFirestoreSync", err);
    }
  }, delayMs);
}

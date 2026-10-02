import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  writeBatch,
  Firestore
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let dbInstance: Firestore | null = null;

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
      console.warn("[FIRESTORE_PERSISTENCE] firebase-applet-config.json not found");
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    dbInstance = getFirestore(app, config.firestoreDatabaseId);
    console.log("[FIRESTORE_PERSISTENCE] Firestore initialized successfully with dbId:", config.firestoreDatabaseId);
    return dbInstance;
  } catch (err: any) {
    console.error("[FIRESTORE_PERSISTENCE] Failed to initialize Firestore:", err.message);
    return null;
  }
}

/**
 * Save single assignment to Firestore
 */
export async function saveAssignmentToFirestore(asn: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !asn || !asn.id) return;
  try {
    const clean = sanitizeForFirestore({
      ...asn,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_assignments", String(asn.id)), clean, { merge: true });
    console.log(`[FIRESTORE] Assignment ${asn.id} (${asn.orderNo || ""}) synced successfully`);
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to sync assignment ${asn.id}:`, err.message);
  }
}

/**
 * Delete assignment from Firestore
 */
export async function deleteAssignmentFromFirestore(asnId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !asnId) return;
  try {
    await deleteDoc(doc(db, "fleet_assignments", String(asnId)));
    console.log(`[FIRESTORE] Assignment ${asnId} deleted from Firestore`);
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to delete assignment ${asnId}:`, err.message);
  }
}

/**
 * Save single order to Firestore
 */
export async function saveOrderToFirestore(order: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !order || !order.id) return;
  try {
    const clean = sanitizeForFirestore({
      ...order,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_orders", String(order.id)), clean, { merge: true });
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to sync order ${order.id}:`, err.message);
  }
}

/**
 * Delete order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !orderId) return;
  try {
    await deleteDoc(doc(db, "fleet_orders", String(orderId)));
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to delete order ${orderId}:`, err.message);
  }
}

/**
 * Save driver modifications to Firestore
 */
export async function saveDriverToFirestore(driver: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !driver || !driver.id) return;
  try {
    const clean = sanitizeForFirestore({
      ...driver,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_drivers", String(driver.id)), clean, { merge: true });
    console.log(`[FIRESTORE] Driver ${driver.id} (${driver.name || ""}) synced successfully`);
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to sync driver ${driver.id}:`, err.message);
  }
}

/**
 * Delete driver from Firestore
 */
export async function deleteDriverFromFirestore(driverId: string): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !driverId) return;
  try {
    await deleteDoc(doc(db, "fleet_drivers", String(driverId)));
    console.log(`[FIRESTORE] Driver ${driverId} deleted from Firestore`);
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to delete driver ${driverId}:`, err.message);
  }
}

/**
 * Save system configuration documents (work_schedule, gpsbox, fines, daily_assignments)
 */
export async function saveConfigToFirestore(key: string, data: any): Promise<void> {
  const db = getFirestoreDB();
  if (!db || !key || !data) return;
  try {
    const clean = sanitizeForFirestore({
      key,
      data,
      _syncedAt: new Date().toISOString()
    });
    await setDoc(doc(db, "fleet_configs", key), clean, { merge: true });
    console.log(`[FIRESTORE] Config '${key}' synced successfully`);
  } catch (err: any) {
    console.error(`[FIRESTORE] Failed to sync config '${key}':`, err.message);
  }
}

/**
 * Load all persistent state from Firestore
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
    console.error("[FIRESTORE] Failed to load cloud state:", err.message);
    return null;
  }
}

/**
 * Hydrate in-memory state with persistent Firestore records
 */
export function hydrateStateWithFirestore(state: any, cloudData: {
  assignments: any[];
  orders: any[];
  drivers: any[];
  configs: Record<string, any>;
}): boolean {
  if (!state || !cloudData) return false;
  let modified = false;

  // 1. Hydrate Assignments (Томилолт)
  if (cloudData.assignments && cloudData.assignments.length > 0) {
    if (!state.assignments) state.assignments = [];
    const existingAsnMap = new Map<string, any>();
    state.assignments.forEach((a: any) => {
      if (a && a.id) existingAsnMap.set(String(a.id), a);
    });

    cloudData.assignments.forEach(cloudAsn => {
      if (!cloudAsn || !cloudAsn.id) return;
      const existing = existingAsnMap.get(String(cloudAsn.id));
      if (!existing) {
        state.assignments.push(cloudAsn);
        modified = true;
      } else {
        // Merge cloud updates
        const cloudTime = new Date(cloudAsn.updatedAt || cloudAsn._syncedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime >= localTime) {
          Object.assign(existing, cloudAsn);
          modified = true;
        }
      }
    });

    // Sort by departureDate descending
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
      if (!existingOrdMap.has(String(cloudOrd.id))) {
        state.orders.push(cloudOrd);
        modified = true;
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
      const existing = driverMap.get(String(cloudDriver.id).toUpperCase());
      if (existing) {
        // Protect user-edited fields from being reverted
        if (cloudDriver.name) existing.name = cloudDriver.name;
        if (cloudDriver.phone) existing.phone = cloudDriver.phone;
        if (cloudDriver.vehicle) existing.vehicle = cloudDriver.vehicle;
        if (cloudDriver.model) existing.model = cloudDriver.model;
        if (cloudDriver.salesRep !== undefined) existing.salesRep = cloudDriver.salesRep;
        if (cloudDriver.defaultRoute) existing.defaultRoute = cloudDriver.defaultRoute;
        if (cloudDriver.zone) existing.zone = cloudDriver.zone;
        if (cloudDriver.isIMD !== undefined) existing.isIMD = cloudDriver.isIMD;
        if (cloudDriver.organization) existing.organization = cloudDriver.organization;
        if (cloudDriver.jobTitle) existing.jobTitle = cloudDriver.jobTitle;
        if (cloudDriver.autoOdoConfig) existing.autoOdoConfig = cloudDriver.autoOdoConfig;
        if (cloudDriver.status) existing.status = cloudDriver.status;
        modified = true;
      } else {
        state.drivers.push(cloudDriver);
        modified = true;
      }
    });
  }

  // 4. Hydrate Configs (Тохиргоо)
  if (cloudData.configs) {
    if (cloudData.configs.work_schedule) {
      state.workScheduleConfig = cloudData.configs.work_schedule;
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
          if (cloudTime >= localTime) {
            Object.assign(local, cloudItem);
            modified = true;
          }
        }
      }
    }
  }

  return modified;
}

// Debounced background full sync
let syncTimeout: NodeJS.Timeout | null = null;

export function triggerFullFirestoreSync(state: any, delayMs = 1500) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    const db = getFirestoreDB();
    if (!db || !state) return;

    try {
      console.log("[FIRESTORE] Performing debounced full sync to cloud...");
      const batchPromises: Promise<any>[] = [];

      // 1. Sync assignments
      if (Array.isArray(state.assignments)) {
        for (const asn of state.assignments) {
          if (asn && asn.id) {
            batchPromises.push(saveAssignmentToFirestore(asn));
          }
        }
      }

      // 2. Sync orders
      if (Array.isArray(state.orders)) {
        for (const ord of state.orders) {
          if (ord && ord.id) {
            batchPromises.push(saveOrderToFirestore(ord));
          }
        }
      }

      // 3. Sync configs
      if (state.workScheduleConfig) {
        batchPromises.push(saveConfigToFirestore("work_schedule", state.workScheduleConfig));
      }
      if (state.gpsboxConfig) {
        batchPromises.push(saveConfigToFirestore("gpsbox", state.gpsboxConfig));
      }
      if (state.fineConfig) {
        batchPromises.push(saveConfigToFirestore("fine_config", state.fineConfig));
      }
      if (state.dailyAssignments) {
        batchPromises.push(saveConfigToFirestore("daily_assignments", state.dailyAssignments));
      }

      // 4. Sync drivers
      if (Array.isArray(state.drivers)) {
        for (const drv of state.drivers) {
          if (drv && drv.id) {
            batchPromises.push(saveDriverToFirestore(drv));
          }
        }
      }

      await Promise.allSettled(batchPromises);
      console.log("[FIRESTORE] Full cloud sync complete!");
    } catch (err: any) {
      console.error("[FIRESTORE] Full sync error:", err.message);
    }
  }, delayMs);
}

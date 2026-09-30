// IMT (City Distribution Fleet) Central Depot Geofence Constants & Helper Functions
// Location: 47°54'07.2"N 106°51'02.7"E (500m radius)
// Time window: 06:00 to 23:59 on configured working days
// Total KM calculation: endOdo (23:59 return) - startOdo (06:00 departure)

export const IMT_DEPOT_CONFIG = {
  name: "АйсМарк Төв Бааз / Түгээлтийн төв",
  coordinatesDMS: `47°54'07.2"N 106°51'02.7"E`,
  lat: 47.902000,
  lng: 106.850750,
  radiusMeters: 500,
  workWindowStart: "06:00",
  workWindowEnd: "23:59",
  targetGroup: "Зөвхөн IMT жолооч нар (Хотод түгээлт хийх 30 тээврийн хэрэгсэл)",
  ruleDescription:
    'Замын хуудасны явсан км тооцохдоо: 47°54\'07.2"N 106°51\'02.7"E энэ байрлалд 500м радиус, ажлын тохируулсан өдрүүдийн өглөө 06:00 цагаас орой 23:59 минутын одометрийг хасч (Эцсийн ODO - Эхний ODO) кмыг байрлуулна. Энэ нь зөвхөн IMT жолооч нарт хамааралтай.',
};

/**
 * Calculates distance in meters between any GPS coordinate and the IMT Central Depot
 */
export function calculateDistanceToDepot(lat: number, lng: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat - IMT_DEPOT_CONFIG.lat) * Math.PI) / 180;
  const dLng = ((lng - IMT_DEPOT_CONFIG.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((IMT_DEPOT_CONFIG.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Checks if coordinate is within 500m radius of the IMT Depot
 */
export function isInsideDepotGeofence(lat?: number, lng?: number, radiusMeters = IMT_DEPOT_CONFIG.radiusMeters): boolean {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return false;
  return calculateDistanceToDepot(lat, lng) <= radiusMeters;
}

/**
 * Check if a driver belongs to IMT (city distribution, non-IMD)
 */
export function isIMTDriver(driver?: { isIMD?: boolean; defaultRoute?: string }): boolean {
  if (!driver) return false;
  return driver.isIMD !== true;
}

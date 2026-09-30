export interface ProvinceRouteConfig {
  id: string;
  destination: string;
  province: string;
  mealCount: number; // Батлагдсан хоолны давтамж
  roundTripKm: number; // Км (яваад ирэх албан ёсны зай)
  roadPost?: string;
}

export const PROVINCE_ROUTES_LIST: ProvinceRouteConfig[] = [
  { id: "RT-ERDENET", destination: "Эрдэнэт", province: "Орхон", mealCount: 3, roundTripKm: 742, roadPost: "Дархан, Эрдэнэт" },
  { id: "RT-DARKHAN", destination: "Дархан Уул", province: "Дархан Уул", mealCount: 2, roundTripKm: 438, roadPost: "22-ын товчоо, Баруунхараа, Дархан" },
  { id: "RT-TOSONTSEnGEL", destination: "Тосонцэнгэл", province: "Завхан", mealCount: 5, roundTripKm: 1606, roadPost: "Цэцэрлэг, Солонготын даваа, Тосонцэнгэл" },
  { id: "RT-ULAANGOM", destination: "Улаангом", province: "Увс", mealCount: 6, roundTripKm: 2672, roadPost: "Тосонцэнгэл, Сонгино, Улаангом" },
  { id: "RT-UNDURKHAAN", destination: "Өндөрхаан", province: "Хэнтий", mealCount: 3, roundTripKm: 662, roadPost: "Багануур, Цэнхэрмандал, Өндөрхаан" },
  { id: "RT-MURUN", destination: "Мөрөн", province: "Хөвсгөл", mealCount: 5, roundTripKm: 1620, roadPost: "Дархан, Эрдэнэт, Булган, Мөрөн" },
  { id: "RT-KHOVD", destination: "Ховд", province: "Ховд", mealCount: 6, roundTripKm: 2851, roadPost: "Баянхонгор, Алтай, Дарви, Ховд" },
  { id: "RT-BARUUNURT", destination: "Баруун-Урт", province: "Сүхбаатар", mealCount: 4, roundTripKm: 1120, roadPost: "Багануур, Өндөрхаан, Баруун-Урт" },
  { id: "RT-DALANZADGAD", destination: "Даланзадгад", province: "Өмнөговь", mealCount: 4, roundTripKm: 1106, roadPost: "Мандалговь, Даланзадгад" },
  { id: "RT-ARVAIKHEER", destination: "Арвайхээр", province: "Өвөрхангай", mealCount: 3, roundTripKm: 860, roadPost: "Лүн, Элсэн тасархай, Арвайхээр" },
  { id: "RT-ULIASTAI", destination: "Улиастай", province: "Завхан", mealCount: 5, roundTripKm: 2030, roadPost: "Арвайхээр, Баянхонгор, Улиастай" },
  { id: "RT-MANDALGOVI", destination: "Мандалговь", province: "Дундговь", mealCount: 2, roundTripKm: 560, roadPost: "Зүүн дэлгэр, Мандалговь" },
  { id: "RT-CHOIBALSAN", destination: "Чойбалсан", province: "Дорнод", mealCount: 4, roundTripKm: 1310, roadPost: "Өндөрхаан, Хэрлэн, Чойбалсан" },
  { id: "RT-SAINSHAND", destination: "Сайншанд", province: "Дорноговь", mealCount: 3, roundTripKm: 926, roadPost: "Налайх, Чойр, Сайншанд" },
  { id: "RT-BAYANKHONGOR", destination: "Баянхонгор", province: "Баянхонгор", mealCount: 4, roundTripKm: 1260, roadPost: "Арвайхээр, Баянхонгор" },
  { id: "RT-TSETSERLEG", destination: "Цэцэрлэг хот", province: "Архангай", mealCount: 3, roundTripKm: 906, roadPost: "Лүн, Өгий нуур, Цэцэрлэг" },
  { id: "RT-ZAMYN-UUD", destination: "Замын-Үүд сум", province: "Дорноговь", mealCount: 4, roundTripKm: 1316, roadPost: "Чойр, Сайншанд, Замын-Үүд" },
  { id: "RT-ZUUN-KHARA", destination: "Зүүн-Хараа сум", province: "Сэлэнгэ", mealCount: 2, roundTripKm: 360, roadPost: "Баянчандмань, Зүүнхараа" },
  { id: "RT-ALTAI", destination: "Алтай хот", province: "Говь-Алтай", mealCount: 5, roundTripKm: 2074, roadPost: "Баянхонгор, Буурцаг, Алтай" },
  { id: "RT-SUKHBAATAR", destination: "Сүхбаатар хот", province: "Сэлэнгэ", mealCount: 3, roundTripKm: 700, roadPost: "Дархан, Сүхбаатар товчоо" },
  { id: "RT-KHARKHORIN", destination: "Хархорин", province: "Өвөрхангай", mealCount: 3, roundTripKm: 700, roadPost: "Лүн, Элсэн тасархай, Хархорин" },
  { id: "RT-BAGANUUR", destination: "Багануур дүүрэг", province: "Улаанбаатар", mealCount: 2, roundTripKm: 320, roadPost: "Налайх, Багануур" },
  { id: "RT-AIRAG", destination: "Айраг сум", province: "Дорноговь", mealCount: 3, roundTripKm: 640, roadPost: "Чойр, Айраг" },
  { id: "RT-CHOIR", destination: "Чойр", province: "Говьсүмбэр", mealCount: 2, roundTripKm: 480, roadPost: "Налайх, Баянтал, Чойр" }
];

export const PROVINCE_ROUTES = PROVINCE_ROUTES_LIST;

export const MEAL_RATE_PER_PERSON = 25000; // Нэг хүний хоолны норм 25,000₮

/**
 * Чиглэл эсвэл аймгийн нэрээр хайж тохирох маршрутын мэдээллийг буцаана
 */
export function findProvinceRoute(query: string): ProvinceRouteConfig | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  
  // Exact match first
  let found = PROVINCE_ROUTES_LIST.find(
    r => r.destination.toLowerCase() === q || r.province.toLowerCase() === q
  );
  if (found) return found;

  // Normalized substring match
  const cleanQ = q.replace(/[\s\-_]/g, "");
  found = PROVINCE_ROUTES_LIST.find(r => {
    const cleanDest = r.destination.toLowerCase().replace(/[\s\-_]/g, "");
    const cleanProv = r.province.toLowerCase().replace(/[\s\-_]/g, "");
    return cleanDest.includes(cleanQ) || cleanQ.includes(cleanDest) || cleanProv.includes(cleanQ) || cleanQ.includes(cleanProv);
  });

  return found;
}

/**
 * Хоолны мөнгө тооцоолох:
 * mealCount * 25,000₮ * driverCount (1 эсвэл 2)
 */
export function calculateMealAllowance(
  destinationName: string,
  hasSubstituteDriver: boolean
): {
  route?: ProvinceRouteConfig;
  mealCount: number;
  driverCount: number;
  ratePerPerson: number;
  mealPerPerson: number;
  totalMealAllowance: number;
  roundTripKm: number;
} {
  const route = findProvinceRoute(destinationName);
  const mealCount = route ? route.mealCount : 3;
  const roundTripKm = route ? route.roundTripKm : 0;
  const driverCount = hasSubstituteDriver ? 2 : 1;
  const ratePerPerson = MEAL_RATE_PER_PERSON;
  const mealPerPerson = mealCount * ratePerPerson;
  const totalMealAllowance = mealPerPerson * driverCount;

  return {
    route,
    mealCount,
    driverCount,
    ratePerPerson,
    mealPerPerson,
    totalMealAllowance,
    roundTripKm
  };
}

/**
 * Албан ёсны 8 IMD аймаг, холын тээврийн жолоочийн жагсаалт:
 * Зөвхөн эдгээр жолооч нар дээр IMD томилолт, км бодолт, хоолны мөнгөний хэсэг ажиллана.
 */
export interface IMDProvinceDriverInfo {
  id: string;
  code: string;
  name: string;
  vehicle: string;
}

export const IMD_PROVINCE_DRIVERS: IMDProvinceDriverInfo[] = [
  { id: "775", code: "775", name: "Чу.Мөнхгэрэл", vehicle: "8374УНЕ" },
  { id: "141", code: "141", name: "Ми.Анхбаяр", vehicle: "3147УЕН" },
  { id: "9726", code: "9726", name: "Ул.Мөнгөнзул", vehicle: "3148УЕМ" },
  { id: "14", code: "14", name: "Пү.Доржпалам", vehicle: "3148УЕО" },
  { id: "173", code: "173", name: "Эн.Отгонсүх", vehicle: "5909УКО" },
  { id: "314", code: "314", name: "Сү.Баттогтох", vehicle: "6530УКН" },
  { id: "283", code: "283", name: "Жа.Алтанхуяг", vehicle: "8376УЕН" },
  { id: "5535", code: "5535", name: "Со.Баярсайхан", vehicle: "8428УНД" },
  { id: "8531", code: "8531", name: "Б.Ганболд", vehicle: "8531УББ" },
  { id: "9988", code: "9988", name: "Чү.Мөнхгэрэл", vehicle: "9988УНБ" },
  { id: "3147", code: "3147", name: "Б.Энхтөр", vehicle: "3147УНЭ" }
];

export const IMD_PROVINCE_DRIVER_IDS = new Set(IMD_PROVINCE_DRIVERS.map(d => d.id));
export const IMD_PROVINCE_DRIVER_VEHICLES = new Set(
  IMD_PROVINCE_DRIVERS.map(d => d.vehicle.replace(/\s+/g, "").toUpperCase())
);

/**
 * Тухайн жолооч албан ёсны IMD томилолтын 8 жолоочийн нэг мөн эсэхийг шалгана
 */
export function isIMDProvinceDriver(
  driver: { id?: string; code?: string; name?: string; vehicle?: string; vehicleNumber?: string; organization?: string; isIMD?: boolean } | null | undefined
): boolean {
  if (!driver) return false;
  if (driver.isIMD) return true;
  if (driver.organization && (driver.organization.includes("Дистрибьюшн") || driver.organization.toUpperCase().includes("IMD"))) return true;
  const dId = String(driver.id || "").trim();
  const dCode = String(driver.code || "").trim();
  const dVeh = String(driver.vehicle || driver.vehicleNumber || "").replace(/\s+/g, "").toUpperCase();
  const dName = String(driver.name || "").trim();

  if (dId.toUpperCase().includes("IMD") || dCode.toUpperCase().includes("IMD")) return true;
  if (IMD_PROVINCE_DRIVER_IDS.has(dId) || IMD_PROVINCE_DRIVER_IDS.has(dCode)) return true;
  if (IMD_PROVINCE_DRIVER_VEHICLES.has(dVeh)) return true;

  // Name check fallback for the 8 authorized drivers
  if (
    dName.includes("Мөнхгэрэл") ||
    dName.includes("Анхбаяр") ||
    dName.includes("Мөнгөнзул") ||
    dName.includes("Доржпалам") ||
    dName.includes("Отгонсүх") ||
    dName.includes("Баттогтох") ||
    dName.includes("Алтанхуяг") ||
    dName.includes("Баярсайхан")
  ) {
    return true;
  }

  return false;
}

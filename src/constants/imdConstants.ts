import { Driver, IMDRoute } from "../types";

export interface IMDMasterDriverConfig {
  id: string;
  code: string;
  name: string;
  vehicle: string;
  phone: string;
  model: string;
  salesRep: string;
  defaultRoute: string;
  jobTitle?: string;
  boxCapacity: number; // Зайрмаг ачих багтаамж (хайрцаг)
}

// Машин тус бүрийн албан ёсны хайрцагны багтаамж
export const IMD_VEHICLE_BOX_CAPACITIES: Record<string, number> = {
  "8374УНЕ": 1000,
  "3147УЕН": 700,
  "3148УЕМ": 700,
  "3148УЕО": 700,
  "5909УКО": 1500,
  "6530УКН": 1500,
  "8376УЕН": 700,
  "8428УНД": 700,
};

// 8 Official IMD Master Drivers & Vehicles (Ажлын байрны нэр: ТҮГЭЭГЧ)
export const IMD_MASTER_DRIVERS: IMDMasterDriverConfig[] = [
  {
    id: "775",
    code: "775",
    name: "Чу.Мөнхгэрэл",
    vehicle: "8374УНЕ",
    phone: "99117775",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Орон нутаг холын тээвэр",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 1000
  },
  {
    id: "141",
    code: "141",
    name: "Ми.Анхбаяр",
    vehicle: "3147УЕН",
    phone: "99119141",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Хөвсгөл, Мөрөн чиглэл",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 700
  },
  {
    id: "9726",
    code: "9726",
    name: "Ул.Мөнгөнзул",
    vehicle: "3148УЕМ",
    phone: "99119726",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Дорноговь, Замын-Үүд чиглэл",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 700
  },
  {
    id: "14",
    code: "14",
    name: "Пү.Доржпалам",
    vehicle: "3148УЕО",
    phone: "99119014",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Дархан, Сэлэнгэ, Хойд чиглэл",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 700
  },
  {
    id: "173",
    code: "173",
    name: "Эн.Отгонсүх",
    vehicle: "5909УКО",
    phone: "99119173",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Орон нутаг холын тээвэр",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 1500
  },
  {
    id: "314",
    code: "314",
    name: "Сү.Баттогтох",
    vehicle: "6530УКН",
    phone: "99119314",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Орон нутаг холын тээвэр",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 1500
  },
  {
    id: "283",
    code: "283",
    name: "Жа.Алтанхуяг",
    vehicle: "8376УЕН",
    phone: "99119283",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Сэлгээ & Холын тээвэр",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 700
  },
  {
    id: "5535",
    code: "5535",
    name: "Со.Баярсайхан",
    vehicle: "8428УНД",
    phone: "99115535",
    model: "Isuzu Forward",
    salesRep: "",
    defaultRoute: "Дорнод, Чойбалсан чиглэл",
    jobTitle: "ТҮГЭЭГЧ",
    boxCapacity: 700
  }
];

/**
 * Машины улсын дугаар эсвэл жолоочийн кодоор хайрцагны багтаамжийг олох туслах функц
 */
export const getVehicleBoxCapacity = (
  plateOrDriverId?: string,
  driversList?: Driver[]
): number => {
  if (!plateOrDriverId) return 700;
  const clean = plateOrDriverId.replace(/\s+/g, "").toUpperCase();

  // 1. Check custom drivers list if boxCapacity is present
  if (driversList && driversList.length > 0) {
    const matched = driversList.find((d) => {
      const vPlate = d.vehicle ? d.vehicle.replace(/\s+/g, "").toUpperCase() : "";
      return (
        vPlate === clean ||
        d.id.toUpperCase() === clean ||
        (d.code && d.code.toUpperCase() === clean) ||
        d.name.includes(clean)
      );
    });
    if (matched && matched.boxCapacity && matched.boxCapacity > 0) {
      return matched.boxCapacity;
    }
  }

  // 2. Check standardized official capacity map
  for (const [plate, cap] of Object.entries(IMD_VEHICLE_BOX_CAPACITIES)) {
    const cleanP = plate.replace(/\s+/g, "").toUpperCase();
    if (clean === cleanP || clean.includes(cleanP) || cleanP.includes(clean)) {
      return cap;
    }
  }

  // 3. Fallback default standard capacity
  return 700;
};

// 24 Official Province / Route Distances (2 талдаа / км)
export const OFFICIAL_IMD_ROUTES: IMDRoute[] = [
  { id: "RT-ERDENET", province: "Орхон", destination: "Эрдэнэт", roundTripKm: 742, roadPost: "Дархан, Эрдэнэт", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-DARKHAN", province: "Дархан Уул", destination: "Дархан Уул", roundTripKm: 438, roadPost: "22-ын товчоо, Баруунхараа, Дархан", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-TOSONTSEnGEL", province: "Завхан", destination: "Тосонцэнгэл", roundTripKm: 1606, roadPost: "Цэцэрлэг, Солонготын даваа, Тосонцэнгэл", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-ULAANGOM", province: "Увс", destination: "Улаангом", roundTripKm: 2672, roadPost: "Тосонцэнгэл, Сонгино, Улаангом", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-UNDURKHAAN", province: "Хэнтий", destination: "Өндөрхаан", roundTripKm: 662, roadPost: "Багануур, Цэнхэрмандал, Өндөрхаан", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-MURUN", province: "Хөвсгөл", destination: "Мөрөн", roundTripKm: 1620, roadPost: "Дархан, Эрдэнэт, Булган, Мөрөн", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-KHOVD", province: "Ховд", destination: "Ховд", roundTripKm: 2851, roadPost: "Баянхонгор, Алтай, Дарви, Ховд", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-BARUUNURT", province: "Сүхбаатар", destination: "Баруун-Урт", roundTripKm: 1120, roadPost: "Багануур, Өндөрхаан, Баруун-Урт", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-DALANZADGAD", province: "Өмнөговь", destination: "Даланзадгад", roundTripKm: 1106, roadPost: "Мандалговь, Даланзадгад", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-ARVAIKHEER", province: "Өвөрхангай", destination: "Арвайхээр", roundTripKm: 860, roadPost: "Лүн, Элсэн тасархай, Арвайхээр", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-ULIASTAI", province: "Завхан", destination: "Улиастай", roundTripKm: 2030, roadPost: "Арвайхээр, Баянхонгор эсвэл Тосонцэнгэл, Загастай", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-MANDALGOVI", province: "Дундговь", destination: "Мандалговь", roundTripKm: 560, roadPost: "Зүүн дэлгэр, Мандалговь", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-CHOIBALSAN", province: "Дорнод", destination: "Чойбалсан", roundTripKm: 1310, roadPost: "Өндөрхаан, Хэрлэн, Чойбалсан", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-SAINSHAND", province: "Дорноговь", destination: "Сайншанд", roundTripKm: 926, roadPost: "Налайх, Чойр, Сайншанд", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-BAYANKHONGOR", province: "Баянхонгор", destination: "Баянхогор", roundTripKm: 1260, roadPost: "Арвайхээр, Баянхонгор", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-TSETSERLEG", province: "Архангай", destination: "Цэцэрлэг хот", roundTripKm: 906, roadPost: "Лүн, Өгий нуур, Цэцэрлэг", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-ZAMYN-UUD", province: "Дорноговь", destination: "Замын-Үүд сум", roundTripKm: 1316, roadPost: "Чойр, Сайншанд, Замын-Үүд", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-ZUUN-KHARA", province: "Сэлэнгэ", destination: "Зүүн-Хараа сум", roundTripKm: 360, roadPost: "Баянчандмань, Зүүнхараа", mealFrequency: "Өдөрт 1 удаа" },
  { id: "RT-ALTAI", province: "Говь-Алтай", destination: "Алтай хот", roundTripKm: 2074, roadPost: "Баянхонгор, Буурцаг, Алтай", mealFrequency: "Өдөрт 3 удаа" },
  { id: "RT-SUKHBAATAR", province: "Сэлэнгэ", destination: "Сүхбаатар хот", roundTripKm: 700, roadPost: "Дархан, Сүхбаатар товчоо", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-KHARKHORIN", province: "Өвөрхангай", destination: "Хархорин", roundTripKm: 700, roadPost: "Лүн, Элсэн тасархай, Хархорин", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-BAGANUUR", province: "Улаанбаатар", destination: "Багануур дүүрэг", roundTripKm: 320, roadPost: "Налайх, Багануур", mealFrequency: "Өдөрт 1 удаа" },
  { id: "RT-AIRAG", province: "Дорноговь", destination: "Айраг сум", roundTripKm: 640, roadPost: "Чойр, Айраг", mealFrequency: "Өдөрт 2 удаа" },
  { id: "RT-CHOIR", province: "Говьсүмбэр", destination: "Чойр", roundTripKm: 480, roadPost: "Налайх, Баянтал, Чойр", mealFrequency: "Өдөрт 1 удаа" }
];

export function findRouteByDestination(name: string): IMDRoute | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return OFFICIAL_IMD_ROUTES.find(
    r => r.destination.toLowerCase().includes(clean) ||
         r.province.toLowerCase().includes(clean) ||
         clean.includes(r.destination.toLowerCase()) ||
         clean.includes(r.province.toLowerCase())
  );
}

export function getRouteRoundTripKm(name: string, fallback = 0): number {
  const found = findRouteByDestination(name);
  return found ? found.roundTripKm : fallback;
}

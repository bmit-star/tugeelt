/**
 * Authoritative IMD Regional Assignment & Master Data Service
 * 
 * CORE ARCHITECTURAL RULE:
 * 1. "ЗӨвхөн IMD дээр томилолт бичигдэх ба хотын борлуулалтаас ялгаж салгаж зохион байгуул"
 *    - "Томилолт" (Assignments) is strictly and exclusively for IMD Regional Long-Distance Trucks (10 trucks).
 *    - City delivery vehicles (30 vehicles: 5 KA + 25 M series) perform daily city sales routes ("Хотын борлуулалт"), NOT long-distance assignments.
 * 2. "Зохиомол утгуудыг устга"
 *    - All mock/dummy assignments (e.g. ORD-IMD-260915-001 through 030) are purged.
 */

import fs from "node:fs";
import path from "node:path";
import { getDatabase } from "../../database/client";

export interface MasterVehicleAssignmentDef {
  code: string;
  plate: string;
  name: string;
  phone: string;
  zone: string;
  prov: string;
  dest: string;
  qty: number;
  capacity: number;
  startOdo: number;
  actualKm: number;
  departureDate: string;
  returnDate: string;
  status: "Тээвэрт гарсан" | "Дууссан" | "Төлөвлөсөн";
  letterNo: string;
  salesRep?: string;
}

export interface MasterCityDriverDef {
  code: string;
  plate: string;
  name: string;
  phone: string;
  zone: string;
  defaultRoute: string;
  capacity: number;
  startOdo: number;
  salesRep: string;
  series: "KA" | "M";
}

// ---------------------------------------------------------------------------------
// 10 OFFICIAL IMD REGIONAL TRUCKS (Орон нутаг, холын тээврийн 10 том машин)
// ЗӨВХӨН эдгээр 10 тээврийн хэрэгсэл дээр албан ёсны томилолт үүснэ!
// ---------------------------------------------------------------------------------
export const MASTER_IMD_REGIONAL_ASSIGNMENTS_DEF: MasterVehicleAssignmentDef[] = [
  {
    code: "775",
    plate: "8374УНЕ",
    name: "Чу.Мөнхгэрэл",
    phone: "99117775",
    zone: "Хөвсгөл аймаг, Мөрөн хот, Хатгал тосгон, Тосонцэнгэл сум",
    prov: "Хөвсгөл",
    dest: "Мөрөн хот",
    qty: 2400,
    capacity: 2500,
    startOdo: 184500,
    actualKm: 1680,
    departureDate: "2026-09-15",
    returnDate: "2026-09-18",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2231"
  },
  {
    code: "141",
    plate: "3147УЕН",
    name: "Ми.Анхбаяр",
    phone: "99119141",
    zone: "Завхан аймаг, Улиастай хот, Тосонцэнгэл, Их-Уул сум",
    prov: "Завхан",
    dest: "Улиастай хот",
    qty: 2200,
    capacity: 2300,
    startOdo: 192300,
    actualKm: 1980,
    departureDate: "2026-09-15",
    returnDate: "2026-09-19",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2232"
  },
  {
    code: "9726",
    plate: "3148УЕМ",
    name: "Ул.Мөнгөнзул",
    phone: "99119726",
    zone: "Дорноговь аймаг, Замын-Үүд боомт, Сайншанд хот",
    prov: "Дорноговь",
    dest: "Замын-Үүд сум",
    qty: 2100,
    capacity: 2200,
    startOdo: 178400,
    actualKm: 1320,
    departureDate: "2026-09-15",
    returnDate: "2026-09-17",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2233"
  },
  {
    code: "14",
    plate: "3148УЕО",
    name: "Пү.Доржпалам",
    phone: "99119014",
    zone: "Дархан-Уул аймаг, Дархан хот, Шарын гол сум",
    prov: "Дархан-Уул",
    dest: "Дархан хот",
    qty: 2400,
    capacity: 2500,
    startOdo: 165800,
    actualKm: 450,
    departureDate: "2026-09-15",
    returnDate: "2026-09-16",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2234"
  },
  {
    code: "173",
    plate: "5909УКО",
    name: "Эн.Отгонсүх",
    phone: "99119173",
    zone: "Баянхонгор аймаг, Баянхонгор хот, Галуут, Бөмбөгөр",
    prov: "Баянхонгор",
    dest: "Баянхонгор хот",
    qty: 1850,
    capacity: 2000,
    startOdo: 171200,
    actualKm: 1280,
    departureDate: "2026-09-15",
    returnDate: "2026-09-18",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2235"
  },
  {
    code: "314",
    plate: "6530УКН",
    name: "Сү.Баттогтох",
    phone: "99119314",
    zone: "Өмнөговь аймаг, Даланзадгад хот, Цогтцэций, Ханбогд",
    prov: "Өмнөговь",
    dest: "Даланзадгад хот",
    qty: 2000,
    capacity: 2200,
    startOdo: 183600,
    actualKm: 1160,
    departureDate: "2026-09-15",
    returnDate: "2026-09-18",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2236"
  },
  {
    code: "283",
    plate: "8376УЕН",
    name: "Жа.Алтанхуяг",
    phone: "99119283",
    zone: "Увс аймаг, Улаангом хот, Баруунтуруун, Тэс сум",
    prov: "Увс",
    dest: "Улаангом хот",
    qty: 2200,
    capacity: 2400,
    startOdo: 196400,
    actualKm: 2740,
    departureDate: "2026-09-15",
    returnDate: "2026-09-20",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2237"
  },
  {
    code: "5535",
    plate: "8428УНД",
    name: "Со.Баярсайхан",
    phone: "99115535",
    zone: "Дорнод аймаг, Чойбалсан хот, Баян-Уул, Хэрлэн сум",
    prov: "Дорнод",
    dest: "Чойбалсан хот",
    qty: 2100,
    capacity: 2300,
    startOdo: 174900,
    actualKm: 1310,
    departureDate: "2026-09-15",
    returnDate: "2026-09-17",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2238"
  },
  {
    code: "8531",
    plate: "8531УББ",
    name: "Б.Ганболд",
    phone: "99118531",
    zone: "Орхон аймаг, Эрдэнэт хот, Баян-Өндөр сум",
    prov: "Орхон",
    dest: "Эрдэнэт хот",
    qty: 2300,
    capacity: 2400,
    startOdo: 168200,
    actualKm: 740,
    departureDate: "2026-09-15",
    returnDate: "2026-09-16",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2239"
  },
  {
    code: "9988",
    plate: "9988УНБ",
    name: "Чү.Мөнхгэрэл",
    phone: "99119988",
    zone: "Сэлэнгэ аймаг, Сүхбаатар хот, Алтанбулаг боомт, Мандал",
    prov: "Сэлэнгэ",
    dest: "Сүхбаатар хот",
    qty: 2200,
    capacity: 2300,
    startOdo: 159100,
    actualKm: 680,
    departureDate: "2026-09-15",
    returnDate: "2026-09-16",
    status: "Тээвэрт гарсан",
    letterNo: "I-26-2240"
  }
];

// ---------------------------------------------------------------------------------
// 30 CITY DISTRIBUTION DRIVERS (Хотын Борлуулалтын Түгээгчид: 5 KA + 25 M)
// Эдгээр түгээгчид нь өдрийн түгээлт, маршрутаар явдаг ба IMD томилолт БИЧИГДЭХГҮЙ!
// ---------------------------------------------------------------------------------
export const MASTER_CITY_SALES_FLEET_DEF: MasterCityDriverDef[] = [
  // 5 KA Network
  {
    code: "KA1",
    plate: "1096УНЗ",
    name: "Ж.Баттөмөр",
    phone: "99126757",
    zone: "KA1",
    defaultRoute: "KA1",
    capacity: 2000,
    startOdo: 23654,
    salesRep: "Ганхуяг 89518991",
    series: "KA"
  },
  {
    code: "KA2",
    plate: "5201УКН",
    name: "Баярхүү",
    phone: "99427860",
    zone: "GS25 CU- Агуулах",
    defaultRoute: "GS25 CU- Агуулах",
    capacity: 2200,
    startOdo: 22321,
    salesRep: "Төв салбар",
    series: "KA"
  },
  {
    code: "KA3",
    plate: "7841УНА",
    name: "Ган-Эрдэнэ",
    phone: "88199640",
    zone: "KA3",
    defaultRoute: "KA3",
    capacity: 1800,
    startOdo: 173007,
    salesRep: "Төв салбар",
    series: "KA"
  },
  {
    code: "KA4",
    plate: "1076УЕВ",
    name: "Дэлгэрсайхан",
    phone: "88028916",
    zone: "KA4",
    defaultRoute: "KA4",
    capacity: 1800,
    startOdo: 154200,
    salesRep: "Төгс-Очир",
    series: "KA"
  },
  {
    code: "KA5",
    plate: "1081УЕВ",
    name: "Алтаншагай",
    phone: "86300590",
    zone: "Vending machine",
    defaultRoute: "Vending machine",
    capacity: 1900,
    startOdo: 161800,
    salesRep: "Алтаншагай",
    series: "KA"
  },

  // 25 M District Delivery
  {
    code: "M1",
    plate: "1051УЕВ",
    name: "Дашдаваа",
    phone: "88680407",
    zone: "Эмээлт, Монос, 22-ын товчоо, 10 буудал, Станц, Тахилт, Орбит, Цэргийн хотхон",
    defaultRoute: "Эмээлт, Монос, 22-ын товчоо, 10 буудал, Станц, Тахилт, Орбит, Цэргийн хотхон",
    capacity: 1600,
    startOdo: 142100,
    salesRep: "Лх.Цэцгээ",
    series: "M"
  },
  {
    code: "M2",
    plate: "5206УКН",
    name: "Отгонзаяа",
    phone: "88192973",
    zone: "Толгой, Их бага наран, Орчлон хороолол, Содон хороолол, Нарангын гол",
    defaultRoute: "Толгой, Их бага наран, Орчлон хороолол, Содон хороолол, Нарангын гол",
    capacity: 1600,
    startOdo: 139800,
    salesRep: "Тө.Уранбаатар",
    series: "M"
  },
  {
    code: "M3",
    plate: "3096УАХ",
    name: "Хү. Баттулга",
    phone: "99473464",
    zone: "Зүүн салаа, Баруун салаа, Хилчин, Хилчингийн арын гэр хороолол",
    defaultRoute: "Зүүн салаа, Баруун салаа, Хилчин, Хилчингийн арын гэр хороолол",
    capacity: 1500,
    startOdo: 145600,
    salesRep: "До.Сарантуяа",
    series: "M"
  },
  {
    code: "M4",
    plate: "2811УЕК",
    name: "О. Ганзориг",
    phone: "99062458",
    zone: "Баян хошуу, Жанцан, Зуун мод",
    defaultRoute: "Баян хошуу, Жанцан, Зуун мод",
    capacity: 1600,
    startOdo: 151200,
    salesRep: "Отгонжаргал",
    series: "M"
  },
  {
    code: "M5",
    plate: "5176УКН",
    name: "Энхбаатар",
    phone: "88844155",
    zone: "1 хорооллын ар, Ханын материал, 21-р хороолол",
    defaultRoute: "1 хорооллын ар, Ханын материал, 21-р хороолол",
    capacity: 1600,
    startOdo: 148900,
    salesRep: "Цэ.Болдоо",
    series: "M"
  },
  {
    code: "M6",
    plate: "5096УБТ",
    name: "Наранхүү",
    phone: "96113327",
    zone: "1-р хороолол, Москва хороолол, Монгол Хьондай, Хар хорин хороолол, 5 шар, Драгон, Залуус хороолол, Саппоро, Цамба",
    defaultRoute: "1-р хороолол, Москва хороолол, Монгол Хьондай, Хар хорин хороолол, 5 шар, Драгон, Залуус хороолол, Саппоро, Цамба",
    capacity: 1500,
    startOdo: 136700,
    salesRep: "Р.Төгсөө",
    series: "M"
  },
  {
    code: "M7",
    plate: "1061УЕВ",
    name: "Тулга",
    phone: "80096338",
    zone: "Нисэх, Био комбинат, Морингийн даваа, Шувуун фабрик, Өлзийт хороолол, Буянт ухаа 2",
    defaultRoute: "Нисэх, Био комбинат, Морингийн даваа, Шувуун фабрик, Өлзийт хороолол, Буянт ухаа 2",
    capacity: 1700,
    startOdo: 158300,
    salesRep: "Ня.Лхагва-Очир",
    series: "M"
  },
  {
    code: "M8",
    plate: "6071УАУ",
    name: "Батцогт",
    phone: "88914243",
    zone: "Вива сити, Богд виллаа, Яармаг, Нүхт",
    defaultRoute: "Вива сити, Богд виллаа, Яармаг, Нүхт",
    capacity: 1500,
    startOdo: 144200,
    salesRep: "Бү.Батчулуун",
    series: "M"
  },
  {
    code: "M9",
    plate: "6091УНГ",
    name: "Бат. Мөнх-Эрдэнэ",
    phone: "86018994",
    zone: "Зайсан, Үйлдвэр комбинат, 19-р хороолол, 120, Алтай хотхон",
    defaultRoute: "Зайсан, Үйлдвэр комбинат, 19-р хороолол, 120, Алтай хотхон",
    capacity: 1600,
    startOdo: 152800,
    salesRep: "Бу.Галсан",
    series: "M"
  },
  {
    code: "M10",
    plate: "2511УАВ",
    name: "Мөнхсүлд",
    phone: "86205667",
    zone: "Харанхуй, Энхболд, Энхбаярын зам, 3-р хороолол, Бичил хороолол, Эх нялхас",
    defaultRoute: "Харанхуй, Энхболд, Энхбаярын зам, 3-р хороолол, Бичил хороолол, Эх нялхас",
    capacity: 1600,
    startOdo: 147500,
    salesRep: "Ре.Батсүх",
    series: "M"
  },
  {
    code: "M11",
    plate: "2511УАЕ",
    name: "Пүрэвсүрэн",
    phone: "85198534",
    zone: "Их дэлгүүр, Гандан, 1-р 40 мянгат, Бөмбөгөр, Андууд, 25-р эмийн сан, Нарны хороолол, Хурдын хороолол",
    defaultRoute: "Их дэлгүүр, Гандан, 1-р 40 мянгат, Бөмбөгөр, Андууд, 25-р эмийн сан, Нарны хороолол, Хурдын хороолол",
    capacity: 1600,
    startOdo: 160400,
    salesRep: "Эрхэмбаяр",
    series: "M"
  },
  {
    code: "M12",
    plate: "1041УЕВ",
    name: "Баяржаргал",
    phone: "89013200",
    zone: "Модны 2, Гэмтэлийн эмнэлэг, 4-р хороолол, 10-р хороолол, 3-р эмнэлэг",
    defaultRoute: "Модны 2, Гэмтэлийн эмнэлэг, 4-р хороолол, 10-р хороолол, 3-р эмнэлэг",
    capacity: 1500,
    startOdo: 138900,
    salesRep: "Га.Урьдынбиш",
    series: "M"
  },
  {
    code: "M13",
    plate: "1046УНГ",
    name: "Насанбаяр",
    phone: "95705757",
    zone: "Төмөр замын вокзал, Голден парк хотхон /10-р хорооллын замын урд/, 220 мянгат",
    defaultRoute: "Төмөр замын вокзал, Голден парк хотхон /10-р хорооллын замын урд/, 220 мянгат",
    capacity: 1600,
    startOdo: 149300,
    salesRep: "Дэ.Оюун",
    series: "M"
  },
  {
    code: "M14",
    plate: "8951УБС",
    name: "Нямдэмбэрэл",
    phone: "96565683",
    zone: "Багшийн дээд талбайн урд тал, 13-р хороолол бөхийн өргөө, Түнелээс ус сувгийн удирдах газар, ХААЯ-с чингис зочид буудал",
    defaultRoute: "Багшийн дээд талбайн урд тал, 13-р хороолол бөхийн өргөө, Түнелээс ус сувгийн удирдах газар, ХААЯ-с чингис зочид буудал",
    capacity: 1600,
    startOdo: 146700,
    salesRep: "Ми.Сугар",
    series: "M"
  },
  {
    code: "M15",
    plate: "6091УБК",
    name: "Анх-Эрдэнэ",
    phone: "95190987",
    zone: "805 хил хамгаалах, Зуслангууд, Зунжингаас дамба, Шадивлан, Сансарын колонк РЦНК, Багшийн дээд улаанбаатар зочид буудал",
    defaultRoute: "805 хил хамгаалах, Зуслангууд, Зунжингаас дамба, Шадивлан, Сансарын колонк РЦНК, Багшийн дээд улаанбаатар зочид буудал",
    capacity: 1500,
    startOdo: 153100,
    salesRep: "Ба.Энхжавхлан",
    series: "M"
  },
  {
    code: "M16",
    plate: "2611УЕВ",
    name: "Эрдэнэ-Чулуун",
    phone: "90636371",
    zone: "Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх",
    defaultRoute: "Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх",
    capacity: 1600,
    startOdo: 148230,
    salesRep: "До.Дэмбэрэл",
    series: "M"
  },
  {
    code: "M17",
    plate: "3091УЕА",
    name: "Нэмэхжаргал",
    phone: "90629988",
    zone: "5-р сургууль, Баянбүрд /цагаан байр/, Тэнгис, Дэнжийн 1000, Зурагт замын зүүн тал",
    defaultRoute: "5-р сургууль, Баянбүрд /цагаан байр/, Тэнгис, Дэнжийн 1000, Зурагт замын зүүн тал",
    capacity: 1500,
    startOdo: 141500,
    salesRep: "Балжинням",
    series: "M"
  },
  {
    code: "M18",
    plate: "3091УАО",
    name: "Амартүвшин",
    phone: "95078006",
    zone: "32-ын тойргоос 7 буудал, Чингэлтэй, Хайлааст, Салхит",
    defaultRoute: "32-ын тойргоос 7 буудал, Чингэлтэй, Хайлааст, Салхит",
    capacity: 1600,
    startOdo: 157400,
    salesRep: "Бя.Пүрэвдорж",
    series: "M"
  },
  {
    code: "M19",
    plate: "2611УЕЕ",
    name: "цагийн ажилтан",
    phone: "99110019",
    zone: "32-с 100 айл гэр хороолол, 100 айл, Бага тойруу, Баянбүрд, Монгол 3-р сургууль, 11-р хороолол, Метромолл",
    defaultRoute: "32-с 100 айл гэр хороолол, 100 айл, Бага тойруу, Баянбүрд, Монгол 3-р сургууль, 11-р хороолол, Метромолл",
    capacity: 1600,
    startOdo: 149800,
    salesRep: "Ба.Гэрэлчимэг",
    series: "M"
  },
  {
    code: "M20",
    plate: "3096УАУ",
    name: "Ууганболор",
    phone: "96652588",
    zone: "Нарантуул зах гэр хороолол халдварт, Их монгол, Баянмонгол, Кристал, Олимп, Инканто, Дүнжингарав, БЗД замын доод гэр хороолол- Сүнжингранд",
    defaultRoute: "Нарантуул зах гэр хороолол халдварт, Их монгол, Баянмонгол, Кристал, Олимп, Инканто, Дүнжингарав, БЗД замын доод гэр хороолол- Сүнжингранд",
    capacity: 1600,
    startOdo: 143900,
    salesRep: "Жа.Гантулга",
    series: "M"
  },
  {
    code: "M21",
    plate: "2511УЕЕ",
    name: "Жавхлан",
    phone: "86212422",
    zone: "16-р хороолол, Улаанхуаран",
    defaultRoute: "16-р хороолол, Улаанхуаран",
    capacity: 1600,
    startOdo: 155200,
    salesRep: "До.Буянхишиг",
    series: "M"
  },
  {
    code: "M22",
    plate: "2611УЕК",
    name: "Банзрагч",
    phone: "85926619",
    zone: "Улиастай, Гачуурт, Хужирбулан, Ботаник, Амгалан, Амгалан өртөө, Чулуун овоо, Жанжин клуб",
    defaultRoute: "Улиастай, Гачуурт, Хужирбулан, Ботаник, Амгалан, Амгалан өртөө, Чулуун овоо, Жанжин клуб",
    capacity: 1600,
    startOdo: 146100,
    salesRep: "Цо.Булган",
    series: "M"
  },
  {
    code: "M23",
    plate: "2411УЕК",
    name: "Энх-Амгалан",
    phone: "86864300",
    zone: "Сансар Баянзүрх талбай, Жуков, БЗД-ийн эмнэлэг, Монел, Кино үйлдвэр",
    defaultRoute: "Сансар Баянзүрх талбай, Жуков, БЗД-ийн эмнэлэг, Монел, Кино үйлдвэр",
    capacity: 1600,
    startOdo: 147800,
    salesRep: "До.Оюун",
    series: "M"
  },
  {
    code: "M24",
    plate: "2711УЕК",
    name: "Бат-Эрдэнэ",
    phone: "88932003",
    zone: "Эрдэнэтолгол, Цайз, Алтан өлгий, Шар хад, Да хүрээ, Цахлай техникийн зах",
    defaultRoute: "Эрдэнэтолгол, Цайз, Алтан өлгий, Шар хад, Да хүрээ, Цахлай техникийн зах",
    capacity: 1600,
    startOdo: 150300,
    salesRep: "Ба.Энхбаяр",
    series: "M"
  },
  {
    code: "M25",
    plate: "2511УНЛ",
    name: "Б.Батзориг",
    phone: "89282415",
    zone: "Налайх дүүрэг, Гордок, Хонхор, Урлан бүтээх, Ургах наран хороолол, Баянзүрхийн товчоо",
    defaultRoute: "Налайх дүүрэг, Гордок, Хонхор, Урлан бүтээх, Ургах наран хороолол, Баянзүрхийн товчоо",
    capacity: 1700,
    startOdo: 162900,
    salesRep: "До.Батчимэг",
    series: "M"
  }
];

// Set of mock city order numbers that MUST be purged
const MOCK_CITY_ORDER_NOS = new Set(
  Array.from({ length: 30 }, (_, i) => `ORD-IMD-260915-${String(i + 1).padStart(3, "0")}`)
);

/**
 * Builds the canonical 10 IMD regional assignments, orders, and official letters.
 */
export function generateCanonicalIMDData() {
  const assignments: any[] = [];
  const orders: any[] = [];
  const letters: any[] = [];

  MASTER_IMD_REGIONAL_ASSIGNMENTS_DEF.forEach((def, index) => {
    // Canonical regional assignments start numbering at index 31 (or 101)
    const paddedIndex = String(index + 31).padStart(3, "0");
    const orderNo = `ORD-IMD-260915-${paddedIndex}`;
    const orderId = `order_${orderNo.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const assignmentId = `asn_${orderNo.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const token = `tok_${def.plate.replace(/[^0-9a-zA-Z]/g, "")}_${paddedIndex}`;
    const letterId = `LTR-260915-${paddedIndex}`;

    // 1. Assignment
    const assignment = {
      id: assignmentId,
      orderId: orderId,
      orderNo: orderNo,
      province: def.prov,
      destination: def.dest,
      vehicleId: def.plate,
      vehiclePlate: def.plate,
      primaryDriverId: def.code,
      primaryDriverName: def.name,
      primaryDriverPhone: def.phone,
      departureDate: def.departureDate,
      returnDate: def.returnDate,
      quantity: def.qty,
      vehicleCapacity: def.capacity,
      note: def.zone,
      status: def.status,
      token: token,
      startOdo: def.startOdo,
      endOdo: def.startOdo + def.actualKm,
      actualKm: def.actualKm,
      roundTripKm: def.actualKm,
      isRegistered: true,
      isMock: false,
      albanBichigStatus: "DONE",
      albanBichigDugaar: def.letterNo,
      albanBichigFileName: `${def.letterNo}_${def.plate}.pdf`,
      albanBichigPdfUrl: `/api/imd/official-letters/${letterId}/download`,
      albanBichigGeneratedAt: "2026-09-15T08:00:00.000Z",
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: new Date().toISOString()
    };
    assignments.push(assignment);

    // 2. Corresponding Order
    const order = {
      id: orderId,
      orderNo: orderNo,
      customer: `Борлуулалтын салбар - ${def.dest}`,
      customerOrg: `${def.prov} аймгийн салбар`,
      province: def.prov,
      destination: def.dest,
      quantity: def.qty,
      receivedDate: "2026-09-14",
      deliveryDate: def.departureDate,
      status: def.status === "Тээвэрт гарсан" ? "Тээвэрт гарсан" : "Томилолт хуваарилагдсан",
      assignmentId: assignmentId,
      vehiclePlate: def.plate,
      primaryDriverName: def.name,
      shareToken: token,
      isRegistered: true,
      isMock: false,
      notes: def.zone,
      createdAt: "2026-09-14T09:00:00.000Z",
      updatedAt: new Date().toISOString()
    };
    orders.push(order);

    // 3. Official Letter Record
    const letter = {
      id: letterId,
      dugaar: def.letterNo,
      letterNumber: def.letterNo,
      orderId: orderId,
      orderNo: orderNo,
      assignmentId: assignmentId,
      vehiclePlate: def.plate,
      driverName: def.name,
      driverPhone: def.phone,
      destination: def.dest,
      province: def.prov,
      departureDate: def.departureDate,
      boxCount: def.qty,
      fileId: `file_${letterId.toLowerCase()}`,
      fileName: `${def.letterNo}_${def.plate}.pdf`,
      fileUrl: `/api/imd/official-letters/${letterId}/download`,
      status: "DONE",
      createdAt: "2026-09-15T08:00:00.000Z"
    };
    letters.push(letter);
  });

  return { assignments, orders, letters };
}

/**
 * Execute full restoration:
 * 1. Restores the 10 official IMD regional assignments
 * 2. Purges the 30 mock city assignments
 * 3. Ensures the 30 city delivery drivers exist in db.drivers as City Sales (isIMD: false)
 * 4. Syncs cleanly to SQLite database
 */
export function restore40Assignments(db: any, saveDB: (state: any) => void) {
  const { assignments, orders, letters } = generateCanonicalIMDData();

  if (!db.assignments) db.assignments = [];
  if (!db.orders) db.orders = [];
  if (!db.officialLetters) db.officialLetters = [];
  if (!db.drivers) db.drivers = [];

  // 1. Ensure the 10 IMD Regional Drivers exist with isIMD: true
  MASTER_IMD_REGIONAL_ASSIGNMENTS_DEF.forEach((def) => {
    const existingDriver = db.drivers.find((d: any) => 
      d.id === def.code || 
      (d.vehicle && d.vehicle.replace(/\s+/g, "").toUpperCase() === def.plate.replace(/\s+/g, "").toUpperCase())
    );

    if (existingDriver) {
      existingDriver.name = def.name;
      existingDriver.phone = def.phone;
      existingDriver.vehicle = def.plate;
      existingDriver.zone = def.zone;
      existingDriver.defaultRoute = `${def.prov} - ${def.dest}`;
      existingDriver.isIMD = true;
      existingDriver.boxCapacity = def.capacity;
      existingDriver.status = "active";
    } else {
      db.drivers.push({
        id: def.code,
        name: def.name,
        phone: def.phone,
        vehicle: def.plate,
        model: "HD78 Хөргүүртэй Тээвэр",
        organization: "АЙСМАРК ТРЕЙД ХХК (IMD)",
        zone: def.zone,
        defaultRoute: `${def.prov} - ${def.dest}`,
        boxCapacity: def.capacity,
        isIMD: true,
        status: "active"
      });
    }
  });

  // 2. Ensure all 30 City Delivery Drivers exist with isIMD: false (Хотын Борлуулалт)
  MASTER_CITY_SALES_FLEET_DEF.forEach((def) => {
    const existingDriver = db.drivers.find((d: any) => 
      d.id === def.code || 
      (d.vehicle && d.vehicle.replace(/\s+/g, "").toUpperCase() === def.plate.replace(/\s+/g, "").toUpperCase())
    );

    if (existingDriver) {
      existingDriver.name = def.name;
      existingDriver.phone = def.phone;
      existingDriver.vehicle = def.plate;
      existingDriver.zone = def.zone;
      existingDriver.defaultRoute = def.defaultRoute;
      existingDriver.salesRep = def.salesRep;
      existingDriver.isIMD = false; // Strictly city delivery!
      existingDriver.boxCapacity = def.capacity;
      existingDriver.status = "active";
    } else {
      db.drivers.push({
        id: def.code,
        name: def.name,
        phone: def.phone,
        vehicle: def.plate,
        model: def.series === "KA" ? "Hyundai HD65 Сүлжээ" : "Hyundai Mighty Түгээлт",
        organization: "АЙСМАРК ТРЕЙД ХХК (Хотын Борлуулалт)",
        zone: def.zone,
        defaultRoute: def.defaultRoute,
        salesRep: def.salesRep,
        boxCapacity: def.capacity,
        isIMD: false, // Strictly city delivery!
        status: "active"
      });
    }
  });

  // 3. PURGE MOCK CITY ASSIGNMENTS & ORDERS
  // Filter out any assignment that belongs to mock city orders (001 to 030) or city vehicles
  const cityPlatesSet = new Set(MASTER_CITY_SALES_FLEET_DEF.map(c => c.plate.replace(/\s+/g, "").toUpperCase()));

  db.assignments = (db.assignments || []).filter((a: any) => {
    if (!a) return false;
    const orderNo = (a.orderNo || "").toUpperCase();
    if (MOCK_CITY_ORDER_NOS.has(orderNo)) return false;
    if (a.isMock === true) return false;
    const veh = (a.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
    // Do NOT allow city delivery plates in IMD assignments!
    if (cityPlatesSet.has(veh)) return false;
    return true;
  });

  db.orders = (db.orders || []).filter((o: any) => {
    if (!o) return false;
    const orderNo = (o.orderNo || "").toUpperCase();
    if (MOCK_CITY_ORDER_NOS.has(orderNo)) return false;
    if (o.isMock === true) return false;
    const veh = (o.vehiclePlate || "").replace(/\s+/g, "").toUpperCase();
    if (cityPlatesSet.has(veh)) return false;
    return true;
  });

  // 4. Merge / Restore the 10 Canonical IMD Regional Assignments
  const canonicalIds = new Set(assignments.map(a => a.id));
  const canonicalPlates = new Set(assignments.map(a => a.vehiclePlate.replace(/\s+/g, "").toUpperCase()));

  const otherAssignments = (db.assignments || []).filter((a: any) => 
    a && !canonicalIds.has(a.id) && !canonicalPlates.has((a.vehiclePlate || "").replace(/\s+/g, "").toUpperCase())
  );
  db.assignments = [...assignments, ...otherAssignments];

  // 5. Merge / Restore Orders
  const canonicalOrderNos = new Set(orders.map(o => o.orderNo.toUpperCase()));
  const otherOrders = (db.orders || []).filter((o: any) => 
    o && !canonicalOrderNos.has((o.orderNo || "").toUpperCase())
  );
  db.orders = [...orders, ...otherOrders];

  // 6. Merge / Restore Official Letters
  const canonicalLetterIds = new Set(letters.map(l => l.id));
  const otherLetters = (db.officialLetters || []).filter((l: any) => 
    l && !canonicalLetterIds.has(l.id)
  );
  db.officialLetters = [...letters, ...otherLetters];

  // 7. Save state atomically
  saveDB(db);

  // 8. Synchronize into SQLite database (both imd_assignments and imd_orders)
  try {
    const sqlite = getDatabase();
    sqlite.exec("BEGIN IMMEDIATE;");
    try {
      // Purge mock assignments from SQLite
      sqlite.prepare("DELETE FROM imd_assignments WHERE order_id LIKE '%001%' OR order_id LIKE '%002%' OR order_id LIKE '%003%' OR order_id LIKE '%004%' OR order_id LIKE '%005%' OR order_id LIKE '%01%' OR order_id LIKE '%02%' OR order_id LIKE '%030%'").run();
      sqlite.prepare("DELETE FROM imd_orders WHERE order_no LIKE 'ORD-IMD-260915-00%' OR order_no LIKE 'ORD-IMD-260915-01%' OR order_no LIKE 'ORD-IMD-260915-02%' OR order_no = 'ORD-IMD-260915-030'").run();

      const insertAsn = sqlite.prepare(`
        INSERT OR REPLACE INTO imd_assignments (
          id, order_id, vehicle_plate, primary_driver_id, primary_driver_name,
          secondary_driver_id, secondary_driver_name, departure_date, status, token, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertOrd = sqlite.prepare(`
        INSERT OR REPLACE INTO imd_orders (
          id, order_no, customer, customer_org, province, destination, quantity,
          received_date, delivery_date, status, assignment_id, share_token, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const a of assignments) {
        insertAsn.run(
          a.id,
          a.orderId,
          a.vehiclePlate,
          a.primaryDriverId,
          a.primaryDriverName,
          null,
          null,
          a.departureDate,
          a.status,
          a.token,
          JSON.stringify(a),
          a.createdAt,
          new Date().toISOString()
        );
      }

      for (const o of orders) {
        insertOrd.run(
          o.id,
          o.orderNo,
          o.customer,
          o.customerOrg,
          o.province,
          o.destination,
          String(o.quantity),
          o.receivedDate,
          o.deliveryDate,
          o.status,
          o.assignmentId,
          o.shareToken,
          o.notes,
          o.createdAt,
          new Date().toISOString()
        );
      }

      sqlite.exec("COMMIT;");
      console.log(`[RESTORE-IMD] Successfully synchronized 10 IMD assignments and orders into SQLite database.`);
    } catch (sqlErr) {
      sqlite.exec("ROLLBACK;");
      console.error("[RESTORE-IMD] SQLite sync error:", sqlErr);
    }
  } catch (dbInitErr) {
    console.error("[RESTORE-IMD] Could not get SQLite instance:", dbInitErr);
  }

  return {
    success: true,
    totalAssignments: db.assignments.length,
    canonicalAssignments: assignments.length,
    totalOrders: db.orders.length,
    canonicalOrders: orders.length,
    cityDriversCount: MASTER_CITY_SALES_FLEET_DEF.length
  };
}

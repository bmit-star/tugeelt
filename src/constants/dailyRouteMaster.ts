export interface MasterRouteDefinition {
  routeId: string;
  driverName: string;
  driverPhone: string;
  salesRep: string;
  salesRepPhone: string;
  srCode: string;
  vehiclePlate: string;
  zone: string;
  division: "IMT" | "IMD";
}

export const MASTER_30_CITY_ROUTES: MasterRouteDefinition[] = [
  // 5 KA Network routes
  {
    routeId: "KA1",
    driverName: "Ж.Баттөмөр",
    driverPhone: "99126757",
    salesRep: "Ганхуяг",
    salesRepPhone: "89518991",
    srCode: "",
    vehiclePlate: "1096УНЗ",
    zone: "KA1 Сүлжээ",
    division: "IMT"
  },
  {
    routeId: "KA2",
    driverName: "Баярхүү",
    driverPhone: "99427860",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "5201УКН",
    zone: "GS25 CU- Агуулах",
    division: "IMT"
  },
  {
    routeId: "KA3",
    driverName: "Ган-Эрдэнэ",
    driverPhone: "88199640",
    salesRep: "Тэмүүлэн",
    salesRepPhone: "88560526",
    srCode: "",
    vehiclePlate: "1036УЕВ",
    zone: "KA3 Сүлжээ",
    division: "IMT"
  },
  {
    routeId: "KA4",
    driverName: "Дэлгэрсайхан",
    driverPhone: "88028916",
    salesRep: "Төгс-Очир",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "1076УЕВ",
    zone: "KA4 Сүлжээ",
    division: "IMT"
  },
  {
    routeId: "KA5",
    driverName: "Алтаншагай",
    driverPhone: "86300590",
    salesRep: "Алтаншагай",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "7841УНА",
    zone: "Vending machine",
    division: "IMT"
  },

  // 25 M District routes
  {
    routeId: "M1",
    driverName: "Дашдаваа",
    driverPhone: "88680407",
    salesRep: "Лх.Цэцгээ",
    salesRepPhone: "",
    srCode: "SP-0281",
    vehiclePlate: "1051УЕВ",
    zone: "Эмээлт, Монос, 22-ын товчоо, 10 буудал, Станц, Тахилт, Орбит, Цэргийн хотхон",
    division: "IMT"
  },
  {
    routeId: "M2",
    driverName: "Отгонзаяа",
    driverPhone: "88192973",
    salesRep: "Тө.Уранбаатар",
    salesRepPhone: "",
    srCode: "SP-0280",
    vehiclePlate: "5206УКН",
    zone: "Толгой, Их бага наран, Орчлон хороолол, Содон хороолол, Нарангын гол",
    division: "IMT"
  },
  {
    routeId: "M3",
    driverName: "Хү. Баттулга",
    driverPhone: "99473464",
    salesRep: "До.Сарантуяа",
    salesRepPhone: "",
    srCode: "SP-0278",
    vehiclePlate: "3096УАХ",
    zone: "Зүүн салаа, Баруун салаа, Хилчин, Хилчингийн арын гэр хороолол",
    division: "IMT"
  },
  {
    routeId: "M4",
    driverName: "О. Ганзориг",
    driverPhone: "99062458",
    salesRep: "Отгонжаргал",
    salesRepPhone: "",
    srCode: "SP-0537",
    vehiclePlate: "2811УЕК",
    zone: "Баян хошуу, Жанцан, Зуун мод",
    division: "IMT"
  },
  {
    routeId: "M5",
    driverName: "Энхбаатар",
    driverPhone: "88844155",
    salesRep: "Цэ.Болдоо",
    salesRepPhone: "",
    srCode: "SP-0272",
    vehiclePlate: "5176УБТ",
    zone: "1 хорооллын ар, Ханын материал, 21-р хороолол",
    division: "IMT"
  },
  {
    routeId: "M6",
    driverName: "Батсугар",
    driverPhone: "95777302",
    salesRep: "Рэ.Төгсөө",
    salesRepPhone: "",
    srCode: "SP-0279",
    vehiclePlate: "5096УБТ",
    zone: "1-р хороолол, Москва хороолол, 5 шар, Драгон, Залуус, Саппоро, Цамба",
    division: "IMT"
  },
  {
    routeId: "M7",
    driverName: "Тулга",
    driverPhone: "80096338",
    salesRep: "Ня.Лхагва-Очир",
    salesRepPhone: "",
    srCode: "SP-0285",
    vehiclePlate: "1061УЕВ",
    zone: "Нисэх, Био комбинат, Морингийн даваа, Шувуун фабрик, Өлзийт, Буянт ухаа 2",
    division: "IMT"
  },
  {
    routeId: "M8",
    driverName: "Батцогт",
    driverPhone: "88914243",
    salesRep: "Бу.Батчулуун",
    salesRepPhone: "",
    srCode: "SP-0269",
    vehiclePlate: "6071УАУ",
    zone: "Вива сити, Богд виллаа, Яармаг, Нүхт",
    division: "IMT"
  },
  {
    routeId: "M9",
    driverName: "Бат. Мөнх-Эрдэнэ",
    driverPhone: "86018994",
    salesRep: "Бу.Галсан",
    salesRepPhone: "",
    srCode: "SP-0274",
    vehiclePlate: "6091УНГ",
    zone: "Зайсан, Үйлдвэр комбинат, 19-р хороолол, 120, Алтай хотхон",
    division: "IMT"
  },
  {
    routeId: "M10",
    driverName: "Мөнхсүлд",
    driverPhone: "89399239",
    salesRep: "Ре.Батсүх",
    salesRepPhone: "",
    srCode: "SP-0267",
    vehiclePlate: "2511УАВ",
    zone: "Харанхуй, Энхболд, 3-р хороолол, Бичил хороолол, Эх нялхас",
    division: "IMT"
  },
  {
    routeId: "M11",
    driverName: "Пүрэвсүрэн",
    driverPhone: "85198534",
    salesRep: "Эрхэмбаяр",
    salesRepPhone: "",
    srCode: "SP-0268",
    vehiclePlate: "2511УАЕ",
    zone: "Их дэлгүүр, Гандан, 1-р 40 мянгат, Бөмбөгөр, Нарны хороолол",
    division: "IMT"
  },
  {
    routeId: "M12",
    driverName: "Баяржаргал",
    driverPhone: "89013200",
    salesRep: "Га.Урьдынбиш",
    salesRepPhone: "",
    srCode: "SP-0270",
    vehiclePlate: "1041УЕВ",
    zone: "Модны 2, Гэмтэлийн эмнэлэг, 4-р хороолол, 10-р хороолол, 3-р эмнэлэг",
    division: "IMT"
  },
  {
    routeId: "M13",
    driverName: "Насанбаяр",
    driverPhone: "95705757",
    salesRep: "Дэ.Оюун",
    salesRepPhone: "",
    srCode: "SP-0271",
    vehiclePlate: "1046УНГ",
    zone: "Төмөр замын вокзал, Голден парк хотхон, 220 мянгат",
    division: "IMT"
  },
  {
    routeId: "M14",
    driverName: "Нямдэмбэрэл",
    driverPhone: "96565683",
    salesRep: "Ми.Сугар",
    salesRepPhone: "",
    srCode: "SP-0273",
    vehiclePlate: "8951УБС",
    zone: "Багшийн дээд, 13-р хороолол, Бөхийн өргөө, УСУГ, ХААЯ",
    division: "IMT"
  },
  {
    routeId: "M15",
    driverName: "Анх-Эрдэнэ",
    driverPhone: "95190987",
    salesRep: "Ба.Энхжавхлан",
    salesRepPhone: "",
    srCode: "SP-0275",
    vehiclePlate: "6091УБК",
    zone: "805-р анги, Зуслангууд, Шадивлан, Сансар, РЦНК",
    division: "IMT"
  },
  {
    routeId: "M16",
    driverName: "Эрдэнэ-Чулуун",
    driverPhone: "90636371",
    salesRep: "До.Дэмбэрэл",
    salesRepPhone: "",
    srCode: "SP-0276",
    vehiclePlate: "2611УЕВ",
    zone: "Бэлх, Сэлх, Дамба, Тоосгоны үйлдвэр, Япон цэрэг, Дарь эх",
    division: "IMT"
  },
  {
    routeId: "M17",
    driverName: "Нэмэхжаргал",
    driverPhone: "90629988",
    salesRep: "Балжинням",
    salesRepPhone: "",
    srCode: "SP-0277",
    vehiclePlate: "3091УЕА",
    zone: "5-р сургууль, Баянбүрд, Тэнгис, Дэнжийн 1000, Зурагт",
    division: "IMT"
  },
  {
    routeId: "M18",
    driverName: "Амартүвшин",
    driverPhone: "95078006",
    salesRep: "Бя.Пүрэвдорж",
    salesRepPhone: "",
    srCode: "SP-0282",
    vehiclePlate: "3091УАО",
    zone: "32-ын тойргоос 7 буудал, Чингэлтэй, Хайлааст, Салхит",
    division: "IMT"
  },
  {
    routeId: "M19",
    driverName: "цагийн ажилтан",
    driverPhone: "99110019",
    salesRep: "Ба.Гэрэлчимэг",
    salesRepPhone: "",
    srCode: "SP-0283",
    vehiclePlate: "2611УЕЕ",
    zone: "32-с 100 айл, Бага тойруу, Монгол 3-р сургууль, 11-р хороолол",
    division: "IMT"
  },
  {
    routeId: "M20",
    driverName: "Ууганболор",
    driverPhone: "96652588",
    salesRep: "Жа.Гантулга",
    salesRepPhone: "",
    srCode: "SP-0284",
    vehiclePlate: "3096УАУ",
    zone: "Нарантуул зах, Баянмонгол, Кристал, Олимп, Дүнжингарав",
    division: "IMT"
  },
  {
    routeId: "M21",
    driverName: "Жавхлан",
    driverPhone: "86212422",
    salesRep: "До.Буянхишиг",
    salesRepPhone: "",
    srCode: "SP-0286",
    vehiclePlate: "2511УЕЕ",
    zone: "16-р хороолол, Улаанхуаран",
    division: "IMT"
  },
  {
    routeId: "M22",
    driverName: "Банзрагч",
    driverPhone: "85926619",
    salesRep: "Цо.Булган",
    salesRepPhone: "",
    srCode: "SP-0287",
    vehiclePlate: "2611УЕК",
    zone: "Улиастай, Гачуурт, Хужирбулан, Ботаник, Амгалан, Чулуун овоо",
    division: "IMT"
  },
  {
    routeId: "M23",
    driverName: "Энх-Амгалан",
    driverPhone: "86864300",
    salesRep: "До.Оюун",
    salesRepPhone: "",
    srCode: "SP-0288",
    vehiclePlate: "2411УЕК",
    zone: "Сансар, Баянзүрх зах, Жуков, БЗД эмнэлэг, Монел, Кино үйлдвэр",
    division: "IMT"
  },
  {
    routeId: "M24",
    driverName: "Бат-Эрдэнэ",
    driverPhone: "88932003",
    salesRep: "Ба.Энхбаяр",
    salesRepPhone: "",
    srCode: "SP-0289",
    vehiclePlate: "2711УЕК",
    zone: "Эрдэнэтолгойт, Цайз, Алтан өлгий, Шар хад, Да хүрээ",
    division: "IMT"
  },
  {
    routeId: "M25",
    driverName: "Б.Батзориг",
    driverPhone: "89282415",
    salesRep: "До.Батчимэг",
    salesRepPhone: "",
    srCode: "SP-0290",
    vehiclePlate: "2511УНЛ",
    zone: "Налайх дүүрэг, Гордок, Хонхор, Ургах наран, Баянзүрхийн товчоо",
    division: "IMT"
  }
];

export const MASTER_10_IMD_ROUTES: MasterRouteDefinition[] = [
  {
    routeId: "775",
    driverName: "Чу.Мөнхгэрэл",
    driverPhone: "99117775",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "8374УНЕ",
    zone: "Хөвсгөл аймаг, Мөрөн хот",
    division: "IMD"
  },
  {
    routeId: "141",
    driverName: "Ми.Анхбаяр",
    driverPhone: "99119141",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "3147УЕН",
    zone: "Завхан аймаг, Улиастай хот",
    division: "IMD"
  },
  {
    routeId: "9726",
    driverName: "Ул.Мөнгөнзул",
    driverPhone: "99119726",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "3148УЕМ",
    zone: "Дорноговь аймаг, Замын-Үүд сум",
    division: "IMD"
  },
  {
    routeId: "14",
    driverName: "Пү.Доржпалам",
    driverPhone: "99119014",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "3148УЕО",
    zone: "Дархан-Уул аймаг, Дархан хот",
    division: "IMD"
  },
  {
    routeId: "173",
    driverName: "Эн.Отгонсүх",
    driverPhone: "99119173",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "5909УКО",
    zone: "Баянхонгор аймаг",
    division: "IMD"
  },
  {
    routeId: "314",
    driverName: "Сү.Баттогтох",
    driverPhone: "99119314",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "6530УКН",
    zone: "Өмнөговь аймаг, Даланзадгад",
    division: "IMD"
  },
  {
    routeId: "283",
    driverName: "Жа.Алтанхуяг",
    driverPhone: "99119283",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "8376УЕН",
    zone: "Увс аймаг, Улаангом",
    division: "IMD"
  },
  {
    routeId: "5535",
    driverName: "Со.Баярсайхан",
    driverPhone: "99115535",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "8428УНД",
    zone: "Дорнод аймаг, Чойбалсан",
    division: "IMD"
  },
  {
    routeId: "8531",
    driverName: "Б.Ганболд",
    driverPhone: "99118531",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "8531УББ",
    zone: "Орхон аймаг, Эрдэнэт хот",
    division: "IMD"
  },
  {
    routeId: "9988",
    driverName: "Чү.Мөнхгэрэл",
    driverPhone: "99119988",
    salesRep: "",
    salesRepPhone: "",
    srCode: "",
    vehiclePlate: "9988УНБ",
    zone: "Сэлэнгэ аймаг, Сүхбаатар хот",
    division: "IMD"
  }
];

export const ALL_MASTER_FLEET_ROUTES: MasterRouteDefinition[] = [
  ...MASTER_30_CITY_ROUTES,
  ...MASTER_10_IMD_ROUTES
];

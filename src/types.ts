export type DayWaybillStatus = "CONFIRMED" | "LIVE" | "WAITING_GPS" | "ODO_REQUIRED" | "DATA_ERROR" | "FUTURE_LOCKED" | "SCHEDULED" | "REST_DAY";

export interface WeeklyDaySetting {
  dayOfWeek: number; // 0=Ням, 1=Даваа, 2=Мягмар, 3=Лхагва, 4=Пүрэв, 5=Баасан, 6=Бямба
  dayName: string;
  isWork: boolean;
  task: string;
}

export interface WorkScheduleHistoryEntry {
  effectiveDate: string; // YYYY-MM-DD
  workDaysMode: "mon_sat" | "mon_fri" | "all_days" | "custom";
  defaultTask: string;
  restDayTask: string;
  weeklyDaysConfig?: Record<number, WeeklyDaySetting>;
  customRestDays?: number[];
  customHolidays?: string[];
  updatedAt: string;
}

export interface WorkScheduleConfig {
  effectiveDate?: string; // YYYY-MM-DD - Date this config starts applying (preserves past history)
  workDaysMode: "mon_sat" | "mon_fri" | "all_days" | "custom";
  defaultTask: string;
  restDayTask: string;
  weeklyDaysConfig?: Record<number, WeeklyDaySetting>;
  customRestDays?: number[]; // [0] = Sunday
  customHolidays?: string[]; // YYYY-MM-DD
  applyToAllDrivers: boolean;
  updatedAt: string;
  history?: WorkScheduleHistoryEntry[];
}

export interface DailyGPSMileage {
  vehicleNumber: string;
  driverId?: string;
  date: string; // YYYY-MM-DD
  totalKm: number;
  source: "gpsbox_api" | "manual";
  fetchedAt: string;
  apiStatus: "success" | "error" | "no_data";
  startOdo?: number;
  endOdo?: number;
  note?: string;
}

export interface FuelRefill {
  id: string;
  vehicleNumber: string;
  driverId?: string;
  dateTime: string;
  liters: number;
  station?: string;
  cost?: number;
  source: "fuel_api" | "manual";
  transactionId?: string;
  fuelReceiptNo?: string;
}

export interface DriverAutoOdoConfig {
  enabled: boolean;
  monthStartOdo?: number;
  dailyKmSource?: "gpsbox_api" | "manual";
  workDays?: "mon_sat" | "mon_fri" | "all_days";
  dayOverrides?: Record<number, number>;
  [key: string]: any;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  phone: string;
  vehicle: string;
  model: string;
  salesRep: string;
  defaultRoute?: string;
  status: "active" | "inactive";
  isCustom?: boolean;
  avatar?: string;
  apiOdo?: number;
  apiFuel?: string;
  apiFuelNum?: number;
  apiFuelPercent?: number;
  apiTemp?: string;
  apiTempNum?: number;
  apiSpeed?: number;
  telemetry?: Telemetry;
  autoOdoConfig?: DriverAutoOdoConfig;
  autoWaybillEnabled?: boolean; // True: GPS API-аар автоматаар замын хуудас бүртгэнэ, False: Жолооч өөрөө өдөр бүр бүртгэнэ
  isIMD?: boolean;
  jobTitle?: string; // "ТҮГЭЭГЧ"
  organization?: string; // Байгууллагын нэр (жишээ: "Айсмарк Дистрибьюшн ХХК", "АЙСМАРК ТРЕЙД ХХК", "АЙСМАРК ХХК")
  totalAssignedKm?: number;
  boxCapacity?: number; // Зайрмаг ачих багтаамж (хайрцаг: 700, 1000, 1500 г.м)
  kmPrivacyPin?: string; // IMD түгээгчийн хувийн км хамгаалах нууц код
  hasKmPin?: boolean; // Км нуух нууц код тохируулсан эсэх
}

export interface Telemetry {
  odo: number;
  fuel: string;
  fuelNum?: number;
  fuelPercent?: number;
  fuelSource?: string;
  temp: string;
  tempNum?: number;
  tempSource?: string;
  speed: number;
  lat?: number;
  lng?: number;
  status: "active" | "idle" | "moving" | "offline";
  lastUpdate: string;
  dtTracker?: string;
  imei?: string;
  voltage?: string;
  gsmSignal?: string;
  batteryLevel?: string;
}

export interface TripLog {
  id: string;
  timestamp: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  salesRep: string;
  zone: string;
  startOdo: number;
  endOdo?: number | null;
  totalKm?: number;
  fuelLiters?: number;
  fuelStation?: string;
  fuelCost?: number;
  fuelPaymentMethod?: string;
  fuelReceiptNo?: string;
  status: "🟡 ЭХЭЛСЭН" | "✅ ХЭВИЙН" | "⚠️ ДУТУУ";
  phase: "started" | "complete";
  routeNote?: string;
  source?: "manual" | "gpsbox_api" | "system";
  isManual?: boolean;
  manualEditedAt?: string;
}

export interface AppDataResponse {
  drivers: Driver[];
  tripStatus: Record<string, { phase: "started" | "complete"; startOdo: number; endOdo?: number | null; totalKm?: number; tripId: string }>;
  submittedIds: string[];
  targetDate: string;
  gpsboxConfig: GPSBoxConfig;
  assignments?: IMDAssignment[];
  routes?: IMDRoute[];
  stats: {
    totalDrivers: number;
    activeDrivers: number;
    todayStartedTrips: number;
    todayCompletedTrips: number;
  };
}

export interface GPSBoxConfig {
  url: string;
  username: string;
  apiKey: string;
  lastSync?: string;
  syncStatus: "connected" | "error" | "mock_active";
  errorMessage?: string;
  autoFillEnabled?: boolean;
}

export interface IMTDepotGeofenceConfig {
  applied: boolean;
  name: string;
  coordinateStr: string; // 47°54'07.2"N 106°51'02.7"E
  lat: number;           // 47.902000
  lng: number;           // 106.850750
  radiusMeters: number;  // 500
  timeWindow: string;    // 06:00 - 23:59
  ruleDescription: string;
}

export interface VehicleSheetData {
  organization: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  model: string;
  yearMonth: string;
  monthTotalKm: number;
  monthTotalFuel: number;
  monthStartOdo?: number | string;
  monthEndOdo?: number | string;
  monthGpsTotalKm?: number;
  odoDiff?: number;
  fuelAvgLitersPer100Km?: number | string;
  isIMT?: boolean;
  isIMD?: boolean;
  driverRole?: string;
  waybillType?: "PROVINCE_DISTRIBUTION" | "CITY_SALES";
  autoFillEnabled?: boolean;
  imtDepotGeofence?: IMTDepotGeofenceConfig;
  days: {
    day: number;
    date: string;
    zone: string;
    task: string;
    startOdo: number | string;
    endOdo: number | string;
    totalKm: number | string;
    fuelLiters: number | string;
    salesRep: string;
    driverSignature: string;
    verifierSignature: string;
    status?: DayWaybillStatus;
    source?: "gpsbox_api" | "manual" | "trip_log";
    gpsDailyKm?: number | string;
    gpsTotalKm?: number | string;
    diffWarning?: string;
    depotRuleApplied?: boolean;
    depotDistanceMeters?: number;
  }[];
}

export interface FineRecord {
  plate: string;
  displayPlate: string;
  no: string;
  date: string;
  amount: number;
  location: string;
  violation: string;
  isPaid?: boolean;
  status?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface VehicleFineResult {
  plate: string;
  displayPlate: string;
  count: number;
  amount: number;
  unpaidCount?: number;
  unpaidAmount?: number;
  paidCount?: number;
  paidAmount?: number;
  totalCount?: number;
  totalAmount?: number;
  status: "ТӨЛӨӨГҮЙ" | "ЦЭВЭР" | "АЛДАА";
  rows: FineRecord[];
  error?: string;
  checkedAt: string;
}

export interface BulkFinesResult {
  generatedAt: string;
  totalCars: number;
  fineCars: number;
  cleanCars: number;
  errorCars: number;
  totalFineCount: number;
  totalAmount: number;
  totalHistoryCount?: number;
  totalHistoryAmount?: number;
  rows: {
    plate: string;
    displayPlate: string;
    count: number | string;
    total: number | string;
    unpaidCount?: number;
    unpaidAmount?: number;
    paidCount?: number;
    paidAmount?: number;
    totalCount?: number;
    totalAmount?: number;
    status: string;
    checkedAt?: string;
    error?: string;
  }[];
  fines: FineRecord[];
  error?: string;
}

// ================= IMD LOGISTICS MASTER DATA TYPES =================

export type IMDOrderStatus = "Шинэ" | "Хүлээгдэж буй" | "Томилолт хуваарилагдсан" | "Тээвэрт гарсан" | "Дууссан" | "Цуцлагдсан";
export type IMDAssignmentStatus = "Төлөвлөсөн" | "Тээвэрт гарсан" | "Дууссан" | "Цуцлагдсан";
export type IMDOfficialLetterStatus = "NOT_CREATED" | "PROCESSING" | "DONE" | "FAILED";

export interface IMDOfficialLetter {
  id: string;
  dugaar: string; // e.g. "I-26-2215"
  ognoo: string; // YYYY.MM.DD
  chiglel: string;
  mashin: string;
  tug1: string;
  tug2?: string;
  niit_mungu: string;
  orderId?: string;
  orderNo?: string;
  assignmentId?: string;
  status: IMDOfficialLetterStatus;
  fileId?: string;
  fileName: string;
  fileUrl?: string;
  downloadUrl?: string;
  sheetRowIndex?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMDOrder {
  id: string;
  orderNo: string;
  customer: string;
  customerOrg?: string;
  receivedDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  province: string;
  destination: string;
  quantity: number; // хайрцаг
  unitPrice?: number;
  note?: string;
  status: IMDOrderStatus;
  shareToken: string;
  assignmentId?: string;
  primaryDriverId?: string;
  primaryDriverName?: string;
  vehiclePlate?: string;
  substituteDriverId?: string;
  substituteDriverName?: string;
  roundTripKm?: number;
  mealCount?: number;
  mealAllowance?: number;
  albanBichigStatus?: IMDOfficialLetterStatus;
  albanBichigDugaar?: string;
  albanBichigId?: string;
  albanBichigPdfUrl?: string;
  albanBichigDriveFileId?: string;
  albanBichigFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMDAssignment {
  id: string;
  orderId: string;
  orderNo: string;
  province: string;
  destination: string;
  vehicleId: string;
  vehiclePlate: string;
  primaryDriverId: string;
  primaryDriverName: string;
  primaryDriverPhone?: string;
  substituteDriverId?: string;
  substituteDriverName?: string;
  substituteDriverPhone?: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;
  quantity: number;
  vehicleCapacity?: number; // Машины багтаамж (хайрцаг)
  note?: string;
  status: IMDAssignmentStatus;
  token: string;
  startOdo?: number;
  endOdo?: number;
  actualKm?: number;
  roundTripKm?: number;
  mealCount?: number;
  mealAllowance?: number;
  mealPerPerson?: number;
  driverCount?: number;
  fuelLiters?: number;
  fuelStation?: string;
  waybillId?: string;
  albanBichigStatus?: IMDOfficialLetterStatus;
  albanBichigDugaar?: string;
  albanBichigId?: string;
  albanBichigPdfUrl?: string;
  albanBichigDriveFileId?: string;
  albanBichigFileName?: string;
  isRegistered?: boolean;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IMDRoute {
  id: string;
  code?: string;
  province: string;
  destination: string;
  roundTripKm: number;
  roadPost?: string;
  roadPosts?: number | string;
  mealFrequency?: string;
  mealCount?: number;
  meals?: number | string;
  notes?: string;
  tripCount?: number;
  totalTrips?: number;
  totalBoxes?: number;
  totalBoxesDelivered?: number;
}

export interface IMDAuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  oldValue?: any;
  newValue?: any;
}

export interface IMDTraveledProvinceItem {
  province: string;
  destination: string;
  roundTripKm: number;
  tripCount: number;
  totalKm: number;
  totalBoxes: number;
  mealCount?: number;
  drivers: string[];
  vehicles: string[];
  lastDispatchedDate?: string;
  hasActiveTrip?: boolean;
}

export interface IMDTraveledSummary {
  totalKm: number;
  totalProvinces: number;
  totalTrips: number;
  totalBoxes: number;
  list: IMDTraveledProvinceItem[];
}

export interface IMDDashboardData {
  todayDate: string;
  stats: {
    todayOrders: number;
    todayAssignments: number;
    todayBoxes: number;
    unassignedOrders: number;
    dispatchedVehicles: number;
    dispatchedDrivers: number;
    substituteDriversCount: number;
    pendingProvinces: number;
    totalTraveledKm?: number;
    totalTraveledProvincesCount?: number;
    totalTripsCount?: number;
  };
  traveledProvincesSummary?: IMDTraveledSummary;
  todayDispatches: {
    id: string;
    orderNo: string;
    province: string;
    destination?: string;
    vehiclePlate: string;
    primaryDriverName: string;
    substituteDriverName?: string;
    quantity: number;
    departureDate: string;
    status: string;
    actualKm?: number;
    token: string;
  }[];
  recentOrders: IMDOrder[];
}

export interface IMDMonthlyDriverKM {
  driverId: string;
  driverName: string;
  driverCode: string;
  vehicle: string;
  vehiclePlate?: string;
  primaryTripsCount: number;
  subTripsCount: number;
  tripsCount?: number;
  totalTripsCount: number;
  months: Record<number, number>; // 1..12 -> km (verified only)
  totalKm: number; // sum of recorded verified months
  recordedMonthsCount: number;
  isIMD?: boolean;
}

export interface IMDExcelImportResult {
  success: boolean;
  message: string;
  totalRows: number;
  successCount: number;
  newCount: number;
  updatedCount: number;
  errorCount: number;
  errors?: string[];
  importedOrders?: number;
  importedAssignments?: IMDAssignment[];
}

export interface IMDProvinceTripItem {
  id: string;
  orderNo: string;
  customer: string;
  province: string;
  destination: string;
  quantity: number;
  date: string;
  status: string;
  driverName: string;
  vehiclePlate: string;
}

export interface IMDProvinceStat {
  province: string;
  tripCount: number;
  totalBoxes: number;
  drivers: string[];
  vehicles: string[];
  destinations: string[];
  trips: IMDProvinceTripItem[];
}

export interface IMDProvinceReportData {
  year: number;
  month: number | "all";
  summary: {
    totalTrips: number;
    totalBoxes: number;
    totalProvinces: number;
    totalDrivers: number;
    totalVehicles: number;
  };
  provinces: IMDProvinceStat[];
}

export interface IMDClientShipmentItem {
  id: string;
  orderNo: string;
  customer: string;
  customerOrg?: string;
  province: string;
  destination: string;
  quantity: number;
  deliveryDate: string;
  departureDate: string;
  status: string;
  vehiclePlate: string;
  primaryDriverName: string;
  primaryDriverPhone?: string;
  substituteDriverName?: string;
  startOdo?: number;
  endOdo?: number;
  actualKm?: number;
  albanBichigDugaar?: string;
  albanBichigPdfUrl?: string;
  note?: string;
  shareToken?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  temp?: string;
  fuel?: string;
  dtTracker?: string;
  isLive?: boolean;
}

export interface IMDProvinceDeliverySummary {
  province: string;
  deliveryCount: number; // Хэдэн удаа хүргэлт/ачаа авсан
  totalBoxes: number; // Нийт хүргэгдсэн хайрцаг зайрмаг
  drivers: string[]; // Хэн хэн гэдэг түгээгч хүргэсэн
  vehicles: string[]; // Машины дугаарууд
  deliveryDates: string[]; // Хүргэсэн өдрүүд
  lastDeliveryDate?: string; // Сүүлд хүргэгдсэн огноо
  unassignedCount?: number; // Хуваарилалт хүлээгдэж буй захиалгын тоо
}

export interface IMDUnassignedOrderItem {
  id: string;
  orderNo: string;
  customer: string;
  province: string;
  destination?: string;
  quantity: number;
  deliveryDate?: string;
  createdAt?: string;
  status: string;
}

export interface IMDCityFleetItem {
  id: string;
  code: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  model: string;
  salesRep: string;
  zone: string;
  defaultRoute: string;
  boxCapacity: number;
  currentOdo?: number;
  todayKm?: number;
  status: string;
  lat?: number;
  lng?: number;
  speed?: number;
  temp?: string;
  tempNum?: number | null;
  fuel?: string;
  fuelPercent?: number | null;
  dtTracker?: string | null;
  isLive?: boolean;
  isIMD?: boolean;
  activeAssignment?: {
    id: string;
    orderNo: string;
    province?: string;
    destination?: string;
    status: string;
    departureDate?: string;
  } | null;
}

export interface IMDClientPortalData {
  title: string;
  summary: {
    totalDeliveries: number;
    inTransit: number;
    completed: number;
    scheduled: number;
    totalBoxes: number;
    totalProvinces: number;
    unassignedOrdersCount: number;
    cityFleetCount?: number;
    imdFleetCount?: number;
  };
  provinceSummaries: IMDProvinceDeliverySummary[];
  unassignedOrders: IMDUnassignedOrderItem[];
  shipments: IMDClientShipmentItem[];
  assignments?: IMDClientShipmentItem[];
  cityFleet?: IMDCityFleetItem[];
  imdFleet?: IMDCityFleetItem[];
}

export interface IMDDriverProvinceTripDetail {
  id: string;
  date: string;
  province: string;
  destination: string;
  km: number;
  vehicle: string;
  role: string;
  isPrimary?: boolean;
  isSubstitute?: boolean;
  driverCount?: number;
  substituteDriverName?: string;
  primaryDriverName?: string;
  mealCount?: number;
  totalTripMealMoney?: number;
  driverReceivedMealAllowance?: number;
  status: string;
  isAssignment: boolean;
}

export interface IMDDriverMonthlyProvinceStats {
  driverId: string;
  driverCode: string;
  driverName: string;
  vehiclePlate: string;
  month: string;
  monthNum: number;
  monthName: string;
  year: number;
  totalKm: number;
  totalTripsCount: number;
  totalMonthlyMealAllowance: number;
  mealTripsCount: number;
  ratePerMeal?: number;
  provincesCount: number;
  provincesList: string[];
  provincesSummaryStr: string;
  trips: IMDDriverProvinceTripDetail[];
}

export interface DailyDriverAssignment {
  id: string;
  businessDate: string; // YYYY-MM-DD
  vehiclePlate: string;
  vehicleDivision: "IMT" | "IMD";
  routeId: string;
  routeName: string;
  originalDriverId: string;
  originalDriverName: string;
  originalDriverCode: string;
  actualDriverId: string;
  actualDriverName: string;
  actualDriverCode: string;
  driverChanged: boolean;
  fineCreated?: boolean;
  fineAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverChangeFineRecord {
  id: string;
  assignmentId: string;
  businessDate: string; // YYYY-MM-DD
  vehiclePlate: string;
  vehicleDivision: "IMT" | "IMD";
  routeId: string;
  routeName: string;
  originalDriverId: string;
  originalDriverName: string;
  originalDriverCode: string;
  actualDriverId: string;
  actualDriverName: string;
  actualDriverCode: string;
  fineReason: string;
  fineAmount: number;
  driverDeduction: number;
  organization: string;
  feeAmount: number;
  status: "active" | "deducted" | "cancelled";
  notes?: string;
  createdAt: string;
}

export interface MonthlyFineMatrixRow {
  code: string;
  driverName: string;
  vehicle: string;
  phone: string;
  division: "IMT" | "IMD";
  days: Record<number, number>; // 1..31 -> amount
  totalAmount: number;
}

export interface DriverSignatureReportRow {
  index: number;
  jobTitle: string;
  vehiclePlate: string;
  driverName: string;
  fineAmount: number;
  driverDeduction: number;
  organization: string;
  feeAmount: number;
  date: string;
  explanation: string;
  signature?: string;
}

export interface InternalFineReportResponse {
  records: DriverChangeFineRecord[];
  monthlyMatrix: MonthlyFineMatrixRow[];
  signatureReport: DriverSignatureReportRow[];
  summary: {
    totalFines: number;
    totalAmount: number;
    imtCount: number;
    imtAmount: number;
    imdCount: number;
    imdAmount: number;
  };
}



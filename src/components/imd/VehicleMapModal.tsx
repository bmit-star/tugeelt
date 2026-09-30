import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import { 
  X, 
  MapPin, 
  Truck, 
  Navigation, 
  Phone, 
  User, 
  Gauge, 
  Fuel, 
  Snowflake, 
  Clock, 
  ExternalLink,
  Layers,
  Search,
  Crosshair,
  Maximize2,
  Minimize2,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2
} from "lucide-react";
import { IMDCityFleetItem, IMDClientShipmentItem } from "../../types";

export interface VehicleLocationTarget {
  vehiclePlate: string;
  name?: string;
  phone?: string;
  model?: string;
  salesRep?: string;
  zone?: string;
  status?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  currentOdo?: number;
  temp?: string;
  fuel?: string;
  fuelPercent?: number | null;
  dtTracker?: string | null;
  isLive?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedVehicle?: VehicleLocationTarget | null;
  allCityFleet?: IMDCityFleetItem[];
  allImdFleet?: IMDCityFleetItem[];
  allShipments?: IMDClientShipmentItem[];
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
}

// Default central hub coordinates (Icemark Distribution Center, Ulaanbaatar)
const DEFAULT_CENTER: [number, number] = [47.9056, 106.9328];

const REGIONAL_PLATES_SET = new Set([
  "8374УНЕ", "3147УЕН", "3148УЕМ", "3148УЕО", "5909УКО", 
  "6530УКН", "8376УЕН", "8428УНД", "8531УББ", "9988УНБ", "3147УНЭ"
]);

export const VehicleMapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedVehicle,
  allCityFleet = [],
  allImdFleet = [],
  allShipments = [],
  onShowToast
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [activeVehicle, setActiveVehicle] = useState<VehicleLocationTarget | null>(selectedVehicle || null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [fleetFilter, setFleetFilter] = useState<"all" | "city" | "ka" | "regional">("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [mapLayer, setMapLayer] = useState<"standard" | "satellite">("standard");

  // Merge vehicles from imdFleet, cityFleet, and shipments into a unified lookup
  const vehicleList: VehicleLocationTarget[] = useMemo(() => {
    const list: VehicleLocationTarget[] = [];
    const seen = new Set<string>();

    // 1. Add IMD Regional heavy trucks first so they are prominent
    allImdFleet.forEach((m) => {
      const plate = (m.vehiclePlate || "").trim().toUpperCase();
      if (!plate || seen.has(plate)) return;
      seen.add(plate);

      list.push({
        vehiclePlate: m.vehiclePlate,
        name: m.name,
        phone: m.phone,
        model: m.model || "Hyundai HD65 (Хөлдөөгчтэй)",
        salesRep: m.salesRep || "Орон нутаг",
        zone: m.zone || m.defaultRoute || "Орон нутгийн чиглэл",
        status: m.status,
        lat: m.lat || DEFAULT_CENTER[0],
        lng: m.lng || DEFAULT_CENTER[1],
        speed: m.speed ?? 0,
        currentOdo: m.currentOdo,
        temp: m.temp,
        fuel: m.fuel,
        fuelPercent: m.fuelPercent,
        dtTracker: m.dtTracker,
        isLive: m.isLive
      });
    });

    // 2. Add city fleet
    allCityFleet.forEach((c) => {
      const plate = (c.vehiclePlate || "").trim().toUpperCase();
      if (!plate || seen.has(plate)) return;
      seen.add(plate);

      list.push({
        vehiclePlate: c.vehiclePlate,
        name: c.name,
        phone: c.phone,
        model: c.model,
        salesRep: c.salesRep,
        zone: c.zone || c.defaultRoute,
        status: c.status,
        lat: c.lat || DEFAULT_CENTER[0],
        lng: c.lng || DEFAULT_CENTER[1],
        speed: c.speed ?? 0,
        currentOdo: c.currentOdo,
        temp: c.temp,
        fuel: c.fuel,
        fuelPercent: c.fuelPercent,
        dtTracker: c.dtTracker,
        isLive: c.isLive
      });
    });

    // 3. Add active shipments
    allShipments.forEach((s) => {
      const plate = (s.vehiclePlate || "").trim().toUpperCase();
      if (!plate || plate === "-" || plate === "БАТЛАГДСАН" || seen.has(plate)) return;
      seen.add(plate);

      list.push({
        vehiclePlate: s.vehiclePlate,
        name: s.primaryDriverName,
        phone: s.primaryDriverPhone,
        model: "Орон нутгийн тээвэр",
        salesRep: s.province || "Орон нутаг",
        zone: s.destination || s.province,
        status: s.status,
        lat: s.lat || DEFAULT_CENTER[0],
        lng: s.lng || DEFAULT_CENTER[1],
        speed: s.speed ?? 0,
        currentOdo: s.endOdo || s.startOdo,
        temp: s.temp,
        fuel: s.fuel,
        dtTracker: s.dtTracker,
        isLive: s.isLive
      });
    });

    // If selected vehicle not found yet, prepend it
    if (selectedVehicle) {
      const selPlate = (selectedVehicle.vehiclePlate || "").trim().toUpperCase();
      if (selPlate && !seen.has(selPlate)) {
        list.unshift(selectedVehicle);
      }
    }

    return list;
  }, [allImdFleet, allCityFleet, allShipments, selectedVehicle]);

  // Filtered vehicles for sidebar list
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      const plate = v.vehiclePlate.toUpperCase().replace(/\s+/g, "");
      const name = (v.name || "").toLowerCase();
      const zone = (v.zone || "").toLowerCase();
      const query = searchTerm.toLowerCase().trim();

      if (query && !plate.includes(query.toUpperCase()) && !name.includes(query) && !zone.includes(query)) {
        return false;
      }

      const isKA = plate.startsWith("1096") || plate.startsWith("5201") || plate.startsWith("7841") || plate.startsWith("1076") || plate.startsWith("1081");
      const isRegional = REGIONAL_PLATES_SET.has(plate) || v.model?.includes("Орон нутаг") || (v.zone && !v.zone.includes("Улаанбаатар"));

      if (fleetFilter === "ka" && !isKA) return false;
      if (fleetFilter === "regional" && !isRegional) return false;
      if (fleetFilter === "city" && (isKA || isRegional)) return false;

      return true;
    });
  }, [vehicleList, searchTerm, fleetFilter]);

  // Update activeVehicle when selectedVehicle prop changes
  useEffect(() => {
    if (selectedVehicle) {
      setActiveVehicle(selectedVehicle);
    } else if (vehicleList.length > 0 && !activeVehicle) {
      setActiveVehicle(vehicleList[0]);
    }
  }, [selectedVehicle, vehicleList]);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Destroy prior map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Determine initial center
    const initialLat = activeVehicle?.lat && activeVehicle.lat !== 0 ? activeVehicle.lat : DEFAULT_CENTER[0];
    const initialLng = activeVehicle?.lng && activeVehicle.lng !== 0 ? activeVehicle.lng : DEFAULT_CENTER[1];

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Add Tile Layer
    const tileUrl = mapLayer === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    mapInstanceRef.current = map;
    markersRef.current = {};

    // Create markers for all vehicles in vehicleList
    vehicleList.forEach((veh) => {
      const lat = veh.lat && veh.lat !== 0 ? veh.lat : DEFAULT_CENTER[0];
      const lng = veh.lng && veh.lng !== 0 ? veh.lng : DEFAULT_CENTER[1];
      const isMoving = (veh.speed || 0) > 0;
      const isSelected = activeVehicle?.vehiclePlate === veh.vehiclePlate;
      const cleanPlate = (veh.vehiclePlate || "").toUpperCase().replace(/\s+/g, "");
      const isRegional = REGIONAL_PLATES_SET.has(cleanPlate) || veh.model?.includes("Орон нутаг");

      // Create Custom DivIcon with distinct styling for IMD regional vs city
      const badgeBg = isSelected 
        ? "bg-amber-500 text-slate-950 ring-4 ring-amber-400/50 scale-110" 
        : isRegional
          ? (isMoving ? "bg-[#0878bd] text-white ring-2 ring-sky-300 shadow-lg shadow-blue-950/40" : "bg-[#123047] text-white border-2 border-sky-400 shadow-md")
          : isMoving 
            ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30" 
            : "bg-slate-800 text-white shadow-md shadow-slate-900/30";

      const iconHtml = `
        <div class="cursor-pointer transition-all duration-300 transform hover:scale-115 flex flex-col items-center group">
          <div class="px-2 py-1 rounded-lg ${badgeBg} font-mono font-black text-[11px] whitespace-nowrap flex items-center gap-1 border border-white/40">
            <span class="w-2 h-2 rounded-full ${isMoving ? 'bg-emerald-300 animate-ping' : 'bg-slate-300'}"></span>
            ${isRegional ? '<span class="text-[9px] px-1 py-0.2 bg-amber-400 text-slate-950 rounded font-black">IMD</span>' : ''}
            <span>${veh.vehiclePlate}</span>
            ${veh.speed ? `<span class="text-[9px] font-black bg-white/20 px-1 rounded">${veh.speed}км/ц</span>` : ''}
          </div>
          <div class="w-2.5 h-2.5 ${isSelected ? 'bg-amber-500' : isRegional ? (isMoving ? 'bg-[#0878bd]' : 'bg-[#123047]') : isMoving ? 'bg-emerald-600' : 'bg-slate-800'} rotate-45 -mt-1 border-r border-b border-white/40"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-vehicle-marker",
        iconSize: [80, 32],
        iconAnchor: [40, 30],
        popupAnchor: [0, -28]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      // Popup Content
      const popupHtml = `
        <div class="p-1 font-sans text-xs text-slate-800" style="min-width: 200px;">
          <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
            <span class="font-mono font-black text-sm text-[#123047]">${veh.vehiclePlate}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isMoving ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">
              ${isMoving ? `${veh.speed} км/цаг` : 'Зогссон'}
            </span>
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-slate-600">
              <span class="font-bold text-slate-900">${veh.name || 'Жолооч'}</span>
              ${veh.phone ? `<span class="text-slate-400">(${veh.phone})</span>` : ''}
            </div>
            <div class="text-[11px] text-slate-500">${veh.zone || 'Бүс тодорхойгүй'}</div>
            ${veh.temp ? `<div class="text-[11px] font-bold text-sky-700">❄️ Хөлдөөгч: ${veh.temp}</div>` : ''}
            ${veh.fuel ? `<div class="text-[11px] font-bold text-amber-700">⛽ Түлш: ${veh.fuel}</div>` : ''}
            ${veh.currentOdo ? `<div class="text-[10px] text-slate-400">Одометр: ${veh.currentOdo.toLocaleString()} км</div>` : ''}
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on("click", () => {
        setActiveVehicle(veh);
      });

      markersRef.current[veh.vehiclePlate] = marker;
    });

    // Cleanup on unmount or re-render
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, vehicleList, mapLayer]);

  // Smooth pan to activeVehicle when changed
  useEffect(() => {
    if (!mapInstanceRef.current || !activeVehicle) return;

    const lat = activeVehicle.lat && activeVehicle.lat !== 0 ? activeVehicle.lat : DEFAULT_CENTER[0];
    const lng = activeVehicle.lng && activeVehicle.lng !== 0 ? activeVehicle.lng : DEFAULT_CENTER[1];

    mapInstanceRef.current.flyTo([lat, lng], 15, {
      duration: 1.2
    });

    const marker = markersRef.current[activeVehicle.vehiclePlate];
    if (marker) {
      marker.openPopup();
    }
  }, [activeVehicle]);

  // Fit all markers in view
  const handleFitAll = () => {
    if (!mapInstanceRef.current || vehicleList.length === 0) return;
    const latLngs = vehicleList
      .filter((v) => v.lat && v.lng && v.lat !== 0 && v.lng !== 0)
      .map((v) => [v.lat!, v.lng!] as [number, number]);

    if (latLngs.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(latLngs), {
        padding: [50, 50],
        maxZoom: 16
      });
    }
  };

  // Open in Google Maps
  const handleOpenGoogleMaps = (v: VehicleLocationTarget) => {
    const lat = v.lat || DEFAULT_CENTER[0];
    const lng = v.lng || DEFAULT_CENTER[1];
    const url = `https://www.google.com/maps?q=${lat},${lng}(${encodeURIComponent(v.vehiclePlate + ' - ' + (v.name || ''))})`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all animate-fadeIn">
      <div 
        className={`bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-300 ${
          isFullscreen 
            ? "w-full h-full rounded-none" 
            : "w-full max-w-6xl h-[90vh] max-h-[850px]"
        }`}
      >
        {/* Modal Header */}
        <div className="bg-[#123047] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 border-b border-[#1b4363]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-400 shrink-0">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Машины GPS Шууд Байршил
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-[10px] uppercase">
                  Live GPSBox
                </span>
              </div>
              <p className="text-[11px] text-sky-200/70 hidden sm:block">
                Борлуулалтын түгээлтийн автомашинуудын бодит цагийн байршил, одометр болон хурд
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setMapLayer(mapLayer === "standard" ? "satellite" : "standard")}
              className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                mapLayer === "satellite"
                  ? "bg-amber-500 text-slate-950 border-amber-400"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/15"
              }`}
              title="Газрын зургийн горим солих"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">{mapLayer === "satellite" ? "Хиймэл дагуул" : "Энгийн"}</span>
            </button>

            <button
              onClick={handleFitAll}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Бүх машиныг дэлгэцэнд багтаах"
            >
              <Crosshair className="w-4 h-4 text-sky-300" />
              <span className="hidden md:inline">Бүх машин</span>
            </button>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isSidebarOpen
                  ? "bg-sky-500/20 text-sky-300 border-sky-400/30"
                  : "bg-white/10 text-white border-white/15"
              }`}
              title="Жагсаалт хаах/нээх"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden md:inline">Жагсаалт</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
              title={isFullscreen ? "Хэвийн хэмжээ" : "Дэлгэц дүүргэх"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-400/30 transition-all cursor-pointer"
              title="Хаах"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Left Sidebar: Vehicle List & Search */}
          {isSidebarOpen && (
            <div className="w-72 sm:w-80 bg-slate-50 border-r border-slate-200 flex flex-col z-10 shrink-0">
              
              {/* Search & Filter Bar */}
              <div className="p-3 border-b border-slate-200 bg-white space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Машин, жолооч, бүс хайх..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0878bd] focus:bg-white transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Fleet Category Filter */}
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-xl text-[10px] font-black">
                  <button
                    onClick={() => setFleetFilter("all")}
                    className={`py-1 rounded-lg transition-all ${
                      fleetFilter === "all" ? "bg-white text-[#123047] shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Бүгд ({vehicleList.length})
                  </button>
                  <button
                    onClick={() => setFleetFilter("city")}
                    className={`py-1 rounded-lg transition-all ${
                      fleetFilter === "city" ? "bg-white text-[#123047] shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    M-Түгээлт
                  </button>
                  <button
                    onClick={() => setFleetFilter("ka")}
                    className={`py-1 rounded-lg transition-all ${
                      fleetFilter === "ka" ? "bg-white text-[#123047] shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    KA Сүлжээ
                  </button>
                  <button
                    onClick={() => setFleetFilter("regional")}
                    className={`py-1 rounded-lg transition-all ${
                      fleetFilter === "regional" ? "bg-white text-[#123047] shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Орон нутаг
                  </button>
                </div>
              </div>

              {/* Scrollable Vehicle Items */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {filteredVehicles.map((veh) => {
                  const isSelected = activeVehicle?.vehiclePlate === veh.vehiclePlate;
                  const isMoving = (veh.speed || 0) > 0;
                  const cleanPlate = (veh.vehiclePlate || "").toUpperCase().replace(/\s+/g, "");
                  const isRegional = REGIONAL_PLATES_SET.has(cleanPlate) || veh.model?.includes("Орон нутаг");

                  return (
                    <div
                      key={veh.vehiclePlate}
                      onClick={() => setActiveVehicle(veh)}
                      className={`p-2.5 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-sky-50 border-[#0878bd] shadow-sm ring-1 ring-[#0878bd]"
                          : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                            {veh.vehiclePlate}
                          </span>
                          {isRegional && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              IMD
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                              isMoving
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`}></span>
                            <span>{isMoving ? `${veh.speed} км/ц` : "Зогссон"}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 truncate max-w-[130px]">{veh.name || "Жолооч"}</span>
                        <span className="text-slate-500 text-[10px] truncate max-w-[100px]">{veh.zone || (isRegional ? "Орон нутаг" : "Улаанбаатар")}</span>
                      </div>

                      {/* Small telemetry badge */}
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 border-t border-slate-100 pt-1">
                        {veh.temp && <span className="text-sky-600 font-bold">❄️ {veh.temp}</span>}
                        {veh.fuel && <span className="text-amber-600 font-bold">⛽ {veh.fuel}</span>}
                        {veh.currentOdo && <span className="ml-auto font-mono text-slate-600 font-bold">{veh.currentOdo.toLocaleString()} км</span>}
                      </div>
                    </div>
                  );
                })}

                {filteredVehicles.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Хайлтад тохирох машин олдсонгүй
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map Canvas Container */}
          <div className="flex-1 relative h-full w-full">
            <div ref={mapContainerRef} className="h-full w-full z-0" />

            {/* Active Selected Vehicle Floating Card (Bottom Overlay) */}
            {activeVehicle && (
              <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200/90 z-20 transition-all animate-slideUp">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base px-2.5 py-1 rounded-lg bg-[#123047] text-white tracking-wider">
                        {activeVehicle.vehiclePlate}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{activeVehicle.model}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{activeVehicle.name || "Жолооч"}</span>
                      {activeVehicle.phone && (
                        <a 
                          href={`tel:${activeVehicle.phone}`}
                          className="text-[#0878bd] hover:underline flex items-center gap-0.5 ml-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{activeVehicle.phone}</span>
                        </a>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium truncate">{activeVehicle.zone || "Улаанбаатар хот"}</span>
                      {activeVehicle.salesRep && (
                        <span className="text-[11px] text-slate-400">({activeVehicle.salesRep})</span>
                      )}
                    </div>
                  </div>

                  {/* Google Maps External Link */}
                  <button
                    onClick={() => handleOpenGoogleMaps(activeVehicle)}
                    className="p-2.5 rounded-xl bg-sky-50 hover:bg-[#0878bd] text-[#0878bd] hover:text-white border border-sky-200 transition-all flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                    title="Google Maps дээр нээх"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase">Google Map</span>
                  </button>
                </div>

                {/* Telemetry quick status bar */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 rounded-xl p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Хурд</span>
                    <span className="font-mono font-black text-slate-900">
                      {activeVehicle.speed || 0} км/ц
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Хөлдөөгч</span>
                    <span className="font-black text-sky-700">
                      {activeVehicle.temp || "--°C"}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-1.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Одоогийн Одо</span>
                    <span className="font-mono font-black text-slate-900">
                      {activeVehicle.currentOdo ? `${activeVehicle.currentOdo.toLocaleString()} км` : "--"}
                    </span>
                  </div>
                </div>

                {activeVehicle.dtTracker && (
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Сүүлийн холболт: {activeVehicle.dtTracker}</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      GPS Идэвхтэй
                    </span>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

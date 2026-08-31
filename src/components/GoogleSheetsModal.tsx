import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  ExternalLink,
  Upload,
  Download,
  Plus,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logoutGoogle, getAccessToken } from "../services/auth";
import { googleSheetsService, GoogleDriveFile } from "../services/googleSheets";
import { Driver, TripLog } from "../types";

interface GoogleSheetsModalProps {
  drivers: Driver[];
  trips: TripLog[];
  onClose: () => void;
  onRefreshData: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  drivers,
  trips,
  onClose,
  onRefreshData,
  onShowToast
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Sheets state
  const [userSheets, setUserSheets] = useState<GoogleDriveFile[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>("");
  const [customSheetUrl, setCustomSheetUrl] = useState<string>("");
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: "export_telematics" | "export_masterlog" | "create_sheet" | "import_drivers";
    sheetId?: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        fetchDriveSheets(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );

    // Also check cached token immediately
    getAccessToken().then((token) => {
      if (token) {
        setAccessToken(token);
        fetchDriveSheets(token);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const fetchDriveSheets = async (token: string) => {
    try {
      const files = await googleSheetsService.listUserSpreadsheets(token);
      setUserSheets(files);
      if (files.length > 0 && !selectedSheetId) {
        setSelectedSheetId(files[0].id);
      }
    } catch (err) {
      console.warn("Could not fetch user drive files automatically:", err);
    }
  };

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        onShowToast("Google хаягаар амжилттай нэвтэрлээ", "success");
        await fetchDriveSheets(res.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Google нэвтрэлт амжилтгүй боллоо", "error");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutGoogle();
    setCurrentUser(null);
    setAccessToken(null);
    setUserSheets([]);
    setSelectedSheetId("");
    onShowToast("Google хаягаас гарлаа", "info");
  };

  // Helper to extract sheet ID
  const getActiveSheetId = (): string => {
    if (customSheetUrl.trim()) {
      const match = customSheetUrl.match(/[-\w]{25,}/);
      return match ? match[0] : customSheetUrl.trim();
    }
    return selectedSheetId;
  };

  // 1. Create Brand New Spreadsheet
  const handleTriggerCreate = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Шинэ Google Sheet үүсгэх үү?",
      description: `Таны Google Drive дээр 'Fleet Digital - Паркийн нэгдсэн тайлан' нэртэй шинэ Spreadsheet үүсгэж, 30 машины телематик болон MasterLog замын хуудасны загварыг шууд бэлтгэнэ.`,
      actionType: "create_sheet"
    });
  };

  // 2. Export Telematics
  const handleTriggerExportTelematics = () => {
    const sheetId = getActiveSheetId();
    if (!sheetId) {
      onShowToast("Экспортлох Google Sheet-ээ сонгоно уу", "error");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Паркийн телематик өгөгдлийг бичих үү?",
      description: `Сонгосон Google Sheet рүү нийт ${drivers.length} автотээврийн хэрэгслийн шууд GPSBox ODO, түлш, хөргүүрийн хэм болон жолоочийн мэдээллийг шинэчлэн бичнэ.`,
      actionType: "export_telematics",
      sheetId
    });
  };

  // 3. Export MasterLog Waybills
  const handleTriggerExportMasterlog = () => {
    const sheetId = getActiveSheetId();
    if (!sheetId) {
      onShowToast("Экспортлох Google Sheet-ээ сонгоно уу", "error");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "MasterLog замын хуудсыг экспортлох уу?",
      description: `Сонгосон Google Sheet-ийн 'MasterLog Замын хуудас' хуудас руу нийт ${trips.length} замын хуудасны мэдээлэл болон API ODO тулгалтын зөрүүг бичнэ.`,
      actionType: "export_masterlog",
      sheetId
    });
  };

  // 4. Import Drivers from Sheet
  const handleTriggerImportDrivers = () => {
    const sheetId = getActiveSheetId();
    if (!sheetId) {
      onShowToast("Импортлох Google Sheet-ээ сонгоно уу", "error");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Google Sheet-ээс Жолооч & Машины мэдээлэл татах уу?",
      description: `Сонгосон Google Sheet-ийн өгөгдлийг уншиж системийн жолооч, автомашины жагсаалт руу нэгтгэнэ.`,
      actionType: "import_drivers",
      sheetId
    });
  };

  // Confirm and Execute Operation
  const handleExecuteConfirmedAction = async () => {
    if (!confirmDialog || !accessToken) return;
    setLoading(true);

    try {
      if (confirmDialog.actionType === "create_sheet") {
        const result = await googleSheetsService.createFleetSpreadsheet(accessToken);
        setLastCreatedUrl(result.spreadsheetUrl);
        setSelectedSheetId(result.spreadsheetId);
        // Automatically populate initial data
        await googleSheetsService.exportFleetTelematics(result.spreadsheetId, accessToken, drivers);
        await googleSheetsService.exportMasterLog(result.spreadsheetId, accessToken, trips, drivers);
        await fetchDriveSheets(accessToken);
        onShowToast("Google Sheet амжилттай үүсэж өгөгдөл хуулагдлаа!", "success");
      } else if (confirmDialog.actionType === "export_telematics" && confirmDialog.sheetId) {
        await googleSheetsService.exportFleetTelematics(confirmDialog.sheetId, accessToken, drivers);
        onShowToast("Паркийн телематик амжилттай Google Sheet рүү шинэчлэгдлээ!", "success");
      } else if (confirmDialog.actionType === "export_masterlog" && confirmDialog.sheetId) {
        await googleSheetsService.exportMasterLog(confirmDialog.sheetId, accessToken, trips, drivers);
        onShowToast("MasterLog замын хуудас Google Sheet рүү амжилттай хуулагдлаа!", "success");
      } else if (confirmDialog.actionType === "import_drivers" && confirmDialog.sheetId) {
        const imported = await googleSheetsService.importDriversFromSheet(confirmDialog.sheetId, accessToken);
        if (imported.length === 0) {
          onShowToast("Хүснэгтээс жолоочийн мэдээлэл олдсонгүй", "info");
        } else {
          onShowToast(`Google Sheet-ээс ${imported.length} жолоочийн мэдээлэл амжилттай уншигдлаа`, "success");
          onRefreshData();
        }
      }
    } catch (err: any) {
      console.error(err);
      onShowToast(err.message || "Google Sheets үйлдэл гүйцэтгэхэд алдаа гарлаа", "error");
    } finally {
      setLoading(false);
      setConfirmDialog(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#0F2942] to-[#1a446c] text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Google Sheets Интеграци & Синхрончлол</h2>
              <p className="text-xs text-sky-200/80">
                Паркийн GPSBox телематик болон замын хуудсыг Google Sheets рүү бодит цагт холбох
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Auth State Card */}
          {!currentUser ? (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-50 to-slate-50 border border-sky-100 text-center space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 mx-auto flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>

              <div>
                <h3 className="font-black text-slate-900 text-base">Google Sheets-тэй холбогдох</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Өөрийн Google хаягаар нэвтэрснээр Google Drive болон Spreadsheets дээрх өгөгдлийг шууд удирдах боломжтой болно.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{signingIn ? "Нэвтэрч байна..." : "Google хаягаар нэвтрэх"}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-emerald-300" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center">
                    {currentUser.displayName?.[0] || "U"}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <span>{currentUser.displayName || "Google Хэрэглэгч"}</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{currentUser.email}</div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Гарах</span>
              </button>
            </div>
          )}

          {/* Quick Create New Spreadsheet Option */}
          {currentUser && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#0878bd]" />
                    <h3 className="font-black text-slate-900 text-sm">Шинэ Google Sheet тайлан үүсгэх</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Паркийн телематик болон MasterLog замын хуудсанд зориулсан загвар бүхий шинэ хүснэгт автоматаар үүсгэнэ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerCreate}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#066199] text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Шинэ Sheet үүсгэх</span>
                </button>
              </div>

              {lastCreatedUrl && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Шинэ Google Sheet бэлэн боллоо:</span>
                  </div>
                  <a
                    href={lastCreatedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#0878bd] hover:underline flex items-center gap-1"
                  >
                    <span>Хүснэгт нээх</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Sheet Selection Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-slate-500" />
                  <span>Холбох Google Sheet сонгох</span>
                </h4>

                {userSheets.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Таны Google Drive-н хүснэгтүүд:
                    </label>
                    <select
                      value={selectedSheetId}
                      onChange={(e) => setSelectedSheetId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0878bd]"
                    >
                      {userSheets.map((file) => (
                        <option key={file.id} value={file.id}>
                          📊 {file.name} ({file.modifiedTime?.split("T")[0] || ""})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Эсвэл Sheet ID / Холбоос (URL) оруулах:
                  </label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR..."
                    value={customSheetUrl}
                    onChange={(e) => setCustomSheetUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0878bd]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerExportTelematics}
                  disabled={loading}
                  className="p-3 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200/90 hover:border-[#0878bd] text-left transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="p-2 rounded-xl bg-sky-100 text-[#0878bd] group-hover:scale-110 transition-transform">
                      <Download className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">{drivers.length} Машин</span>
                  </div>
                  <div>
                    <div className="font-black text-xs text-slate-900">Парк Телематик бичих</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">GPSBox ODO, түлш, хөргүүр экспортлох</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerExportMasterlog}
                  disabled={loading}
                  className="p-3 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200/90 hover:border-emerald-500 text-left transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">{trips.length} Хуудас</span>
                  </div>
                  <div>
                    <div className="font-black text-xs text-slate-900">MasterLog хуулах</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Замын хуудас & ODO зөрүү экспортлох</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerImportDrivers}
                  disabled={loading}
                  className="p-3 rounded-2xl bg-white hover:bg-amber-50 border border-slate-200/90 hover:border-amber-500 text-left transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="p-2 rounded-xl bg-amber-100 text-amber-700 group-hover:scale-110 transition-transform">
                      <Upload className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">Шууд татах</span>
                  </div>
                  <div>
                    <div className="font-black text-xs text-slate-900">Sheet-ээс Жолооч татах</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Жолооч, машин, ХТ импортлох</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Google Drive & Spreadsheets v4 API идэвхтэй</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">{confirmDialog.title}</h3>
                <span className="text-[11px] font-bold text-amber-700">Баталгаажуулалт шаардлагатай</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.description}</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#0878bd] hover:bg-[#066199] text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Зөвшөөрөх & Гүйцэтгэх</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

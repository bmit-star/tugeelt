import { Driver, TripLog } from "../types";

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export const googleSheetsService = {
  // List user's Google Sheets from Google Drive
  async listUserSpreadsheets(token: string): Promise<GoogleDriveFile[]> {
    try {
      const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,webViewLink,modifiedTime)`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        throw new Error(`Google Drive API алдаа: ${res.statusText}`);
      }
      const data = await res.json();
      return data.files || [];
    } catch (err: any) {
      console.error("Failed to list sheets:", err);
      throw err;
    }
  },

  // Create a brand new formatted Google Sheet
  async createFleetSpreadsheet(token: string, title: string = `Fleet Digital - Паркийн нэгдсэн тайлан (${new Date().toISOString().split("T")[0]})`): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            title
          },
          sheets: [
            {
              properties: {
                title: "Парк Телематик (GPSBox)",
                gridProperties: { rowCount: 100, columnCount: 12 }
              }
            },
            {
              properties: {
                title: "MasterLog Замын хуудас",
                gridProperties: { rowCount: 200, columnCount: 14 }
              }
            }
          ]
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Google Sheets API үүсгэхэд алдаа гарлаа: ${res.statusText}`);
      }

      const data = await res.json();
      return {
        spreadsheetId: data.spreadsheetId,
        spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
      };
    } catch (err: any) {
      console.error("Create spreadsheet error:", err);
      throw err;
    }
  },

  // Export current live fleet telematics to the sheet
  async exportFleetTelematics(
    spreadsheetId: string,
    token: string,
    drivers: Driver[],
    sheetName: string = "Парк Телематик (GPSBox)"
  ): Promise<void> {
    const timestamp = new Date().toLocaleString("mn-MN");

    const headerRows = [
      [`🚀 FLEET DIGITAL • ТЭЭВРИЙН ХЭРЭГСЛИЙН ТЕЛЕМАТИК (Шинэчилсэн: ${timestamp})`],
      [],
      [
        "Код",
        "Жолоочийн нэр",
        "Машины дугаар",
        "Марк",
        "Утас",
        "ХТ (Төлөөлөгч)",
        "Үндсэн чиглэл",
        "📡 GPSBox ODO (км)",
        "⛽ Түлш (литр)",
        "❄️ Хөргүүр (°C)",
        "Төлөв",
        "Сүүлийн холболт"
      ]
    ];

    const dataRows = drivers.map((d) => [
      d.code || d.id,
      d.name,
      d.vehicle,
      d.model,
      d.phone,
      d.salesRep,
      d.defaultRoute || "—",
      d.apiOdo || d.telemetry?.odo || 0,
      d.apiFuel || d.telemetry?.fuel || "0.0 л",
      d.apiTemp || d.telemetry?.temp || "0.0°C",
      d.telemetry?.status === "moving" ? "Хөдөлгөөнд" : "Идэвхтэй/Зогссон",
      d.telemetry?.lastUpdate || "—"
    ]);

    const allValues = [...headerRows, ...dataRows];

    // Clear and write
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A1:L${allValues.length + 5}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `'${sheetName}'!A1:L${allValues.length}`,
          majorDimension: "ROWS",
          values: allValues
        })
      }
    );
  },

  // Export MasterLog waybills to the sheet
  async exportMasterLog(
    spreadsheetId: string,
    token: string,
    trips: TripLog[],
    drivers: Driver[],
    sheetName: string = "MasterLog Замын хуудас"
  ): Promise<void> {
    const timestamp = new Date().toLocaleString("mn-MN");

    const headerRows = [
      [`📋 MASTERLOG • БАТАЛГААЖСАН БОЛОН ЯВАГДАЖ БУЙ ЗАМЫН ХУУДСУУД (Шинэчилсэн: ${timestamp})`],
      [],
      [
        "Огноо",
        "Жолооч",
        "Код",
        "Машины дугаар",
        "ХТ (Төлөөлөгч)",
        "Бүс / Маршрут",
        "📡 API ODO (км)",
        "✍️ Эхлэх ODO",
        "✍️ Төгсгөх ODO",
        "⚖️ ODO Зөрүү",
        "Нийт явсан (км)",
        "Авсан Түлш (л)",
        "ШТС",
        "Төлөв"
      ]
    ];

    const dataRows = trips.map((t) => {
      const matched = drivers.find((d) => d.id === t.driverId || d.code === t.driverId || d.vehicle === t.vehicleNumber);
      const apiOdo = matched?.apiOdo || 0;
      const driverFinal = t.endOdo || t.startOdo;
      const diff = apiOdo > 0 && driverFinal > 0 ? apiOdo - driverFinal : "—";
      const totalKm = t.totalKm || (t.endOdo ? t.endOdo - t.startOdo : 0);

      return [
        t.date,
        t.driverName,
        t.driverId,
        t.vehicleNumber,
        t.salesRep,
        t.zone,
        apiOdo,
        t.startOdo,
        t.endOdo || "—",
        diff,
        totalKm,
        t.fuelLiters || 0,
        t.fuelStation || "—",
        t.phase === "complete" ? "Гүйцэтгэсэн" : "Замд яваа"
      ];
    });

    const allValues = [...headerRows, ...dataRows];

    // Clear and write
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetName)}'!A1:N${allValues.length + 5}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `'${sheetName}'!A1:N${allValues.length}`,
          majorDimension: "ROWS",
          values: allValues
        })
      }
    );
  },

  // Read drivers and vehicles from Google Sheets
  async importDriversFromSheet(
    spreadsheetId: string,
    token: string,
    range: string = "A1:G100"
  ): Promise<Partial<Driver>[]> {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      throw new Error(`Хүснэгтийн өгөгдлийг уншиж чадсангүй: ${res.statusText}`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];
    if (rows.length === 0) return [];

    // Find header row or skip first row if it contains headers
    const startIndex = rows[0]?.some((cell) => cell.includes("Код") || cell.includes("Нэр") || cell.includes("Машин")) ? 1 : 0;

    const parsedDrivers: Partial<Driver>[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || !row[0]) continue;

      const code = String(row[0] || "").trim().toUpperCase();
      const name = String(row[1] || "").trim();
      const vehicle = String(row[2] || "").trim().toUpperCase();
      const model = String(row[3] || "Isuzu").trim();
      const phone = String(row[4] || "").trim();
      const salesRep = String(row[5] || "До.Дэмбэрэл").trim();
      const defaultRoute = String(row[6] || "").trim();

      if (code && name) {
        parsedDrivers.push({
          id: code,
          code,
          name,
          vehicle: vehicle || "----",
          model: model || "Isuzu",
          phone: phone || "99000000",
          salesRep: salesRep || "До.Дэмбэрэл",
          defaultRoute,
          status: "active"
        });
      }
    }

    return parsedDrivers;
  }
};

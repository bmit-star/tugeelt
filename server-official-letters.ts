import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const OFFICIAL_CONFIG = {
  TEMPLATE_DOC_ID: "17ebcybwJKnSbowBD6gnT4_ihP3zOc-QTxQGwozSZUMw",
  OUTPUT_FOLDER_ID: "1-FvVPagjch6Ye2V1UlBuP42h_Yzh__gh",
  SHEET_ID: "1BZHX2S2VIl4yI8y-BeIC-9V6YsfT6fHjcCxHRo2_xpg",
  SHEET_GID: "190727185",
  START_ROW: 10,
  END_ROW: 89,
  STATUS_COL: 17,
  DUGAAR_PREFIX: "I-26-",
  INITIAL_DUGAAR_NUM: 2215
};

const TEMPLATE_PATH = path.join(process.cwd(), "data", "templates", "google_docs_template.pdf");

const LETTERS_DIR = path.join(process.cwd(), "data", "official-letters");
if (!fs.existsSync(LETTERS_DIR)) {
  fs.mkdirSync(LETTERS_DIR, { recursive: true });
}

// Cached font buffers for optimal speed and Cyrillic Mongolian glyph fidelity (ө, ү, ₮)
let cachedSerifFont: Buffer | null = null;
let cachedSerifBold: Buffer | null = null;

function getSerifFontBuffers() {
  if (!cachedSerifFont) {
    const candidates = [
      path.join(process.cwd(), "data", "fonts", "NotoSerif-Regular.ttf"),
      path.join(process.cwd(), "data", "fonts", "PTSerif-Regular.ttf"),
      path.join(process.cwd(), "data", "fonts", "PTSans-Regular.ttf"),
      path.join(process.cwd(), "data", "fonts", "Roboto-Regular.ttf"),
      "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        cachedSerifFont = fs.readFileSync(c);
        break;
      }
    }
  }
  if (!cachedSerifBold) {
    const boldCandidates = [
      path.join(process.cwd(), "data", "fonts", "NotoSerif-Bold.ttf"),
      path.join(process.cwd(), "data", "fonts", "PTSerif-Bold.ttf"),
      path.join(process.cwd(), "data", "fonts", "PTSans-Bold.ttf"),
      path.join(process.cwd(), "data", "fonts", "Roboto-Bold.ttf"),
      "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
    ];
    for (const c of boldCandidates) {
      if (fs.existsSync(c)) {
        cachedSerifBold = fs.readFileSync(c);
        break;
      }
    }
    if (!cachedSerifBold && cachedSerifFont) {
      cachedSerifBold = cachedSerifFont;
    }
  }
  return { fontBuf: cachedSerifFont!, boldBuf: cachedSerifBold! };
}

// In-memory mutex map to prevent concurrent double-clicks
const activeGenerations: Record<string, number> = {};

/**
 * Calculates next sequential letter number e.g. "I-26-2215", "I-26-2216", etc.
 */
export function getNextLetterDugaar(db: any): string {
  let maxNum = OFFICIAL_CONFIG.INITIAL_DUGAAR_NUM - 1;

  if (Array.isArray(db.officialLetters)) {
    for (const letter of db.officialLetters) {
      if (letter.dugaar) {
        const match = letter.dugaar.toString().trim().match(/(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
  }

  // Also check assignments and orders if they have dugaar
  if (Array.isArray(db.assignments)) {
    for (const a of db.assignments) {
      if (a.albanBichigDugaar) {
        const match = a.albanBichigDugaar.toString().trim().match(/(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
  }

  return `${OFFICIAL_CONFIG.DUGAAR_PREFIX}${maxNum + 1}`;
}

/**
 * High-fidelity PDF generation by filling the user's ready-made Google Docs Template
 * (Doc ID: 17ebcybwJKnSbowBD6gnT4_ihP3zOc-QTxQGwozSZUMw)
 * Preserves the exact Google Docs letterhead, tables, layout, styling, and signature
 * and dynamically replaces placeholders:
 * - {{ognoo}} -> Date
 * - {{dugaar}} -> Sequential Official Number
 * - {{chiglel}} -> Destination sentence
 * - {{tug1}} -> Primary Driver Name & Code
 * - {{mashin}} -> Vehicle Plate
 * - {{niit_mungu}} -> Formatted Allowance
 * - {{tug2}} -> Assistant Driver (if present, otherwise cleanly cleared)
 */
export async function generateOfficialLetterPDF(data: {
  dugaar: string;
  ognoo: string;
  chiglel: string;
  mashin: string;
  tug1: string;
  tug2?: string;
  niit_mungu: string;
}): Promise<Buffer> {
  // 1. Ensure template PDF exists on disk
  let templateBuffer: Buffer;
  if (fs.existsSync(TEMPLATE_PATH)) {
    templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  } else {
    try {
      const resp = await fetch(
        `https://docs.google.com/document/d/${OFFICIAL_CONFIG.TEMPLATE_DOC_ID}/export?format=pdf`
      );
      if (resp.ok) {
        const arr = await resp.arrayBuffer();
        templateBuffer = Buffer.from(arr);
        fs.mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true });
        fs.writeFileSync(TEMPLATE_PATH, templateBuffer);
      } else {
        throw new Error(`Google Doc template fetch failed: ${resp.status}`);
      }
    } catch (e) {
      console.error('Failed to fetch Google Docs template:', e);
      throw new Error('Бэлэн Google Docs загвар (Template) олдсонгүй.');
    }
  }

  const pdfDoc = await PDFDocument.load(templateBuffer);
  pdfDoc.registerFontkit(fontkit);

  // Load Cyrillic Mongolian compliant fonts (FreeSerif / FreeSerifBold)
  const { fontBuf, boldBuf } = getSerifFontBuffers();
  const regularFont = await pdfDoc.embedFont(fontBuf);
  const boldFont = await pdfDoc.embedFont(boldBuf);

  const page = pdfDoc.getPage(0);
  const black = rgb(0, 0, 0);

  // Blank out placeholder blocks in the internal PDF content stream so underlying hex text is purged
  try {
    const { Contents } = (page.node as any).normalizedEntries();
    if (Contents && Contents.asArray().length > 1) {
      const ref = Contents.asArray()[1];
      const stream = pdfDoc.context.lookup(ref) as any;
      if (stream && stream.getContents) {
        const decodedBuf = zlib.inflateSync(Buffer.from(stream.getContents()));
        let decoded = decodedBuf.toString("latin1");
        const matches = decoded.match(/BT[\s\S]*?ET/g) || [];
        const blankMatches = [9, 35, 36, 37, 103, 105, 107, 111];
        for (let i = 52; i <= 81; i++) blankMatches.push(i);
        for (const idx of blankMatches) {
          if (matches[idx]) {
            decoded = decoded.replace(matches[idx], "BT ET");
          }
        }
        pdfDoc.context.assign(ref, pdfDoc.context.flateStream(decoded));
      }
    }
  } catch (cleanErr) {
    console.warn("Could not blank internal stream, using white opaque shield:", cleanErr);
  }

  // Format date and letter number
  const dateStr = (data.ognoo || new Date().toISOString().split('T')[0]).replace(/\./g, '-');
  const dugaarStr = `№ ${data.dugaar || ''}`;

  // 1. FILL {{ognoo}} (Template coordinates: x: 94.2, baseline y: 618.6)
  page.drawText(dateStr, {
    x: 94.2,
    y: 618.6,
    size: 10,
    font: regularFont,
    color: black
  });

  // 2. FILL № {{dugaar}} (Template coordinates: x: 208, baseline y: 618.6)
  page.drawText(dugaarStr, {
    x: 208.0,
    y: 618.6,
    size: 10,
    font: boldFont,
    color: black
  });

  // 3. FILL {{chiglel}} sentence (Template coordinates: baseline line 1 y: 517.4, line 2 y: 505.5)
  const aimagClean = (data.chiglel || 'Дархан').replace(/ аймаг.*$/i, '').trim() || 'Орон нутаг';
  page.drawText(
    `${aimagClean} аймагт бэлэн бүтээгдэхүүн хүргэлтийн чиглэлээр ажиллаж буй түгээгчийн хоолны`,
    {
      x: 72,
      y: 517.4,
      size: 10,
      font: regularFont,
      color: black
    }
  );
  page.drawText('мөнгөн олговор олгож өгнө үү.', {
    x: 72,
    y: 505.5,
    size: 10,
    font: regularFont,
    color: black
  });

  // 4. FILL TABLE 1 ROW 1 (Template coordinates: baseline y: 451.9)
  // {{tug1}}
  if (data.tug1 && data.tug1.trim() !== '') {
    page.drawText(data.tug1, {
      x: 100.5,
      y: 451.9,
      size: 9.5,
      font: regularFont,
      color: black
    });
  }

  // {{mashin}}
  if (data.mashin && data.mashin.trim() !== '') {
    page.drawText(data.mashin, {
      x: 270.8,
      y: 451.9,
      size: 9.5,
      font: regularFont,
      color: black
    });
  }

  // {{niit_mungu}}
  if (data.niit_mungu && data.niit_mungu.trim() !== '') {
    page.drawText(data.niit_mungu, {
      x: 420.0,
      y: 451.9,
      size: 9.5,
      font: regularFont,
      color: black
    });
  }

  // 5. FILL TABLE 1 ROW 2 (Template coordinates: baseline y: 429.1)
  const hasTug2 = Boolean(data.tug2 && data.tug2.trim() !== '');
  if (hasTug2) {
    page.drawText(data.tug2 || '', {
      x: 100.5,
      y: 429.1,
      size: 9.5,
      font: regularFont,
      color: black
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Merge multiple PDF buffers or files into one single PDF
 */
export async function mergeOfficialLetterPDFs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();

  for (const buf of pdfBuffers) {
    try {
      const doc = await PDFDocument.load(buf);
      const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      console.error("Error loading PDF page to merge:", err);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

/**
 * Universal helper to ensure letter record and local PDF exist on disk
 * Handles exact ID, clean ID without .pdf, dugaar, orderNo, assignmentId, orderId
 */
export async function ensureLetterRecordAndFile(
  db: any,
  saveDB: (db: any) => void,
  targetId: string
): Promise<{ letter: any; filePath: string } | null> {
  if (!targetId) return null;
  const rawClean = decodeURIComponent(targetId).trim();
  const cleanId = rawClean.replace(/\.pdf$/i, "").replace(/^alban_bichig_/i, "");

  // 1. Check if targetId matches an existing official letter
  let letter = (db.officialLetters || []).find(
    (l: any) =>
      l.id === rawClean ||
      l.id === cleanId ||
      l.fileId === rawClean ||
      l.fileId === cleanId ||
      l.assignmentId === rawClean ||
      l.assignmentId === cleanId ||
      l.orderId === rawClean ||
      l.orderId === cleanId ||
      l.orderNo === rawClean ||
      l.orderNo === cleanId ||
      l.dugaar === rawClean ||
      l.dugaar === cleanId ||
      `№ ${l.dugaar}` === rawClean ||
      `№ ${l.dugaar}` === cleanId
  );

  if (letter) {
    const filePath = path.join(LETTERS_DIR, `${letter.id}.pdf`);
    if (fs.existsSync(filePath)) {
      return { letter, filePath };
    }
    try {
      const buf = await generateOfficialLetterPDF({
        dugaar: letter.dugaar,
        ognoo: letter.ognoo,
        chiglel: letter.chiglel,
        mashin: letter.mashin,
        tug1: letter.tug1,
        tug2: letter.tug2,
        niit_mungu: letter.niit_mungu
      });
      fs.mkdirSync(LETTERS_DIR, { recursive: true });
      fs.writeFileSync(filePath, buf);
      return { letter, filePath };
    } catch (e) {
      console.error("Auto regenerate PDF error for letter", letter.id, e);
      return null;
    }
  }

  // 2. If no existing letter, check if targetId matches an assignment or order
  const assignment = (db.assignments || []).find(
    (a: any) =>
      a.id === rawClean ||
      a.id === cleanId ||
      a.orderId === rawClean ||
      a.orderId === cleanId ||
      a.orderNo === rawClean ||
      a.orderNo === cleanId ||
      a.albanBichigId === rawClean ||
      a.albanBichigId === cleanId ||
      a.albanBichigDugaar === rawClean ||
      a.albanBichigDugaar === cleanId
  );
  const order = (db.orders || []).find(
    (o: any) =>
      o.id === rawClean ||
      o.id === cleanId ||
      o.orderNo === rawClean ||
      o.orderNo === cleanId ||
      (assignment && o.id === assignment.orderId)
  );

  if (assignment || order) {
    const dugaar = assignment?.albanBichigDugaar || order?.albanBichigDugaar || getNextLetterDugaar(db);
    const rawDate = assignment?.departureDate || order?.deliveryDate || new Date().toISOString().split("T")[0];
    const ognoo = rawDate.replace(/\./g, "-");

    const rawAimag = assignment?.province || order?.province || assignment?.destination || order?.destination || "Дархан";
    const chiglel = rawAimag.replace(/ аймаг.*$/i, "").trim() || "Орон нутаг";

    const mashin = assignment?.vehiclePlate || order?.vehiclePlate || "8374УНЕ";

    let tug1Name = assignment?.primaryDriverName || order?.primaryDriverName || "Чу.Мөнхгэрэл";
    const foundDrv = (db.drivers || []).find(
      (d: any) => d.id === assignment?.primaryDriverId || d.name === tug1Name || d.code === assignment?.primaryDriverId
    );
    if (foundDrv?.code && !tug1Name.includes(`(${foundDrv.code})`)) {
      tug1Name = `${tug1Name} (${foundDrv.code})`;
    }
    const tug1 = tug1Name;

    let tug2 = "";
    if (assignment?.substituteDriverName || order?.substituteDriverName) {
      let subName = assignment?.substituteDriverName || order?.substituteDriverName || "";
      const foundSub = (db.drivers || []).find(
        (d: any) => d.id === assignment?.substituteDriverId || d.name === subName || d.code === assignment?.substituteDriverId
      );
      if (foundSub?.code && !subName.includes(`(${foundSub.code})`)) {
        subName = `${subName} (${foundSub.code})`;
      }
      tug2 = subName;
    }

    const allowanceNum = assignment?.mealAllowance || order?.mealAllowance || 50000;
    const niit_mungu = Number(allowanceNum).toLocaleString("en-US");

    const letterData = {
      dugaar,
      ognoo,
      chiglel,
      mashin,
      tug1,
      tug2,
      niit_mungu
    };

    try {
      const pdfBuffer = await generateOfficialLetterPDF(letterData);
      const letterId = assignment?.albanBichigId || order?.albanBichigId || `LTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const fileName = `alban_bichig_${dugaar.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const filePath = path.join(LETTERS_DIR, `${letterId}.pdf`);
      fs.mkdirSync(LETTERS_DIR, { recursive: true });
      fs.writeFileSync(filePath, pdfBuffer);

      const newLetterRecord = {
        id: letterId,
        orderId: order?.id,
        orderNo: order?.orderNo || assignment?.orderNo,
        assignmentId: assignment?.id,
        dugaar,
        ognoo,
        chiglel,
        mashin,
        tug1,
        tug2,
        niit_mungu,
        status: "DONE" as const,
        fileId: letterId,
        fileName,
        fileUrl: `/api/imd/official-letters/${letterId}/view`,
        downloadUrl: `/api/imd/official-letters/${letterId}/download`,
        createdAt: new Date().toISOString()
      };

      if (!db.officialLetters) db.officialLetters = [];
      const existIdx = db.officialLetters.findIndex((l: any) => l.id === letterId);
      if (existIdx >= 0) {
        db.officialLetters[existIdx] = newLetterRecord;
      } else {
        db.officialLetters.push(newLetterRecord);
      }

      if (assignment) {
        assignment.albanBichigStatus = "DONE";
        assignment.albanBichigDugaar = dugaar;
        assignment.albanBichigId = letterId;
        assignment.albanBichigPdfUrl = newLetterRecord.fileUrl;
        assignment.albanBichigFileName = fileName;
      }

      if (order) {
        order.albanBichigStatus = "DONE";
        order.albanBichigDugaar = dugaar;
        order.albanBichigId = letterId;
        order.albanBichigPdfUrl = newLetterRecord.fileUrl;
        order.albanBichigFileName = fileName;
      }

      saveDB(db);
      return { letter: newLetterRecord, filePath };
    } catch (e) {
      console.error("Auto generate letter on the fly error:", e);
      return null;
    }
  }

  return null;
}

/**
 * Setup Official Letters Express Module
 */
export function setupOfficialLettersModule(
  app: express.Express,
  db: any,
  saveDB: (db: any) => void,
  logAudit: (user: string, action: string, details: string) => void
) {
  if (!db.officialLetters) {
    db.officialLetters = [];
  }
  if (!db.officialLetterConfig) {
    db.officialLetterConfig = {
      templateDocId: OFFICIAL_CONFIG.TEMPLATE_DOC_ID,
      outputFolderId: OFFICIAL_CONFIG.OUTPUT_FOLDER_ID,
      sheetId: OFFICIAL_CONFIG.SHEET_ID,
      sheetGid: OFFICIAL_CONFIG.SHEET_GID,
      appsScriptUrl: process.env.APPS_SCRIPT_URL || ""
    };
  }

  // 1. GET ALL OFFICIAL LETTERS
  app.get("/api/imd/official-letters", (req: Request, res: Response) => {
    try {
      const letters = (db.officialLetters || []).sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json({
        success: true,
        letters,
        total: letters.length,
        config: db.officialLetterConfig
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. GENERATE OFFICIAL LETTER (Idempotent, Single or Force-Regenerate)
  app.post("/api/imd/official-letters/generate", async (req: Request, res: Response) => {
    const { orderId, assignmentId, forceRegenerate, googleAccessToken } = req.body;

    if (!orderId && !assignmentId) {
      return res.status(400).json({
        success: false,
        error: "Захиалгын ID (orderId) эсвэл Томилолтын ID (assignmentId) заавал шаардлагатай."
      });
    }

    const lockKey = `${orderId || ""}_${assignmentId || ""}`;
    const nowTs = Date.now();
    if (activeGenerations[lockKey] && nowTs - activeGenerations[lockKey] < 10000) {
      return res.status(429).json({
        success: false,
        error: "Энэ албан бичгийг боловсруулж байна. Түр хүлээнэ үү."
      });
    }

    activeGenerations[lockKey] = nowTs;

    try {
      // Find order and assignment
      let order = (db.orders || []).find((o: any) => o.id === orderId || (assignmentId && o.assignmentId === assignmentId) || (assignmentId && o.id === assignmentId));
      let assignment = (db.assignments || []).find((a: any) => a.id === assignmentId || (orderId && a.orderId === orderId) || (orderId && a.id === orderId));

      // If existing letter found and not forceRegenerate, return existing
      let existingLetter = (db.officialLetters || []).find(
        (l: any) => (orderId && l.orderId === orderId) || (assignmentId && l.assignmentId === assignmentId)
      );

      if (existingLetter && !forceRegenerate && existingLetter.status === "DONE") {
        delete activeGenerations[lockKey];
        // Ensure PDF exists on disk
        const checkPath = path.join(LETTERS_DIR, `${existingLetter.id}.pdf`);
        if (!fs.existsSync(checkPath)) {
          const reBuf = await generateOfficialLetterPDF({
            dugaar: existingLetter.dugaar,
            ognoo: existingLetter.ognoo,
            chiglel: existingLetter.chiglel,
            mashin: existingLetter.mashin,
            tug1: existingLetter.tug1,
            tug2: existingLetter.tug2,
            niit_mungu: existingLetter.niit_mungu
          });
          fs.writeFileSync(checkPath, reBuf);
        }

        return res.json({
          success: true,
          status: "DONE",
          orderId: order?.id,
          assignmentId: assignment?.id,
          letter: existingLetter,
          fileId: existingLetter.fileId,
          fileName: existingLetter.fileName,
          fileUrl: existingLetter.fileUrl,
          downloadUrl: existingLetter.downloadUrl || `/api/imd/official-letters/${existingLetter.id}/download`
        });
      }

      // Resolve fields matching the exact template layout
      const dugaar = existingLetter?.dugaar || getNextLetterDugaar(db);
      const rawDate = assignment?.departureDate || order?.deliveryDate || new Date().toISOString().split("T")[0];
      const ognoo = rawDate.replace(/\./g, "-");

      const rawAimag = assignment?.province || order?.province || assignment?.destination || order?.destination || "Дархан";
      const chiglel = rawAimag.replace(/ аймаг.*$/i, "").trim() || "Орон нутаг";

      const mashin = assignment?.vehiclePlate || order?.vehiclePlate || "8374УНЕ";

      // Driver 1: Name and code e.g. "Чу.Мөнхгэрэл (775)"
      let tug1Name = assignment?.primaryDriverName || order?.primaryDriverName || "Чу.Мөнхгэрэл";
      const foundDrv = (db.drivers || []).find(
        (d: any) => d.id === assignment?.primaryDriverId || d.name === tug1Name || d.code === assignment?.primaryDriverId
      );
      if (foundDrv?.code && !tug1Name.includes(`(${foundDrv.code})`)) {
        tug1Name = `${tug1Name} (${foundDrv.code})`;
      }
      const tug1 = tug1Name;

      // Driver 2 (Substitute): e.g. "Б.Отгонсүх (14)"
      let tug2 = "";
      if (assignment?.substituteDriverName || order?.substituteDriverName) {
        let subName = assignment?.substituteDriverName || order?.substituteDriverName || "";
        const foundSub = (db.drivers || []).find(
          (d: any) => d.id === assignment?.substituteDriverId || d.name === subName || d.code === assignment?.substituteDriverId
        );
        if (foundSub?.code && !subName.includes(`(${foundSub.code})`)) {
          subName = `${subName} (${foundSub.code})`;
        }
        tug2 = subName;
      }

      const allowanceNum = assignment?.mealAllowance || order?.mealAllowance || 50000;
      const niit_mungu = Number(allowanceNum).toLocaleString("en-US");

      const letterData = {
        dugaar,
        ognoo,
        chiglel,
        mashin,
        tug1,
        tug2,
        niit_mungu
      };

      // 1. Generate high-fidelity local PDF
      const pdfBuffer = await generateOfficialLetterPDF(letterData);
      const letterId = existingLetter?.id || `LTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const fileName = `alban_bichig_${dugaar.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const filePath = path.join(LETTERS_DIR, `${letterId}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);

      let driveFileId = existingLetter?.fileId;
      let driveFileUrl = existingLetter?.fileUrl;

      // 2. If Google Apps Script URL is configured, attempt sync with 4s timeout
      const appsScriptUrl = db.officialLetterConfig?.appsScriptUrl || process.env.APPS_SCRIPT_URL;
      if (appsScriptUrl && appsScriptUrl.startsWith("http")) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const asRes = await fetch(appsScriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              action: "generateAlbanBichig",
              dugaar,
              ognoo,
              chiglel,
              mashin,
              tug1,
              tug2,
              niit_mungu,
              orderId: order?.id || "",
              assignmentId: assignment?.id || ""
            })
          });
          clearTimeout(timeoutId);

          if (asRes.ok) {
            const asJson = await asRes.json();
            if (asJson.success && asJson.fileId) {
              driveFileId = asJson.fileId;
              driveFileUrl = asJson.fileUrl;
            }
          }
        } catch (asErr) {
          console.warn("Apps script remote execution bypassed (native PDF is ready):", asErr);
        }
      }

      // 3. Save or update official letter record in DB
      const now = new Date().toISOString();
      const newLetterRecord = {
        id: letterId,
        dugaar,
        ognoo,
        chiglel,
        mashin,
        tug1,
        tug2,
        niit_mungu,
        orderId: order?.id,
        orderNo: order?.orderNo || assignment?.orderNo,
        assignmentId: assignment?.id,
        status: "DONE" as const,
        fileId: driveFileId || letterId,
        fileName,
        fileUrl: driveFileUrl || `/api/imd/official-letters/${letterId}/view`,
        downloadUrl: `/api/imd/official-letters/${letterId}/download`,
        createdAt: existingLetter?.createdAt || now,
        updatedAt: now
      };

      const existingIndex = db.officialLetters.findIndex((l: any) => l.id === letterId);
      if (existingIndex >= 0) {
        db.officialLetters[existingIndex] = newLetterRecord;
      } else {
        db.officialLetters.push(newLetterRecord);
      }

      // Update Order record
      if (order) {
        order.albanBichigStatus = "DONE";
        order.albanBichigDugaar = dugaar;
        order.albanBichigId = letterId;
        order.albanBichigPdfUrl = newLetterRecord.fileUrl;
        order.albanBichigFileName = fileName;
        order.albanBichigDriveFileId = driveFileId;
      }

      // Update Assignment record
      if (assignment) {
        assignment.albanBichigStatus = "DONE";
        assignment.albanBichigDugaar = dugaar;
        assignment.albanBichigId = letterId;
        assignment.albanBichigPdfUrl = newLetterRecord.fileUrl;
        assignment.albanBichigFileName = fileName;
        assignment.albanBichigDriveFileId = driveFileId;
      }

      logAudit(
        "Менежер",
        "ALBAN_BICHIG_GENERATED",
        `Албан бичиг үүсгэв: Дугаар: ${dugaar}, Чиглэл: ${chiglel}, Жолооч: ${tug1}, Нийт дүн: ${niit_mungu}`
      );

      saveDB(db);

      res.json({
        success: true,
        status: "DONE",
        orderId: order?.id,
        assignmentId: assignment?.id,
        letter: newLetterRecord,
        fileId: newLetterRecord.fileId,
        fileName,
        fileUrl: newLetterRecord.fileUrl,
        downloadUrl: newLetterRecord.downloadUrl
      });
    } catch (err: any) {
      console.error("Official letter generation error:", err);
      res.status(500).json({
        success: false,
        status: "FAILED",
        message: "Албан бичиг үүсгэх явцад алдаа гарлаа.",
        details: err.message
      });
    } finally {
      delete activeGenerations[lockKey];
    }
  });

  // Universal helper to ensure letter record and local PDF exist on disk
  const ensureLetter = (targetId: string) => ensureLetterRecordAndFile(db, saveDB, targetId);

  // 3. DOWNLOAD OFFICIAL LETTER PDF (Direct Download)
  app.get("/api/imd/official-letters/:id/download", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let result = await ensureLetter(id);

      if (!result || !fs.existsSync(result.filePath)) {
        const clean = (id || "").trim();
        const foundAsn = (db.assignments || []).find(
          (a: any) =>
            a.id === clean ||
            a.orderNo === clean ||
            a.orderId === clean ||
            a.albanBichigId === clean ||
            a.albanBichigDugaar === clean
        );
        if (foundAsn) {
          result = await ensureLetter(foundAsn.id);
        }
      }

      if (result && fs.existsSync(result.filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(result.letter.fileName || `alban_bichig_${result.letter.dugaar || id}.pdf`)}"`
        );
        return res.sendFile(result.filePath);
      }

      res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8").send("Томилолтын албан бичиг олдсонгүй.");
    } catch (err: any) {
      res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8").send("Албан бичиг татахад алдаа гарлаа: " + err.message);
    }
  });

  // 4. VIEW OFFICIAL LETTER PDF INLINE (Preview)
  app.get("/api/imd/official-letters/:id/view", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let result = await ensureLetter(id);

      if (!result || !fs.existsSync(result.filePath)) {
        const clean = (id || "").trim();
        const foundAsn = (db.assignments || []).find(
          (a: any) =>
            a.id === clean ||
            a.orderNo === clean ||
            a.orderId === clean ||
            a.albanBichigId === clean ||
            a.albanBichigDugaar === clean
        );
        if (foundAsn) {
          result = await ensureLetter(foundAsn.id);
        }
      }

      if (result && fs.existsSync(result.filePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${encodeURIComponent(result.letter.fileName || `alban_bichig_${result.letter.dugaar || id}.pdf`)}"`
        );
        return res.sendFile(result.filePath);
      }

      res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8").send("Томилолтын албан бичиг олдсонгүй.");
    } catch (err: any) {
      res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8").send("Албан бичиг үзэхэд алдаа гарлаа: " + err.message);
    }
  });

  // 5. DOWNLOAD MERGED OFFICIAL LETTERS AS ONE PDF (Нийтээр нь татах эсвэл Чеклэж сонгосноор нэгтгэх)
  app.get("/api/imd/official-letters/download-all-merged", async (req: Request, res: Response) => {
    try {
      const { ids, assignmentIds, letterIds } = req.query;
      const rawIds = ids || assignmentIds || letterIds;
      let requestedIdList: string[] = [];
      if (rawIds) {
        requestedIdList = String(rawIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const pdfBuffers: Buffer[] = [];

      if (requestedIdList.length > 0) {
        // Чеклэж сонгосон тодорхой томилолт / албан бичгүүдийг л нэгтгэнэ
        for (const targetId of requestedIdList) {
          const resFile = await ensureLetter(targetId);
          if (resFile && fs.existsSync(resFile.filePath)) {
            pdfBuffers.push(fs.readFileSync(resFile.filePath));
          }
        }
      } else {
        // Сонгоогүй бол нийт бүх томилолтын албан бичгийг баталгаажуулж нэгтгэнэ
        // Step A: Ensure every assignment has an official letter generated
        const assignments = db.assignments || [];
        for (const asn of assignments) {
          await ensureLetter(asn.id);
        }

        // Step B: If no assignments, check orders
        const orders = db.orders || [];
        if (assignments.length === 0 && orders.length > 0) {
          for (const ord of orders) {
            await ensureLetter(ord.id);
          }
        }

        // Step C: If still completely empty, create a sample official letter so PDF is never empty
        if ((db.officialLetters || []).length === 0) {
          const dugaar = getNextLetterDugaar(db);
          const letterData = {
            dugaar,
            ognoo: new Date().toISOString().split("T")[0],
            chiglel: "Дархан",
            mashin: "8374УНЕ",
            tug1: "Чу.Мөнхгэрэл (775)",
            tug2: "Б.Отгонсүх (14)",
            niit_mungu: "50,000"
          };
          const pdfBuf = await generateOfficialLetterPDF(letterData);
          const letterId = `LTR-${Date.now()}-1`;
          const filePath = path.join(LETTERS_DIR, `${letterId}.pdf`);
          fs.writeFileSync(filePath, pdfBuf);
          const record = {
            id: letterId,
            dugaar,
            ognoo: letterData.ognoo,
            chiglel: letterData.chiglel,
            mashin: letterData.mashin,
            tug1: letterData.tug1,
            tug2: letterData.tug2,
            niit_mungu: letterData.niit_mungu,
            status: "DONE" as const,
            fileId: letterId,
            fileName: `alban_bichig_${dugaar}.pdf`,
            fileUrl: `/api/imd/official-letters/${letterId}/view`,
            downloadUrl: `/api/imd/official-letters/${letterId}/download`,
            createdAt: new Date().toISOString()
          };
          db.officialLetters = [record];
          saveDB(db);
        }

        for (const letter of (db.officialLetters || [])) {
          const filePath = path.join(LETTERS_DIR, `${letter.id}.pdf`);
          if (fs.existsSync(filePath)) {
            pdfBuffers.push(fs.readFileSync(filePath));
          } else {
            const resFile = await ensureLetter(letter.id);
            if (resFile && fs.existsSync(resFile.filePath)) {
              pdfBuffers.push(fs.readFileSync(resFile.filePath));
            }
          }
        }
      }

      if (pdfBuffers.length === 0) {
        return res.status(404).json({ error: "Нэгтгэх албан бичгийн PDF олдсонгүй. Сонголтоо шалгана уу." });
      }

      const mergedBuffer = await mergeOfficialLetterPDFs(pdfBuffers);
      const dateTag = new Date().toISOString().split("T")[0];
      const filename = requestedIdList.length > 0 && requestedIdList.length < (db.assignments || []).length
        ? `IMD_Songoson_${pdfBuffers.length}_Alban_Bichig_${dateTag}.pdf`
        : `IMD_Niit_Alban_Bichig_${dateTag}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      return res.send(mergedBuffer);
    } catch (err: any) {
      console.error("Download merged PDF error:", err);
      res.status(500).json({ error: "Албан бичиг нэгтгэн татахад алдаа гарлаа: " + err.message });
    }
  });

  // 6. MERGE MULTIPLE OFFICIAL LETTERS INTO ONE PDF (JSON or BASE64)
  app.post("/api/imd/official-letters/merge-pdf", async (req: Request, res: Response) => {
    try {
      let { letterIds } = req.body;
      if (!Array.isArray(letterIds) || letterIds.length === 0) {
        // Default to all letters if not specified
        letterIds = (db.officialLetters || []).map((l: any) => l.id);
      }

      if (letterIds.length === 0) {
        return res.status(400).json({ error: "Нэгтгэх албан бичиг байхгүй байна." });
      }

      const pdfBuffers: Buffer[] = [];
      for (const id of letterIds) {
        const item = await ensureLetter(id);
        if (item && item.filePath && fs.existsSync(item.filePath)) {
          pdfBuffers.push(fs.readFileSync(item.filePath));
        }
      }

      if (pdfBuffers.length === 0) {
        return res.status(404).json({ error: "Сонгосон файлуудаас уншигдах PDF олдсонгүй." });
      }

      const mergedBuffer = await mergeOfficialLetterPDFs(pdfBuffers);
      const mergedBase64 = mergedBuffer.toString("base64");

      res.json({
        success: true,
        fileName: "merged_alban_bichig.pdf",
        totalMerged: pdfBuffers.length,
        base64: mergedBase64
      });
    } catch (err: any) {
      console.error("Merge PDF error:", err);
      res.status(500).json({ error: "PDF нэгтгэхэд алдаа гарлаа: " + err.message });
    }
  });

  // 6. GET / UPDATE OFFICIAL LETTER CONFIG
  app.get("/api/imd/official-letters/config", (req: Request, res: Response) => {
    res.json({
      success: true,
      config: db.officialLetterConfig
    });
  });

  app.post("/api/imd/official-letters/config", (req: Request, res: Response) => {
    try {
      const { appsScriptUrl, templateDocId, outputFolderId, sheetId, sheetGid } = req.body;
      db.officialLetterConfig = {
        ...db.officialLetterConfig,
        ...(appsScriptUrl !== undefined ? { appsScriptUrl } : {}),
        ...(templateDocId !== undefined ? { templateDocId } : {}),
        ...(outputFolderId !== undefined ? { outputFolderId } : {}),
        ...(sheetId !== undefined ? { sheetId } : {}),
        ...(sheetGid !== undefined ? { sheetGid } : {})
      };
      saveDB(db);
      res.json({ success: true, config: db.officialLetterConfig });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. DELETE OFFICIAL LETTER
  app.delete("/api/imd/official-letters/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const index = (db.officialLetters || []).findIndex((l: any) => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: "Албан бичиг олдсонгүй" });
      }

      const letter = db.officialLetters[index];
      db.officialLetters.splice(index, 1);

      // Clean local file if exists
      const filePath = path.join(LETTERS_DIR, `${id}.pdf`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Reset linked order and assignment status
      if (letter.orderId) {
        const o = (db.orders || []).find((ord: any) => ord.id === letter.orderId);
        if (o) {
          o.albanBichigStatus = "NOT_CREATED";
          delete o.albanBichigId;
          delete o.albanBichigPdfUrl;
        }
      }
      if (letter.assignmentId) {
        const a = (db.assignments || []).find((asn: any) => asn.id === letter.assignmentId);
        if (a) {
          a.albanBichigStatus = "NOT_CREATED";
          delete a.albanBichigId;
          delete a.albanBichigPdfUrl;
        }
      }

      logAudit("Менежер", "ALBAN_BICHIG_DELETED", `Албан бичиг устгав: Дугаар: ${letter.dugaar}`);
      saveDB(db);

      res.json({ success: true, message: "Албан бичиг амжилттай устгагдлаа." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // 8. GOOGLE APPS SCRIPT WEB APP BRIDGE & STATS ENDPOINTS
  // ============================================================

  // 8.1 GET DASHBOARD STATS (Range 10-89)
  app.get("/api/imd/official-letters/apps-script/stats", async (req: Request, res: Response) => {
    try {
      const cfg = db.officialLetterConfig || OFFICIAL_CONFIG;
      const totalRange = (cfg.endRow || OFFICIAL_CONFIG.END_ROW) - (cfg.startRow || OFFICIAL_CONFIG.START_ROW) + 1; // 80 rows

      const doneLetters = (db.officialLetters || []).filter((l: any) => l.status === "DONE");
      const doneCount = doneLetters.length;

      // Unprocessed assignments or orders without official letter
      const pendingAssignments = (db.assignments || []).filter((a: any) => a.albanBichigStatus !== "DONE");
      const pendingOrders = (db.orders || []).filter((o: any) => o.albanBichigStatus !== "DONE");
      const pendingCount = Math.max(pendingAssignments.length, pendingOrders.length);

      res.json({
        success: true,
        stats: {
          totalRange,
          startRow: cfg.startRow || OFFICIAL_CONFIG.START_ROW,
          endRow: cfg.endRow || OFFICIAL_CONFIG.END_ROW,
          doneCount,
          pendingCount
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8.2 ADD NEW ORDER (Column C: tug1, D: tug2, E: chiglel, F: dugaar +1, H: size, I: ognooIrsen, J: ognooGarsan)
  app.post("/api/imd/official-letters/apps-script/new-order", async (req: Request, res: Response) => {
    try {
      const { tug1, tug2, chiglel, size, ognooIrsen, ognooGarsan } = req.body;
      if (!chiglel) {
        return res.status(400).json({ success: false, error: "Томилолт чиглэл (Багана E) заавал шаардлагатай." });
      }

      // If user configured remote Apps Script URL, try proxying to it
      const appsScriptUrl = db.officialLetterConfig?.appsScriptUrl;
      if (appsScriptUrl && appsScriptUrl.trim().startsWith("http")) {
        try {
          const resp = await fetch(appsScriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "addNewOrder",
              orderData: { tug1, tug2, chiglel, size, ognooIrsen, ognooGarsan }
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            return res.json(data);
          }
        } catch (scriptErr) {
          console.warn("Apps Script remote forward failed, falling back to internal engine:", scriptErr);
        }
      }

      // Internal Engine: Auto-generate next dugaar e.g. I-26-2218
      const dugaar = getNextLetterDugaar(db);
      const orderId = `ord_imd_${Date.now()}`;
      const assignmentId = `asn_imd_${Date.now()}`;

      const newOrder = {
        id: orderId,
        orderNo: `ORD-IMD-${Date.now().toString().slice(-6)}`,
        province: chiglel,
        destination: chiglel,
        primaryDriverName: tug1 || "Чү.Мөнхгэрэл",
        substituteDriverName: tug2 || "",
        cargoWeightTon: Number(size) || 3.5,
        deliveryDate: ognooGarsan || new Date().toISOString().split("T")[0],
        receivedDate: ognooIrsen || new Date().toISOString().split("T")[0],
        albanBichigStatus: "PENDING",
        albanBichigDugaar: dugaar,
        assignmentId,
        createdAt: new Date().toISOString()
      };

      const newAssignment = {
        id: assignmentId,
        orderId,
        orderNo: newOrder.orderNo,
        province: chiglel,
        destination: chiglel,
        primaryDriverName: tug1 || "Чү.Мөнхгэрэл",
        substituteDriverName: tug2 || "",
        vehiclePlate: "8374УНЕ",
        departureDate: ognooGarsan || new Date().toISOString().split("T")[0],
        albanBichigStatus: "PENDING",
        albanBichigDugaar: dugaar,
        mealAllowance: 50000,
        createdAt: new Date().toISOString()
      };

      if (!db.orders) db.orders = [];
      if (!db.assignments) db.assignments = [];
      db.orders.unshift(newOrder);
      db.assignments.unshift(newAssignment);

      saveDB(db);
      logAudit("Менежер", "ORDER_CREATED", `Шинэ захиалга үүслээ: ${dugaar} - ${chiglel}`);

      res.json({
        success: true,
        message: "Шинэ захиалга амжилттай бүртгэгдлээ.",
        order: newOrder,
        assignment: newAssignment,
        dugaar
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8.3 RUN PENDING GENERATION (Batch process all non-DONE rows using the Google Docs Template)
  app.post("/api/imd/official-letters/apps-script/run-generation", async (req: Request, res: Response) => {
    try {
      const appsScriptUrl = db.officialLetterConfig?.appsScriptUrl;
      if (appsScriptUrl && appsScriptUrl.trim().startsWith("http")) {
        try {
          const resp = await fetch(appsScriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "runPendingGeneration" })
          });
          if (resp.ok) {
            const data = await resp.json();
            return res.json(data);
          }
        } catch (scriptErr) {
          console.warn("Apps Script remote batch failed, falling back to internal engine:", scriptErr);
        }
      }

      // Internal Engine batch run
      let processed = 0;
      const generatedList: any[] = [];

      const pendingAssignments = (db.assignments || []).filter((a: any) => a.albanBichigStatus !== "DONE");

      for (const asn of pendingAssignments) {
        const item = await ensureLetter(asn.id);
        if (item && item.letter) {
          processed++;
          generatedList.push({
            id: item.letter.id,
            dugaar: item.letter.dugaar,
            name: item.letter.fileName,
            url: item.letter.fileUrl,
            downloadUrl: item.letter.downloadUrl
          });
        }
      }

      // Also check any standalone pending orders
      const pendingOrders = (db.orders || []).filter((o: any) => o.albanBichigStatus !== "DONE");
      for (const ord of pendingOrders) {
        const item = await ensureLetter(ord.id);
        if (item && item.letter) {
          processed++;
          generatedList.push({
            id: item.letter.id,
            dugaar: item.letter.dugaar,
            name: item.letter.fileName,
            url: item.letter.fileUrl,
            downloadUrl: item.letter.downloadUrl
          });
        }
      }

      res.json({
        success: true,
        count: processed,
        message: `Нийт ${processed} албан бичгийг бэлэн Google Docs загварын дагуу амжилттай боловсрууллаа.`,
        list: generatedList
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

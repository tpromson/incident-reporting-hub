import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { GoogleGenAI, Type } from '@google/genai';
import { IncidentReport, SensorStatus } from './types.js';

// Path for persistent storage
const DATA_DIR = path.resolve('./data');
const DATA_FILE = path.join(DATA_DIR, 'incidents.json');

// Initial template incidents to populate if no file exists
const INITIAL_INCIDENTS: IncidentReport[] = [
  {
    id: "INC-2026-001",
    timestamp: "2026-05-28T14:20:00Z",
    sensorId: "SN-3112",
    sensorName: "SN-3112 - Thermal Regulator",
    urgency: "High",
    description: "หน้าจอร้อนจัดเกิน 85 องศาเซลเซียส และระบบตัดการทำงานหลักขัดข้อง มีกลิ่นไหม้อ่อนๆ",
    reporterName: "Chakrit_Admin",
    status: "Resolved",
    resolutionNote: "ช่างวิศวกรรีเซ็ตระบบระบายความร้อนและเปลี่ยนแผงควบคุมไฟสำรองหลักเรียบร้อยแล้วเมื่อวานนี้เวลา 16:30 น.",
    aiAnalysis: {
      cause: "หม้อแปลงวงจรจ่ายไฟสำรองชำรุดเสียหายจากไฟฟ้าเกินขนาด",
      riskLevel: "Critical Safety Risk",
      actionPlan: "1. ตัดแหล่งจ่ายกระแสไฟสำรองภายนอก\n2. เข้าตรวจสอบตัวระบายความร้อนภายนอกและแผงจงจรหลักด้วยขั้ววัดอุณหภูมิอินฟราเรด\n3. เปลี่ยนตัวปรับแรงดันไฟ (Voltage Regulator)\n4. ทดสอบโหลดและเปิดระบบใหม่อีกครั้ง"
    }
  },
  {
    id: "INC-2026-002",
    timestamp: "2026-05-29T00:45:00Z",
    sensorId: "SN-2045",
    sensorName: "SN-2045 - Central Humidity Sensor",
    urgency: "Medium",
    description: "ค่าความชื้นทะลุ 95% RH ตลอด 4 ชั่วโมงที่ผ่านมา แต่ตรวจสอบภายนอกห้องเครื่องไม่มีความผิดปกติ น่าจะเกิดจากเซ็นเซอร์ชำรุดหรือสายสลัดหัวสแกนหลุด",
    reporterName: "Somchai_Mech",
    status: "Pending",
    aiAnalysis: {
      cause: "เซ็นเซอร์สัมผัสความชื้นเสื่อมสภาพหรือมีหยดน้ำเกาะติดแน่นที่หัวสแกน (Condensation)",
      riskLevel: "Medium Operational Risk",
      actionPlan: "1. ให้เจ้าหน้าที่ช่างบำรุงรักษาถอดครอบครอบเซ็นเซอร์ออกและทำความสะอาดด้วยแอลกอฮอล์\n2. เป่าแห้งเซ็นเซอร์ด้วยลมสะอาดแรงดันต่ำ\n3. หากสายต่อนำสัญญาณชำรุด ให้เข้าหัวเชื่อมใหม่\n4. เปรียบเทียบค่าอ่านจริงกับเครื่องมือเปรียบเทียบแบบพกพา"
    }
  }
];

// Memory fallback storage
let memoryIncidents: IncidentReport[] = [...INITIAL_INCIDENTS];

// Initialize Firebase Admin
let db: admin.firestore.Firestore | null = null;
let isFirebaseInitialized = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // If the private key contains escaped literal '\n' characters, format them correctly
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    db = admin.firestore();
    isFirebaseInitialized = true;
    console.log("[Firebase Admin] Connected to Firestore successfully.");
  } else {
    console.log("[Firebase Admin] Config missing. Falling back to local file/memory.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin, using local file/memory fallback:", error);
}

// Helper to ensure data directory and file exist
export function initDataStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_INCIDENTS, null, 2), 'utf-8');
    }
  } catch (error) {
    // Write error (like EROFS in serverless environments). Safe to catch silently.
  }
}

// Get all incidents (async)
export async function getIncidents(): Promise<IncidentReport[]> {
  if (isFirebaseInitialized && db) {
    try {
      const snapshot = await db.collection('incidents').orderBy('timestamp', 'desc').get();
      const docs = snapshot.docs.map(doc => doc.data() as IncidentReport);
      
      // If collection is completely empty, seed it with INITIAL_INCIDENTS
      if (docs.length === 0) {
        console.log("[Firebase Admin] Seeding initial incidents to Firestore.");
        await saveIncidents(INITIAL_INCIDENTS);
        return INITIAL_INCIDENTS;
      }
      return docs;
    } catch (error) {
      console.error("Error reading from Firestore, falling back to local file/memory:", error);
    }
  }

  // Local File / Memory Fallback
  initDataStorage();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw) as IncidentReport[];
      memoryIncidents = data;
      return data;
    }
  } catch (error) {
    console.warn("Failed to read local data file, using in-memory store:", error);
  }
  return memoryIncidents;
}

// Save all incidents (async)
export async function saveIncidents(incidents: IncidentReport[]): Promise<void> {
  if (isFirebaseInitialized && db) {
    try {
      const snapshot = await db.collection('incidents').get();
      const existingIds = new Set(snapshot.docs.map(doc => doc.id));
      const inputIds = new Set(incidents.map(inc => inc.id));
      
      const batch = db.batch();
      
      // Add or update
      for (const inc of incidents) {
        const docRef = db.collection('incidents').doc(inc.id);
        batch.set(docRef, inc, { merge: true });
      }
      
      // Delete removed
      for (const doc of snapshot.docs) {
        if (!inputIds.has(doc.id)) {
          batch.delete(doc.ref);
        }
      }
      
      await batch.commit();
      return;
    } catch (error) {
      console.error("Error writing to Firestore, falling back to local file/memory:", error);
    }
  }

  // Local File / Memory Fallback
  memoryIncidents = incidents;
  try {
    initDataStorage();
    fs.writeFileSync(DATA_FILE, JSON.stringify(incidents, null, 2), 'utf-8');
  } catch (error) {
    // local write failed (EROFS on Vercel), but state is updated in memoryIncidents
  }
}

// Gemini API instance initialization helper
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("WARNING: GEMINI_API_KEY is not configured or uses placeholder value. AI analysis will run in fallback simulation mode.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Call Gemini 3.5 Flash to analyze incident report and provide insights
export async function analyzeIncidentIssue(description: string, sensorName: string): Promise<{ cause: string, riskLevel: string, actionPlan: string }> {
  const ai = getGeminiClient();
  
  if (!ai) {
    // Return high-fidelity mock AI results in Thai if Gemini API Key not present
    return getFallbackAIAnalysis(description, sensorName);
  }

  try {
    const prompt = `คุณคือผู้เชี่ยวชาญด้านอุปกรณ์ IoT, SCADA, ระบบโรงงาน และเซ็นเซอร์อัจฉริยะ (Industrial IoT Engineer)
กรุณาวิเคราะห์ปัญหาของอุปกรณ์ที่รายงานเข้ามาด้านล่างนี้ และสร้างข้อมูลวิเคราะห์ในรูปแบบ JSON
รายละเอียดปัญหา:
ชื่อชุดอุปกรณ์/เซ็นเซอร์: "${sensorName}"
อาการที่พบ: "${description}"

กรุณาตอบกลับในรูปแบบ JSON วัตถุเพียงอย่างเดียวที่มีโครงสร้างดังนี้ (อย่าใส่เครื่องหมาย markdown ครอบ เช่น \`\`\`json):
{
  "cause": "สาเหตุที่น่าจะเกิดขึ้นมากที่สุด (อธิบายสั้นๆ กระชับ เป็นภาษาไทย)",
  "riskLevel": "ระดับความเสี่ยงทางการแพทย์/ความปลอดภัย หรือผลกระทบต่อสิ่งแวดล้อมและผลผลิต (เช่น High Operational Risk, Critical Safety Risk, Low Environmental Risk)",
  "actionPlan": "แผนปฏิบัติการให้ช่างเทคนิคดำเนินการตรวจสอบและแก้ไข (ระบุเป็นรายการ 1, 2, 3, 4 สั้นๆ ชัดเจน เข้าใจง่าย ภาษาไทย)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cause: { type: Type.STRING, description: "Most likely cause of the issue in Thai" },
            riskLevel: { type: Type.STRING, description: "Risk level assessment label" },
            actionPlan: { type: Type.STRING, description: "Numbered list of actionable steps for technicians in Thai" }
          },
          required: ["cause", "riskLevel", "actionPlan"]
        }
      }
    });

    const responseText = response.text ? response.text.trim() : "";
    if (responseText) {
      const parsed = JSON.parse(responseText);
      return {
        cause: parsed.cause || "ไม่สามารถวิเคราะห์สาเหตุได้แน่ชัด",
        riskLevel: parsed.riskLevel || "Medium Risk",
        actionPlan: parsed.actionPlan || "1. กรุณาเข้าตรวจสอบอุปกรณ์ที่หน้างานโดยด่วน"
      };
    }
    throw new Error("Empty response from GenAI");
  } catch (error) {
    console.error("Failed to analyze with Gemini, falling back to heuristic mock analyzer:", error);
    return getFallbackAIAnalysis(description, sensorName);
  }
}

// Fallback high quality heuristic solver
function getFallbackAIAnalysis(description: string, sensorName: string) {
  let cause = "ตรวจพบลักษณะสัญญาณขัดข้องทางกระแสไฟหรือขั้วสัมผัสหลวม";
  let riskLevel = "Medium Operational Impact";
  let actionPlan = "1. ดำเนินการตัดระบบไฟฟ้าหลักที่จ่ายเข้าอุปกรณ์\n2. ตรวจสอบขั้วนำสายไฟและขั้วสัมผัสต่อนำสัญญาณทั้งหมดว่าขาด/หลวมหรือไม่\n3. ทำความสะอาดขั้วด้วย Contact Cleaner\n4. เสียบจ่ายไฟเพื่อเช็คความต้านทานกระแสไฟ";

  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes("ความชื้น") || lowerDesc.includes("humidity") || sensorName.includes("Humidity")) {
    cause = "คอนเดนเซชั่นเนื่องจากความชื้นสูงเกินไป หรือหัวเซ็นเซอร์อิ่มตัวด้วยหยดน้ำ";
    riskLevel = "Medium Environmental Risk";
    actionPlan = "1. ตรวจสอบสภาพทางกายภาพเพื่อหาละอองน้ำหรือจุดรั่วไหลของน้ำใกล้อุปกรณ์\n2. ถอดฝาครอบกรองอากาศของหัวเซ็นเซอร์ออกเพื่อระบายอากาศ\n3. ทำความสะอาดสิ่งสกปรกและเช็ดเป่าสลับชิ้นงานทดสอบอสังหาริมทรัพย์\n4. ปรับตั้งค่าสอบเทียบค่าศูนย์ (Zero Calibration) ใหม่";
  } else if (lowerDesc.includes("ร้อน") || lowerDesc.includes("ไหม้") || lowerDesc.includes("อุณหภูมิ") || lowerDesc.includes("temperature") || sensorName.includes("Thermal") || sensorName.includes("Temp")) {
    cause = "ระบบหมุนเวียนระบายความร้อนขัดข้อง หรือกระแสไฟเกินขีดจำกัดสูงสุดทำให้เกิดความร้อนสะสมระแวกขดลวด";
    riskLevel = "Critical Fire & Safety Risk";
    actionPlan = "1. ประกาศหยุดการทำงานของอุปกรณ์ชุดนี้ทันทีเพื่อลดความร้อนสะสม\n2. ตรวจเช็คการทำงานของพัดลมเป่าระบายความร้อนและตะแกรงดักจับฝุ่น\n3. ใช้กล้องอินฟราเรดถ่ายตรวจจับความร้อนแผงบอร์ดควบคุมแผ่อัลกอลิทึม\n4. เปลี่ยนฟิวส์ต้านทานตัดกระแสเกินหากพบการละลายชำรุด";
  } else if (lowerDesc.includes("ดึง") || lowerDesc.includes("หลุด") || lowerDesc.includes("สาย") || lowerDesc.includes("หน้าจอ") || lowerDesc.includes("ดับ")) {
    cause = "เกิดการตัดการเชื่อมต่อสัญญาณโครงข่ายไฟฟ้าสำรอง หรือสายส่งข้อมูล (RS485/Modbus) ชำรุด";
    riskLevel = "High Data Loss Risk";
    actionPlan = "1. ขันล็อกขั้วสายสื่อสารเข้ากับบล็อก RJ45 หรือช่องเสียบอนาล็อกให้แน่นหนาขึ้น\n2. ตรวจวัดค่าความต้านทานและแรงดันระหว่างพอร์ตเพื่อตรวจสอบสายขาดใน\n3. ทดลองรีสตาร์ทตัวเครื่องบันทึกเกตเวย์ (Gateway Node)\n4. ทดสอบส่งตรวจสอบการเชื่อมต่อ (Ping) กลับมายังส่วนแสดงผลกลาง";
  }

  return { cause, riskLevel, actionPlan };
}

// Push incident report to LINE group via Messaging API
export async function pushLineNotification(incident: IncidentReport): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_ID;

  if (!token || !targetId || token === "your-line-channel-access-token" || targetId === "your-line-target-id") {
    console.log("[LINE API] Notification skipped. Credentials not configured.");
    return;
  }

  try {
    const payload = {
      to: targetId,
      messages: [
        {
          type: "flex",
          altText: `🚨 แจ้งเหตุระบบขัดข้อง [${incident.id}]`,
          contents: {
            type: "bubble",
            hero: {
              type: "image",
              url: "https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6",
              size: "full",
              aspectRatio: "20:9",
              aspectMode: "cover"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `🚨 แจ้งเหตุระบบขัดข้อง [${incident.id}]`,
                  weight: "bold",
                  size: "md",
                  color: incident.urgency === 'High' ? "#e11d48" : incident.urgency === 'Medium' ? "#d97706" : "#0d9488"
                },
                {
                  type: "box",
                  layout: "vertical",
                  margin: "md",
                  spacing: "xs",
                  contents: [
                    {
                      type: "box",
                      layout: "baseline",
                      spacing: "sm",
                      contents: [
                        { type: "text", text: "อุปกรณ์", color: "#aaaaaa", size: "xs", flex: 2 },
                        { type: "text", text: incident.sensorName, wrap: true, color: "#444444", size: "xs", flex: 5, weight: "bold" }
                      ]
                    },
                    {
                      type: "box",
                      layout: "baseline",
                      spacing: "sm",
                      contents: [
                        { type: "text", text: "ความด่วน", color: "#aaaaaa", size: "xs", flex: 2 },
                        { type: "text", text: incident.urgency, wrap: true, color: incident.urgency === 'High' ? "#e11d48" : "#d97706", size: "xs", flex: 5, weight: "bold" }
                      ]
                    },
                    {
                      type: "box",
                      layout: "baseline",
                      spacing: "sm",
                      contents: [
                        { type: "text", text: "ผู้รายงาน", color: "#aaaaaa", size: "xs", flex: 2 },
                        { type: "text", text: incident.reporterName, wrap: true, color: "#444444", size: "xs", flex: 5 }
                      ]
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      margin: "sm",
                      contents: [
                        { type: "text", text: "รายละเอียดความชำรุด:", color: "#aaaaaa", size: "xs", weight: "bold" },
                        { type: "text", text: incident.description, wrap: true, color: "#333333", size: "xs", margin: "xs" }
                      ]
                    },
                    incident.aiAnalysis ? {
                      type: "box",
                      layout: "vertical",
                      margin: "md",
                      backgroundColor: "#f5f3ff",
                      paddingAll: "10px",
                      cornerRadius: "md",
                      contents: [
                        { type: "text", text: "🔍 ผลวิเคราะห์จาก Gemini AI:", color: "#6366f1", size: "xs", weight: "bold" },
                        { type: "text", text: `สาเหตุ: ${incident.aiAnalysis.cause || "-"}`, wrap: true, color: "#4338ca", size: "xs", margin: "xs", weight: "bold" },
                        { type: "text", text: `แผนแก้ไข:\n${incident.aiAnalysis.actionPlan || "-"}`, wrap: true, color: "#4b5563", size: "xs", margin: "xs" }
                      ]
                    } : { type: "spacer", size: "xs" }
                  ]
                }
              ]
            }
          }
        }
      ]
    };

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`[LINE API] Flex message successfully pushed to target: ${targetId}`);
    } else {
      const errText = await response.text();
      console.error(`[LINE API] Failed to push message: ${response.status} - ${errText}`);
    }
  } catch (error) {
    console.error("[LINE API] Error calling push message API:", error);
  }
}

// Push incident status updates to LINE group via Messaging API
export async function pushLineStatusUpdate(incidentId: string, status: string, note: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_ID;

  if (!token || !targetId || token === "your-line-channel-access-token" || targetId === "your-line-target-id") {
    return;
  }

  try {
    const textMessage = `🔧 อัพเดทสถานะเคส [${incidentId}] -> ✅ *${status}*\nบันทึกการแก้ไข: ${note || '-'}`;
    
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: "text",
            text: textMessage
          }
        ]
      })
    });

    if (response.ok) {
      console.log(`[LINE API] Status update successfully pushed to target: ${targetId}`);
    } else {
      const errText = await response.text();
      console.error(`[LINE API] Failed to push status update: ${response.status} - ${errText}`);
    }
  } catch (error) {
    console.error("[LINE API] Error calling status update push API:", error);
  }
}

// Sync incident report to Google Sheets via Apps Script Webhook
export async function pushToGoogleSheet(incident: IncidentReport): Promise<void> {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl === "your-google-sheet-webhook-url" || webhookUrl === "") {
    return;
  }

  try {
    const payload = {
      id: incident.id,
      sensorId: incident.sensorId,
      sensorName: incident.sensorName,
      urgency: incident.urgency,
      description: incident.description,
      reporterName: incident.reporterName,
      aiDiagnostic: incident.aiAnalysis ? `สาเหตุ: ${incident.aiAnalysis.cause}\nแผนแก้ไข:\n${incident.aiAnalysis.actionPlan}` : "ไม่มีการวิเคราะห์"
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log("[Google Sheet] Report successfully pushed to sheet webhook.");
    } else {
      console.error(`[Google Sheet] Failed to push data to sheet: ${response.status}`);
    }
  } catch (error) {
    console.error("[Google Sheet] Error sending request to webhook:", error);
  }
}

// Fetch sensors dynamically from the Google Sheet tab
export async function getSensorsFromSheet(): Promise<SensorStatus[]> {
  const googleSheetId = process.env.GOOGLE_SHEET_ID || '1Wyqk1i_rUlnAgsAR7PT_w-smEbpTR40lAis69iKzqWI';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${googleSheetId}/export?format=csv&gid=112576994`;

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`Google Sheets responded with status ${res.status}`);
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    
    const sensors: SensorStatus[] = [];
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let cell = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      result.push(cell.trim());
      return result;
    };

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 4) continue;
      
      const no = cols[0];
      const name = cols[1];
      const location = cols[2] || "คลังอุปกรณ์";
      const statusStr = cols[3].toLowerCase();
      const tempRange = cols[4];
      const tempMax = cols[5];
      const linkId = cols[7];

      if (!name || name === "SensorName" || name === "no.") continue;

      const id = linkId || `SN-${no || Math.random().toString(36).substring(7)}`;
      const status: 'Online' | 'Error' | 'Maintenance' = statusStr === 'online' ? 'Online' : 'Error';
      
      // Reading formatting
      let lastReading = "N/A";
      if (tempRange) {
        lastReading = `${tempRange} °C`;
      } else if (tempMax) {
        lastReading = `Max ${tempMax} °C`;
      }

      // Sensor Type detection
      const nameLower = name.toLowerCase();
      let type: 'Temperature' | 'Humidity' | 'Pressure' | 'Voltage' | 'Flow' = 'Temperature';
      if (nameLower.includes('humidity') || nameLower.includes('ความชื้น') || linkId?.startsWith('DHT22')) {
        type = 'Humidity';
      }

      sensors.push({
        id,
        name,
        location,
        status,
        lastReading,
        type
      });
    }

    if (sensors.length === 0) {
      throw new Error("No sensors parsed from sheet");
    }

    return sensors;
  } catch (error) {
    console.error("[Google Sheet Sensors] Error loading sheet sensors, using default list:", error);
    // Return default sensors list as fallback
    return [
      { id: "SN-2044", name: "ตู้เย็นคลัง ตู้แช่ 3 ประตู (Stock3Door)", location: "Server Room A", status: "Online", lastReading: "24.5 °C", type: "Temperature" },
      { id: "SN-2045", name: "ตู้เย็นคลังวัคซีน (StockVaccine2Door)", location: "กลุ่มงานเภสัช", status: "Error", lastReading: "98.2% RH", type: "Humidity" },
      { id: "SN-2048", name: "ตู้เย็นคลินิค (SubClinic)", location: "OPD?", status: "Online", lastReading: "1.2 Bar", type: "Pressure" },
      { id: "SN-3112", name: "ตู้เย็น OPD (OPD2Door)", location: "OPD?", status: "Online", lastReading: "42.1 °C", type: "Temperature" },
      { id: "SYS-MOD", name: "ตู้เย็นวัคซีน OPD (SubOPDVaccine)", location: "OPD?", status: "Online", lastReading: "Voltage nominal", type: "Voltage" }
    ];
  }
}

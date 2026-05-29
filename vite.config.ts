import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { getIncidents, saveIncidents, analyzeIncidentIssue, pushLineNotification, pushLineStatusUpdate, pushToGoogleSheet } from './src/api';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-server-dev',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/incidents') || req.url.includes('/api/incidents/'))) {
              res.setHeader('Content-Type', 'application/json');
              const url = new URL(req.url, 'http://localhost');
              const method = req.method;

              if (method === 'GET') {
                try {
                  const data = await getIncidents();
                  res.end(JSON.stringify(data));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              } else if (method === 'POST') {
                try {
                  let body = '';
                  req.on('data', chunk => { body += chunk; });
                  req.on('end', async () => {
                    try {
                      const payload = body ? JSON.parse(body) : {};
                      const incidents = await getIncidents();
                      
                      let aiAnalysis = undefined;
                      if (payload.description) {
                        try {
                          aiAnalysis = await analyzeIncidentIssue(payload.description, payload.sensorName || 'Unknown Sensor');
                        } catch (err) {
                          console.error("Gemini failed in Vite Dev Server plug:", err);
                        }
                      }

                      const newID = `INC-2026-${String(incidents.length + 1).padStart(3, '0')}`;
                      const newIncident = {
                        id: newID,
                        timestamp: new Date().toISOString(),
                        sensorId: payload.sensorId || 'UNKNOWN',
                        sensorName: payload.sensorName || 'Unknown Component',
                        urgency: (payload.urgency || 'Low') as 'Low' | 'Medium' | 'High',
                        description: payload.description || '',
                        reporterName: payload.reporterName || 'Anonymous',
                        status: 'Pending' as 'Pending' | 'Investigating' | 'Resolved',
                        aiAnalysis,
                        attachment: payload.attachment
                      };

                      incidents.unshift(newIncident);
                      await saveIncidents(incidents);
                      pushLineNotification(newIncident); // Push to LINE
                      pushToGoogleSheet(newIncident); // Sync with Google Sheets
                      res.statusCode = 201;
                      res.end(JSON.stringify(newIncident));
                    } catch (innerErr: any) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: innerErr.message }));
                    }
                  });
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              } else if (method === 'PUT') {
                const parts = url.pathname.split('/');
                const id = parts[parts.length - 1];
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    const payload = body ? JSON.parse(body) : {};
                    const incidents = await getIncidents();
                    const idx = incidents.findIndex(item => item.id === id);
                    if (idx === -1) {
                      res.statusCode = 404;
                      res.end(JSON.stringify({ error: 'Incident not found' }));
                      return;
                    }
                    incidents[idx] = {
                      ...incidents[idx],
                      status: payload.status || incidents[idx].status,
                      resolutionNote: payload.resolutionNote !== undefined ? payload.resolutionNote : incidents[idx].resolutionNote
                    };
                    await saveIncidents(incidents);
                    pushLineStatusUpdate(id, payload.status || incidents[idx].status, payload.resolutionNote || '');
                    res.end(JSON.stringify(incidents[idx]));
                  } catch (innerErr: any) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: innerErr.message }));
                  }
                });
              } else if (method === 'DELETE') {
                const parts = url.pathname.split('/');
                const id = parts[parts.length - 1];
                try {
                  const incidents = await getIncidents();
                  const filtered = incidents.filter(item => item.id !== id);
                  if (incidents.length === filtered.length) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Incident not found' }));
                  } else {
                    await saveIncidents(filtered);
                    res.end(JSON.stringify({ success: true, id }));
                  }
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: e.message }));
                }
              }
            } else if (req.url?.startsWith('/api/analyze')) {
              res.setHeader('Content-Type', 'application/json');
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    const payload = body ? JSON.parse(body) : {};
                    const result = await analyzeIncidentIssue(payload.description, payload.sensorName);
                    res.end(JSON.stringify(result));
                  } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                  }
                });
              } else {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed' }));
              }
            } else if (req.url === '/api/config') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                googleSheetId: process.env.GOOGLE_SHEET_ID || '1Wyqk1i_rUlnAgsAR7PT_w-smEbpTR40lAis69iKzqWI'
              }));
            } else if (req.url?.startsWith('/api/line/webhook')) {
              res.setHeader('Content-Type', 'application/json');
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
                    if (!token || token === "your-line-channel-access-token" || token === "") {
                      console.warn("[LINE Webhook] Warning: LINE_CHANNEL_ACCESS_TOKEN is not configured. Webhook returns 200 OK for verification.");
                      res.statusCode = 200;
                      res.end(JSON.stringify({ success: true, warning: "Token not configured" }));
                      return;
                    }
                    const payload = body ? JSON.parse(body) : {};
                    const events = payload.events || [];
                    for (const event of events) {
                      if (event.type === 'message' && event.message.type === 'text') {
                        const replyToken = event.replyToken;
                        const userText = event.message.text.trim().toLowerCase();
                        let replyText = "สวัสดีครับ! ยินดีต้อนรับสู่ระบบแจ้งบำรุงผ่าน LINE OA หากระบบหรือเซ็นเซอร์ขัดข้อง สามารถรายงานได้ทันทีผ่าน Webview (LIFT) ของระบบครับ";

                        if (userText.includes('แจ้ง') || userText.includes('พัง') || userText.includes('เสีย') || userText.includes('repair')) {
                          replyText = `📍 ต้องการรายงานปัญหาใช่หรือไม่ครับ?\nคุณสามารถเปิดแบบฟอร์มรายงานเพื่อแจ้งอาการเสียร่วมกับการวิเคราะห์ด้วย AI ได้ทันทีที่ลิงก์นี้ครับ:\nhttp://localhost:3000/`;
                        } else if (userText.includes('สถานะ') || userText.includes('status')) {
                          const incidents = await getIncidents();
                          const pending = incidents.filter(i => i.status !== 'Resolved').length;
                          replyText = `📊 รายงานสรุปสถานะอุปกรณ์ล่าสุด:\n- เคสที่ค้างคา: ${pending} เคส\n- เคสที่แก้ไขแล้ว: ${incidents.filter(i => i.status === 'Resolved').length} เคส\nตรวจสอบประวัติทั้งหมดได้ที่แผงควบคุมหลักครับ!`;
                        }

                        try {
                          const response = await fetch("https://api.line.me/v2/bot/message/reply", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              replyToken: replyToken,
                              messages: [{ type: "text", text: replyText }]
                            })
                          });
                          if (!response.ok) {
                            console.error(`[LINE Webhook] LINE API responded with ${response.status}: ${await response.text()}`);
                          }
                        } catch (fetchErr) {
                          console.error("[LINE Webhook] Failed to send reply to LINE:", fetchErr);
                        }
                      }
                    }
                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true }));
                  } catch (e: any) {
                    console.error("[LINE Webhook] Error processing event in dev server:", e);
                    res.statusCode = 200; // Always return 200 to LINE to prevent suspension
                    res.end(JSON.stringify({ success: false, error: e.message }));
                  }
                });
              } else {
                res.statusCode = 405;
                res.end(JSON.stringify({ error: 'Method not allowed' }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

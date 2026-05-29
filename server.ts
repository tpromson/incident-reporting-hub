import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getIncidents, saveIncidents, analyzeIncidentIssue } from './src/api.js';
import { IncidentReport } from './src/types.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

// Enable CORS for frontend during dual-server setups
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// GET all incidents
app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await getIncidents();
    res.json(incidents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new incident
app.post('/api/incidents', async (req, res) => {
  try {
    const { sensorId, sensorName, urgency, description, reporterName, attachment } = req.body;
    
    if (!sensorId || !sensorName || !urgency || !description || !reporterName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const incidents = await getIncidents();
    
    // Auto-generate AI analysis in background or during creation
    let aiAnalysis = undefined;
    try {
      aiAnalysis = await analyzeIncidentIssue(description, sensorName);
    } catch (apiErr) {
      console.error("Gemini automatic audit issue failed:", apiErr);
    }

    const newID = `INC-2026-${String(incidents.length + 1).padStart(3, '0')}`;
    const newIncident: IncidentReport = {
      id: newID,
      timestamp: new Date().toISOString(),
      sensorId,
      sensorName,
      urgency,
      description,
      reporterName,
      status: 'Pending',
      aiAnalysis,
      attachment
    };

    incidents.unshift(newIncident); // prepend new ones
    await saveIncidents(incidents);
    
    res.status(201).json(newIncident);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to trigger manual/automated AI issue analysis report-by-report
app.post('/api/analyze', async (req, res) => {
  const { description, sensorName } = req.body;
  if (!description || !sensorName) {
    return res.status(400).json({ error: "Missing description or sensorName" });
  }
  try {
    const result = await analyzeIncidentIssue(description, sensorName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update status/resolution of an incident
app.put('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    
    const incidents = await getIncidents();
    const idx = incidents.findIndex(item => item.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Incident not found" });
    }

    incidents[idx] = {
      ...incidents[idx],
      status: status || incidents[idx].status,
      resolutionNote: resolutionNote !== undefined ? resolutionNote : incidents[idx].resolutionNote
    };
    
    await saveIncidents(incidents);
    res.json(incidents[idx]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an incident report
app.delete('/api/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let incidents = await getIncidents();
    const countBefore = incidents.length;
    incidents = incidents.filter(item => item.id !== id);
    
    if (incidents.length === countBefore) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    await saveIncidents(incidents);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Production: Serve React production build statically
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve('./dist'))) {
  app.use(express.static(path.resolve('./dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('./dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API Server lists incidents. Frontend is running dev mode. Call APIs at /api/*.');
  });
}

// Start server if not running on Vercel
if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Incident Server] listening on http://0.0.0.0:${port}`);
  });
}

export default app;

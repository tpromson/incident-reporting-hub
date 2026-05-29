export interface IncidentReport {
  id: string;
  timestamp: string;
  sensorId: string;
  sensorName: string;
  urgency: 'Low' | 'Medium' | 'High';
  description: string;
  reporterName: string;
  reporterLineId?: string;
  status: 'Pending' | 'Investigating' | 'Resolved';
  resolutionNote?: string;
  aiAnalysis?: {
    cause?: string;
    steps?: string[];
    riskLevel?: string;
    actionPlan?: string;
  };
  attachment?: string; // base64 or placeholder name
}

export interface SensorStatus {
  id: string;
  name: string;
  location: string;
  status: 'Online' | 'Error' | 'Maintenance';
  lastReading: string;
  type: 'Temperature' | 'Humidity' | 'Pressure' | 'Voltage' | 'Flow';
}

export interface LineChatMessage {
  id: string;
  sender: 'User' | 'Bot' | 'Admin';
  senderName: string;
  text?: string;
  timestamp: string;
  flexCard?: any; // To render LINE's rich flex templates
}

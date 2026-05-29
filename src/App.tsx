import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  Database, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  Upload, 
  Download, 
  Trash2, 
  Settings, 
  RefreshCw, 
  FileSpreadsheet, 
  User, 
  Smartphone, 
  Sparkles, 
  Info,
  X,
  Plus,
  Send,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { IncidentReport, SensorStatus, LineChatMessage } from './types';

// Predefined sensor list
const INITIAL_SENSORS: SensorStatus[] = [
  { id: "SN-2044", name: "SN-2044 (Temperature)", location: "Server Room A", status: "Online", lastReading: "24.5 °C", type: "Temperature" },
  { id: "SN-2045", name: "SN-2045 (Humidity)", location: "Main Warehouse B", status: "Error", lastReading: "98.2% RH", type: "Humidity" },
  { id: "SN-2048", name: "SN-2048 (Pressure)", location: "Boiler Room 2", status: "Online", lastReading: "1.2 Bar", type: "Pressure" },
  { id: "SN-3112", name: "SN-3112 (Thermal Regulator)", location: "Cooling Tower 1", status: "Online", lastReading: "42.1 °C", type: "Temperature" },
  { id: "SYS-MOD", name: "SYS-MOD (Main Control Logic)", location: "Central Console", status: "Online", lastReading: "Voltage nominal", type: "Voltage" }
];

export default function App() {
  // App state
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [sensors, setSensors] = useState<SensorStatus[]>(INITIAL_SENSORS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'spreadsheet' | 'line' | 'info'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLIFTMode, setIsLIFTMode] = useState(false); // Simulated LINE webview container toggle

  // Form State
  const [selectedSensorId, setSelectedSensorId] = useState('SN-2045');
  const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('Chakrit_LineAdmin');
  const [attachment, setAttachment] = useState<string>(''); // base64 representation
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Resolution states for Admin Modal
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);

  // LINE Chat simulator values
  const [chatMessages, setChatMessages] = useState<LineChatMessage[]>([
    { id: "m1", sender: "Bot", senderName: "Incident Alert Bot", text: "สวัสดีครับ! ยินดีต้อนรับสู่ระบบแจ้งบำรุงผ่าน LINE OA หากระบบหรือเซ็นเซอร์ขัดข้อง สามารถรายงานผ่านการคลิกเมนูแจ้งซ่อม (LIFT Webview) ได้ทันทีครับ", timestamp: "08:15 AM" }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Drag and drop file upload flag
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [googleSheetId, setGoogleSheetId] = useState('1Wyqk1i_rUlnAgsAR7PT_w-smEbpTR40lAis69iKzqWI');

  // Fetch incidents and sensors on load
  useEffect(() => {
    fetchIncidents();
    fetchConfig();
    fetchSensors();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.googleSheetId) {
          setGoogleSheetId(data.googleSheetId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
    }
  };

  const fetchSensors = async () => {
    try {
      const res = await fetch('/api/sensors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSensors(data);
          // If the currently selected sensor is not in the list, pre-select the first one
          const currentExists = data.some(s => s.id === selectedSensorId);
          if (!currentExists) {
            setSelectedSensorId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch sensors:", err);
    }
  };

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIncidents();
    try {
      const res = await fetch('/api/sensors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSensors(data);
        }
      }
    } catch (err) {
      console.error("Failed to refresh sensors:", err);
    }
    setTimeout(() => setRefreshing(false), 800);
  };

  // Toggle Sensor status from health monitor for simulation purposes
  const toggleSensorStatus = (id: string) => {
    setSensors(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus = s.status === 'Online' ? 'Error' : s.status === 'Error' ? 'Maintenance' : 'Online';
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  // Process File Upload drag/drop/click
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดรูปภาพเท่านั้นครับ');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setAttachment(e.target.result as string);
        setAttachmentName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const removeAttachment = () => {
    setAttachment('');
    setAttachmentName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Autofill templates for testing demo
  const applyAutofill = (type: 'humidity' | 'temperature' | 'voltage') => {
    if (type === 'humidity') {
      setSelectedSensorId('SN-2045');
      setUrgency('Medium');
      setDescription('ค่าความชื้นหน้าปัดบอก 98.2% ถือว่าชื้นจัดผิดปกติ ส่งคลื่นสะท้อนกลับมีสแปมแปลกๆ แผงวงจรเปียกชื้น น้ำเกาะหน้าเครื่อง');
    } else if (type === 'temperature') {
      setSelectedSensorId('SN-3112');
      setUrgency('High');
      setDescription('อุณหภูมิพุ่งกระฉูดถึง 82 องศา ระบบทำความเย็นหลักไม่มีน้ำไหลผ่าน มีเสียงดังแกร๊กๆ ออกมาจากคอมเพรสเซอร์กลิ่นควันเหม็นไหม้');
    } else if (type === 'voltage') {
      setSelectedSensorId('SYS-MOD');
      setUrgency('High');
      setDescription('หน้าจอดับสนิท ไฟสถานะขัดข้อง โมดูลหลัก SYS-MOD ไฟตกต่ำกว่า 12V จ่ายกระแสไฟฟ้าขัดข้อง ส่งผลให้เครื่องวัดทุกจุดตัดออฟไลน์');
    }
  };

  // Submit Incident Report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("กรุณากรอกอาการผิดปกติก่อนส่งรายงานครับ");
      return;
    }

    setSubmitting(true);
    try {
      const selectedSensor = sensors.find(s => s.id === selectedSensorId);
      const payload = {
        sensorId: selectedSensorId,
        sensorName: selectedSensor ? selectedSensor.name : selectedSensorId,
        urgency,
        description,
        reporterName,
        attachment: attachment || undefined
      };

      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newIncident: IncidentReport = await res.json();
        
        // Match lists
        setIncidents(prev => [newIncident, ...prev]);
        
        // Add LINE message simulator
        const alertTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        // Webhook Bot pushed LINE messages
        const botPushMessage: LineChatMessage = {
          id: `bmsg-${Date.now()}`,
          sender: 'Bot',
          senderName: 'Incident Alert Bot',
          timestamp: alertTime,
          flexCard: {
            title: `🚨 ด่วน! แจ้งระบบขัดข้อง [${newIncident.id}]`,
            icon: "warning",
            sensor: newIncident.sensorName,
            status: "Pending",
            urgency: newIncident.urgency,
            desc: newIncident.description,
            reporter: newIncident.reporterName,
            aiDiagnostic: newIncident.aiAnalysis?.cause || "ระบบอยู่ระหว่างวิเคราะห์..."
          }
        };

        setChatMessages(prev => [
          ...prev, 
          { id: `umsg-${Date.now()}`, sender: 'User', senderName: reporterName, text: `ส่งรายงานความขัดข้องระบบ: [${newIncident.id}] เซ็นเซอร์ ${newIncident.sensorName} ระดับความด่วน: ${newIncident.urgency}`, timestamp: alertTime },
          botPushMessage
        ]);

        // Show LINE response alert / toast
        setActiveTab('line'); // Swith to LINE sim to see results

        // Clear values
        setDescription('');
        setAttachment('');
        setAttachmentName('');
        // Alert corresponding sensor error
        setSensors(prev => prev.map(s => {
          if (s.id === selectedSensorId) {
            return { ...s, status: 'Error' };
          }
          return s;
        }));
      } else {
        alert("ขออภัย! ไม่สามารถส่งข้อมูลเข้าระบบได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (err) {
      console.error("Submission failed:", err);
      alert("เชื่อมต่อเซิร์ฟเวอร์หลักล้มเหลว");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Action Item Status Update
  const handleUpdateStatus = async (id: string, nextStatus: 'Pending' | 'Investigating' | 'Resolved', note: string) => {
    setResolving(true);
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus, resolutionNote: note })
      });

      if (res.ok) {
        const updated = await res.json();
        setIncidents(prev => prev.map(item => item.id === id ? updated : item));
        
        // If resolved, update the simulated sensor back online!
        if (nextStatus === 'Resolved') {
          setSensors(prev => prev.map(s => {
            if (s.id === updated.sensorId) {
              return { ...s, status: 'Online' };
            }
            return s;
          }));
        }

        // Add automated line response
        const alertTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        setChatMessages(prev => [
          ...prev,
          {
            id: `bmsg-res-${Date.now()}`,
            sender: 'Bot',
            senderName: 'Incident Alert Bot',
            timestamp: alertTime,
            text: `🔧 อัพเดทสถานะเคส [${id}] -> ✅ *${nextStatus}*\nโดย: เจ้าหน้าที่แอดมิน\nบันทึก: ${note || '-'}`
          }
        ]);

        setSelectedIncident(null);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setResolving(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm(`ระบบต้องการยืนยันการลบรายการรายงานหมายเลข [${id}] นี้ออกจากฐานข้อมูลถาวร?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setIncidents(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete report:", err);
    }
  };

  // LINE Live Simulator Manual Messaging
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const alertTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const userMsg: LineChatMessage = {
      id: `m-chat-${Date.now()}`,
      sender: 'User',
      senderName: 'Liff_User',
      text: chatInput,
      timestamp: alertTime
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulated quick intelligent Bot replies using simple checks
    setTimeout(() => {
      let botReply = "ขออภัยครับ ขณะนี้ระบบยังไม่รอบรับข้อความอิสระนี้ คุณสามารถพิมพ์ 'แจ้งซ่อม' เพื่อรับลิงก์กรอกแบบรายงาน หรือพูดคุยเกี่ยวกับประวัติเหตุขัดข้องได้ครับ";
      const txt = chatInput.toLowerCase();
      if (txt.includes('แจ้ง') || txt.includes('พัง') || txt.includes('เสีย') || txt.includes('repair')) {
        botReply = "📍 หากมีเซ็นเซอร์ขัดข้องหรือระบบชำรุด สามารถกดแท็บ '📝 รายงานปัญหา' ด้านข้างขวา เพื่อทำรายงานส่งความผิดปกติเข้า LINE Group ทันทีครับ";
      } else if (txt.includes('สถานะ') || txt.includes('status')) {
        const errorSensorsCount = sensors.filter(s => s.status !== 'Online').length;
        botReply = `📊 รายงานสรุปสถานะอุปกรณ์ล่าสุด:\n- ระบบออนไลน์: ${sensors.filter(s => s.status === 'Online').length} ตัว\n- ขัดข้อง/ปิดด่วน: ${errorSensorsCount} ตัว\nสรุป: ระบบโดยรวมปลอดภัยปานกลาง`;
      }
      
      setChatMessages(prev => [
        ...prev,
        { id: `m-bot-rep-${Date.now()}`, sender: 'Bot', senderName: 'Incident Alert Bot', text: botReply, timestamp: alertTime }
      ]);
    }, 700);
  };

  // Convert array to CSV string for local spreadsheet export download simulation
  const handleExportCSV = () => {
    const headers = ["ID", "Timestamp", "Sensor ID", "Sensor Name", "Urgency", "Issue Description", "Reporter", "Status", "Resolution Note", "AI Assessment"];
    const rows = incidents.map(inc => [
      inc.id,
      inc.timestamp,
      inc.sensorId,
      inc.sensorName,
      inc.urgency,
      inc.description.replace(/"/g, '""'),
      inc.reporterName,
      inc.status,
      (inc.resolutionNote || '').replace(/"/g, '""'),
      (inc.aiAnalysis?.cause || '').replace(/"/g, '""')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GoogleSheet_LiveSync_IncidentLogs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-100 flex flex-col font-sans overflow-x-hidden text-slate-800">
      
      {/* Top Banner Navigation Bar */}
      <nav id="top-nav" className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <AlertTriangle size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <span className="font-extrabold text-slate-800 text-base md:text-lg tracking-tight flex items-center gap-1.5">
              Incident Reporting Hub <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-widest scale-90">v4.2.1</span>
            </span>
            <p className="text-[10px] text-slate-400 font-medium">LINE WebUI & Sensor Integration Monitor</p>
          </div>
        </div>

        {/* Navigation Tabs (Quick access) */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Activity size={14} />
            แผงควบคุมหลัก
          </button>
          <button 
            onClick={() => setActiveTab('spreadsheet')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'spreadsheet' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <FileSpreadsheet size={14} />
            Google Sheet (<span className="truncate max-w-[40px]">{googleSheetId}</span>)
          </button>
          <button 
            onClick={() => setActiveTab('line')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'line' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <MessageSquare size={14} />
            LINE OA Chat Live
          </button>
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'info' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Info size={14} />
            วิธีกรอก / เชื่อม LINE
          </button>
        </div>

        {/* Global Action and Status */}
        <div className="flex items-center gap-4">
          <button 
            onClick={handleRefresh}
            title="Refresh current data state"
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-500 hover:text-emerald-600 transition-all flex items-center justify-center cursor-pointer shadow-sm"
          >
            <RefreshCw size={16} className={`${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <div className="text-right">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">System State</p>
            <p className="text-xs text-emerald-600 font-bold flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> 
              {sensors.filter(s => s.status === 'Error').length > 0 ? "Alert High" : "All Active"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-extrabold text-xs shadow-inner">
            <User size={16} />
          </div>
        </div>
      </nav>

      {/* Mobile Tab bar - Simple and user accessible */}
      <div className="flex md:hidden bg-white border-b border-slate-200 p-2 justify-around shadow-inner scrollbar-none z-20 overflow-x-auto gap-2">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
        >
          <Activity size={14} /> แผงควบคุม
        </button>
        <button 
          onClick={() => setActiveTab('spreadsheet')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'spreadsheet' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
        >
          <FileSpreadsheet size={14} /> Sheet
        </button>
        <button 
          onClick={() => setActiveTab('line')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'line' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
        >
          <MessageSquare size={14} /> LINE Live
        </button>
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'info' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
        >
          <Info size={14} /> วิธีทำ
        </button>
      </div>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
        
        {/* Toggle LIFT Simulator warning only on tab view when appropriate */}
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex gap-3 items-center">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Smartphone size={20} className="animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">ทดสอบแบบจำลองหน้าจอ LINE คล้าย Google Form 📱</h4>
              <p className="text-xs text-slate-500">คุณสามารถปรับเปลี่ยนโหมดของฟอร์มรายงานให้มีดีไซน์พอดีหน้าจอโทรศัพท์สไตล์ LINE Webview (LIFT) ได้ที่นี่</p>
            </div>
          </div>
          <button 
            onClick={() => setIsLIFTMode(!isLIFTMode)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5"
          >
            <span>{isLIFTMode ? "สลับกลับมุมมอง Desktop" : "สลับปรับสไตล์ LINE (LIFT) โทรศัพท์"}</span>
          </button>
        </div>

        {/* Tab 1: Incident Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Left Column: Live Sensor Stats - 3 span */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              
              {/* Sensor Health Monitor Card */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">เซ็นเซอร์รายจุด (Sensor Health)</h3>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Live</span>
                </div>
                
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[300px] pr-1.5">
                  {sensors.map(sensor => (
                    <div 
                      key={sensor.id} 
                      onClick={() => toggleSensorStatus(sensor.id)}
                      title="คลิก เพื่อสลับสถานะจำลองข้อผิดพลาด"
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-700">{sensor.id}</span>
                        <span className="text-[10px] text-slate-400">{sensor.type} · {sensor.location}</span>
                        <span className="text-[11px] text-slate-500 font-mono mt-1">{sensor.lastReading}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider transition-colors ${
                        sensor.status === 'Online' ? 'bg-emerald-100 text-emerald-700' :
                        sensor.status === 'Error' ? 'bg-rose-100 text-rose-700 animate-pulse' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {sensor.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 bg-slate-50/50 p-2.5 rounded-xl">
                  💡 <span className="font-bold text-slate-500">จำลองปัญหา:</span> คลิกที่แต่ละเซ็นเซอร์เพื่อเปลี่ยนสถานะเป็น <span className="text-rose-500">Error</span> ซึ่งจะส่งผลให้มีไอคอนขึ้นแจ้งว่าระบบมีรายงานการผิดพลาด!
                </div>
              </div>

              {/* Push LINE OA Card */}
              <div className="bg-indigo-600 rounded-2xl p-5 shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 text-indigo-400 opacity-20">
                  <Smartphone size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-200">Auto-Sync LINE OA</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-indigo-50/90 font-medium">
                    เมื่อผู้ใช้ล็อกอินแจ้งซ่อมผ่าน LINE แบบฟอร์ม ข้อมูลพังเสียหายจะถูกส่งเข้า LINE Developers Channel สำหรับช่างเทคนิคทันที พร้อมรายงานการวิเคราะห์จาก <strong>Gemini AI</strong>
                  </p>
                </div>
                <div className="mt-5 relative z-10 pt-4 border-t border-indigo-400/30 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wide uppercase">Webhook Active</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">LIFT API v2</span>
                </div>
              </div>
            </div>

            {/* Middle Column: The interactive main Form (Vegas Phone-fit / Grid desktop-fit) - 6 span */}
            <div className={`lg:col-span-6 flex flex-col ${isLIFTMode ? 'max-w-[420px] mx-auto w-full lg:col-span-6 shadow-2xl rounded-[40px] border-[12px] border-slate-800 bg-white ring-8 ring-slate-100 overflow-hidden' : ''}`}>
              <div className={`bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col flex-1 shadow-sm`}>
                
                {/* LIFT Phone Header representation */}
                {isLIFTMode && (
                  <div className="bg-[#111] text-white px-5 py-2.5 flex justify-between items-center text-xs tracking-tight select-none shrink-0 border-b border-slate-800">
                    <span className="font-bold font-mono">09:41</span>
                    <div className="w-24 h-4 bg-black rounded-full absolute left-1/2 transform -translate-x-1/2"></div>
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[10px] font-semibold text-slate-400">LINE App</span>
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    </div>
                  </div>
                )}

                {/* Form Branding & Prompting Header */}
                <div className="bg-slate-50 p-6 md:p-8 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start gap-4 shrink-0">
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                       รายงานระบบผิดปกติ
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {isLIFTMode ? "Report sensor errors inside LINE LIFT Container" : "Report sensor malfunction or system irregularities in Google Sheet"}
                    </p>
                  </div>
                  
                  {/* Quick autofill select box to test Gemini capability */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block w-full">คลิกทดสอบด่วน (Autofill):</span>
                    <button 
                      onClick={() => applyAutofill('humidity')} 
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer border border-emerald-200"
                    >
                      ความชื้นรั่ว
                    </button>
                    <button 
                      onClick={() => applyAutofill('temperature')} 
                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer border border-rose-200"
                    >
                      ความร้อนขึ้น
                    </button>
                    <button 
                      onClick={() => applyAutofill('voltage')} 
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer border border-indigo-200"
                    >
                      ระบบไฟดับ
                    </button>
                  </div>
                </div>

                {/* Interactive Google-Forms / LIFT Form Body */}
                <form onSubmit={handleSubmit} className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Input: Sensor ID select menu */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        Sensor / อุปกรณ์ที่ขัดข้อง
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedSensorId}
                          onChange={(e) => setSelectedSensorId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 appearance-none cursor-pointer"
                        >
                          {sensors.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.status})
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Input: Urgency levels buttons */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                        ระดับความจำเป็น (Urgency)
                      </label>
                      <div className="flex gap-2">
                        {(['Low', 'Medium', 'High'] as const).map(level => {
                          const isSelected = urgency === level;
                          let btnStyle = "border-slate-200 text-slate-600 bg-white hover:bg-slate-50";
                          if (isSelected) {
                            if (level === 'Low') btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-800";
                            else if (level === 'Medium') btnStyle = "border-amber-500 bg-amber-50/75 text-amber-800";
                            else btnStyle = "border-rose-500 bg-rose-50 text-rose-800";
                          }
                          return (
                            <button
                              type="button"
                              key={level}
                              onClick={() => setUrgency(level)}
                              className={`flex-1 py-3 px-1 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider cursor-pointer text-center ${btnStyle}`}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Input: Textarea Incident behavior description */}
                    <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex justify-between">
                        <span>อาการที่พบอย่างละเอียด (Language supported: Thai/En)</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                          <Sparkles size={11} /> Gemini Analyzed
                        </span>
                      </label>
                      <textarea 
                        rows={4} 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none font-medium leading-relaxed" 
                        placeholder="กรุณาอธิบายพฤติกรรมความผิดปกติ เช่น หน้าจอดับ ตัวเลขอุณหภูมิขึ้นรัวๆ บอร์ดเกิดความร้อนผิดสังเกต หรือมีเสียงพัดลมชำรุด..."
                      ></textarea>
                    </div>

                    {/* Input: Reporter LINE Name */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                        LINE Display Name (ผู้รายงาน)
                      </label>
                      <input 
                        type="text" 
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600" 
                        placeholder="กรุณากรอกชื่อบำรุงรักษา"
                      />
                    </div>

                    {/* Input: Drag & Drop Screen attachment */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                        แนบภาพเครื่องขัดข้อง (Drag & Drop)
                      </label>
                      
                      {!attachment ? (
                        <div 
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`w-full h-[46px] border-2 border-dashed rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition-colors ${
                            isDragging ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200'
                          }`}
                        >
                          <Upload size={14} className="mr-2" />
                          <span>{isDragging ? "วางรูปเพื่ออัปโหลด..." : "คลิก หรือลากรูปเพื่อแนบ"}</span>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden" 
                          />
                        </div>
                      ) : (
                        <div className="w-full h-[46px] bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between px-3">
                          <div className="flex items-center gap-2 truncate max-w-[80%]">
                            <span className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center border border-emerald-100 font-bold text-xs text-emerald-600">
                              📷
                            </span>
                            <span className="text-xs font-bold text-slate-600 truncate">{attachmentName || "Attached Image"}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={removeAttachment}
                            className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 transition-all cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </form>

                {/* Submit Sticky Footer Section */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                  <p className="text-[10px] text-slate-400 font-medium max-w-[280px]">
                    เมื่อกดส่งข้อมูล ระบบจะนำแผงควบคุมและแผนงานวิเคราะห์ด้วย Gemini AI โฆษณาทดสอบ และจัดเก็บบันทึกในหม้อประวัติ Spreadsheet ID ข้างต้นทันที
                  </p>
                  <button 
                    onClick={handleSubmit}
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold py-3.5 px-8 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>กำลังป้อนความเห็น AI...</span>
                      </>
                    ) : (
                      <>
                        <span>ส่งรายงานเข้า LINE & Google Sheet</span>
                        <Send size={16} className="stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activities in Realtime - 3 span */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">ประวัติแจ้งผิดปกติ (Recent reports)</h3>
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded font-mono">{incidents.length} รายการ</span>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto max-h-[350px] pr-1.5">
                  {loading ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-slate-400" />
                      <span>กำลังโหลดรายงานล่าสุด...</span>
                    </div>
                  ) : incidents.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 border-2 border-dashed border-slate-100 rounded-xl p-4">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-500">ไม่มีปัญหาตกค้าง!</p>
                      <p className="scale-90 text-[10px] mt-0.5 text-slate-400">ทุกเซ็นเซอร์กำลังทำงานสมบูรณ์ดี</p>
                    </div>
                  ) : (
                    incidents.map(inc => (
                      <div 
                        key={inc.id}
                        onClick={() => setSelectedIncident(inc)}
                        className={`p-3.5 bg-slate-50 hover:bg-slate-100 border-l-4 rounded-xl cursor-pointer transition-all border ${
                          inc.status === 'Resolved' ? 'border-emerald-500 border-l-emerald-500 bg-emerald-50/10' :
                          inc.status === 'Investigating' ? 'border-amber-500 border-l-amber-500 bg-amber-50/10 animate-pulse' :
                          'border-rose-500 border-l-rose-500'
                        }`}
                      >
                        <div className="flex justify-between items-start text-[10px]">
                          <span className={`font-extrabold uppercase tracking-widest ${
                            inc.status === 'Resolved' ? 'text-emerald-600' :
                            inc.status === 'Investigating' ? 'text-amber-600' :
                            'text-rose-600 animate-pulse'
                          }`}>{inc.status}</span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            {new Date(inc.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} PM
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-800 mt-1.5">{inc.sensorId} - {inc.id}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{inc.description}</p>
                        <div className="mt-2.5 pt-2 border-t border-slate-200/55 flex justify-between items-center text-[9px] text-slate-400">
                          <span className="font-bold">🧑‍🔧 {inc.reporterName}</span>
                          <span className={`font-bold uppercase px-1 rounded text-[8px] ${
                            inc.urgency === 'High' ? 'bg-rose-100 text-rose-700' :
                            inc.urgency === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-200 text-slate-600'
                          }`}>{inc.urgency}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button 
                    onClick={() => setActiveTab('spreadsheet')}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 font-bold border border-slate-200 py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <FileSpreadsheet size={13} />
                    <span>แผงดู Google Sheet สำรอง</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Simulated Google Sheet grid representation - Precise request */}
        {activeTab === 'spreadsheet' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Headers row with sheets-green */}
            <div className="bg-[#107044] text-white p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-900 shrink-0">
              <div>
                <span className="text-emerald-200 text-[10px] font-bold uppercase tracking-widest tracking-widest flex items-center gap-1">
                  <FileSpreadsheet size={12} /> Google Sheets Sync Live Database
                </span>
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mt-1">
                  Spreadsheet : <span className="font-mono text-emerald-200 text-sm md:text-base underline selection:bg-emerald-800 break-all">{googleSheetId}</span>
                </h2>
                <p className="text-xs text-emerald-100/90 mt-1">ข้อมูลแถวที่ปรากฏจำลองตรงตามข้อมูลชีทที่ลิงก์ไว้สำหรับการอัพเดทข้อมูลรายงานของเซ็นเซอร์</p>
              </div>

              <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                <button 
                  onClick={handleExportCSV}
                  className="bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>ดาวน์โหลดไฟล์รายงาน (.CSV)</span>
                </button>
                <a 
                  href={`https://docs.google.com/spreadsheets/d/${googleSheetId}/edit`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer border border-emerald-700 flex items-center gap-1.5"
                >
                  <span>เปิด Google Sheet จริง</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Mini Stat row in Google sheets simulation */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap gap-4 md:gap-8 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <div>📈 คอลัมน์พารามิเตอร์: <span className="text-slate-800 font-extrabold font-mono">10 Columns</span></div>
              <div>📑 รายการที่กำลังซิงก์: <span className="text-slate-800 font-extrabold font-mono">{incidents.length} แถว</span></div>
              <div>⚡ ความเร็วพยากรณ์: <span className="text-emerald-600 font-extrabold">Instant (&lt; 1s)</span></div>
              <div className="ml-auto text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="stroke-[2.5]" /> สถิติบันทึกปลอดภัยผ่าน Cloud Sync
              </div>
            </div>

            {/* Interactive Sheets Table view */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200">
                    <th className="p-3.5 border-r border-slate-200 text-center w-12">#</th>
                    <th className="p-3.5 border-r border-slate-200 w-28">Incident ID</th>
                    <th className="p-3.5 border-r border-slate-200 w-40">Timestamp</th>
                    <th className="p-3.5 border-r border-slate-200 w-32">Sensor ID</th>
                    <th className="p-3.5 border-r border-slate-200 w-44">Reporter</th>
                    <th className="p-3.5 border-r border-slate-200 w-24">Urgency</th>
                    <th className="p-3.5 border-r border-slate-200 min-w-[200px]">Description</th>
                    <th className="p-3.5 border-r border-slate-200 w-28">Status</th>
                    <th className="p-3.5 border-r border-slate-200 min-w-[150px]">Resolution Note</th>
                    <th className="p-3.5 border-r border-slate-200 min-w-[200px]">AI Action Suggested</th>
                    <th className="p-3.5 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-sans">
                        ไม่มีข้อมูลแถวในขณะนี้ กรุณากรอกแบบรายงานขัดข้องเพื่อเพิ่มข้อมูลลงใน SpreadSheet ครับ
                      </td>
                    </tr>
                  ) : (
                    incidents.map((inc, index) => (
                      <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 border-r border-slate-200 bg-slate-50 text-slate-400 text-center font-bold">
                          {incidents.length - index}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-slate-800">
                          {inc.id}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-[11px] text-slate-400">
                          {new Date(inc.timestamp).toLocaleString('th-TH')}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-bold text-emerald-800">
                          {inc.sensorId}
                        </td>
                        <td className="p-3 border-r border-slate-200 text-slate-700 font-bold">
                          {inc.reporterName}
                        </td>
                        <td className="p-3 border-r border-slate-200">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            inc.urgency === 'High' ? 'bg-rose-100 text-rose-800' :
                            inc.urgency === 'Medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {inc.urgency}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-sans text-xs text-slate-600 line-clamp-3">
                          {inc.description}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            inc.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' :
                            inc.status === 'Investigating' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800 font-bold'
                          }`}>
                            {inc.status}
                          </span>
                        </td>
                        <td className="p-3 border-r border-slate-200 font-sans text-xs text-slate-500 italic max-w-[200px] truncate">
                          {inc.resolutionNote || <span className="text-slate-300 font-mono">N/A</span>}
                        </td>
                        <td className="p-3 border-r border-slate-200 font-sans text-xs text-indigo-900 bg-indigo-50/20">
                          {inc.aiAnalysis?.cause ? (
                            <div>
                              <p className="font-extrabold text-[#111]">🔍 สาเหตุหลัก: {inc.aiAnalysis.cause}</p>
                              <p className="text-[10px] text-indigo-700 mt-1 line-clamp-2" title={inc.aiAnalysis.actionPlan}>
                                ⚠️ แผนแก้ไข: {inc.aiAnalysis.actionPlan?.substring(0, 80)}...
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-300">ไม่มีการวิเคราะห์</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleDeleteReport(inc.id)}
                            title="ลบแถวคอลัมน์ถาวร"
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4 text-[11px] text-slate-400 flex flex-col md:flex-row justify-between items-center gap-2">
              <p>📌 ดีไซน์และหัวข้อได้รับการออกแบบตามคอลัมน์มาตรฐานเพื่อรองรับการดึงข้อมูลจากระบบหลังบ้าน LINE Bot Integration</p>
              <div className="flex gap-4">
                <span>Spreadsheet Status: <strong className="text-emerald-700">Online & Syncing</strong></span>
                <span>Active Server Node: <strong className="text-indigo-700">Google Cloud Run (Sandbox)</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Detailed LINE OA Chat Bot & Push Simulator */}
        {activeTab === 'line' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* L1: High Fidelity Mobile Smartphone frame simulating LINE conversation - 5 span */}
            <div className="lg:col-span-5 max-w-[390px] mx-auto w-full shadow-2xl rounded-[40px] border-[12px] border-slate-800 bg-[#061c30] ring-8 ring-slate-100 overflow-hidden flex flex-col h-[650px] relative">
              
              {/* Phone Status bar */}
              <div className="bg-[#1a1c1d] text-white px-6 py-2.5 flex justify-between items-center text-xs select-none">
                <span className="font-bold">09:41</span>
                {/* Notch */}
                <div className="w-20 h-4 bg-black rounded-b-xl absolute top-0 left-1/2 transform -translate-x-1/2"></div>
                <div className="flex gap-1.5 items-center text-[10px]">
                  <span>LTE</span>
                  <span>95%</span>
                </div>
              </div>

              {/* LINE App Header */}
              <div className="bg-[#24292e] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shadow-md">
                    LINE
                  </div>
                  <div>
                    <h3 className="font-bold text-xs">ห้องแชทช่างวิศวกรโรงงาน (IIoT Group)</h3>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      แจ้งเตือนระบบออนไลน์
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-bold">LineBot</span>
              </div>

              {/* Chat View Message Log Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#8b9bb4]/30 scrollbar-none">
                {chatMessages.map(msg => {
                  const isBot = msg.sender === 'Bot';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[85%] ${isBot ? 'mr-auto items-start' : 'ml-auto items-end text-right'}`}
                    >
                      <span className="text-[9px] text-slate-400 font-extrabold mb-1 px-1">{msg.senderName}</span>
                      
                      {msg.flexCard ? (
                        /* LINE Flex Message Card Layout Simulation */
                        <div className="bg-slate-900 border-2 border-emerald-500 text-white p-4 rounded-2xl shadow-lg w-full text-left font-sans flex flex-col gap-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                            <span className="text-[11px] bg-rose-600 text-white font-black px-2 py-0.5 rounded-md animate-pulse">INCIDENT DETECTED</span>
                            <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                          </div>
                          
                          <div className="space-y-1.5 text-xs">
                            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">ขัดข้องที่จุดตรวจสอบ:</p>
                            <p className="font-extrabold text-sm text-emerald-400">{msg.flexCard.sensor}</p>
                            
                            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mt-2.5">รายละเอียดความชำรุด:</p>
                            <p className="text-slate-200 text-xs text-justify bg-slate-950 p-2.5 rounded-lg border border-slate-800 leading-relaxed italic">{msg.flexCard.desc}</p>
                            
                            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mt-2.5">ระดับภัยขัดข้อง:</p>
                            <span className={`inline-block font-extrabold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                              msg.flexCard.urgency === 'High' ? 'bg-rose-900/40 text-rose-300 border border-rose-800' :
                              msg.flexCard.urgency === 'Medium' ? 'bg-amber-900/40 text-amber-300 border border-amber-800' :
                              'bg-slate-800 text-slate-300'
                            }`}>{msg.flexCard.urgency} Urgent</span>

                            {/* Gemini Diagnosis insight in Flex message */}
                            <div className="bg-indigo-950/70 border border-indigo-900/50 p-2.5 rounded-xl mt-3">
                              <p className="text-indigo-300 font-extrabold text-[10px] flex items-center gap-1">
                                <Sparkles size={11} className="text-indigo-400 fill-indigo-400" />
                                การคาดการณ์สาเหตุ (Gemini AI):
                              </p>
                              <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">{msg.flexCard.aiDiagnostic}</p>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-800 flex gap-2">
                            <button 
                              onClick={() => {
                                alert(`เปิดหน้ารายละเอียดเคสข่าวขัดข้องคืบหน้าสำหรับ LINE OA Webview ID: ${msg.flexCard.sensor}`);
                              }}
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold py-2 rounded-lg text-center cursor-pointer transition-all border border-slate-700"
                            >
                              ตรวจประวัติชีท
                            </button>
                            <button 
                              onClick={() => {
                                const matched = incidents.find(item => item.sensorName === msg.flexCard.sensor);
                                if (matched) {
                                  setSelectedIncident(matched);
                                } else {
                                  alert("โปรดยลข้อมูลที่แท็บแผงควบคุมหลักเพื่อเลือกปรับเคสตัวนี้");
                                }
                              }}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded-lg text-center cursor-pointer transition-all shadow shadow-emerald-950"
                            >
                              ปรับสถานะเคส
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Text LINE Message bubble bubble */
                        <div className={`p-3 rounded-2xl text-xs font-medium max-w-full leading-relaxed ${
                          isBot ? 'bg-white text-slate-800 rounded-tl-none shadow-xs' : 'bg-[#50cf50] text-slate-900 rounded-tr-none shadow-xs'
                        }`}>
                          <p className="whitespace-pre-line">{msg.text}</p>
                          <span className="block text-[8px] text-slate-400 text-right mt-1.5 font-mono">{msg.timestamp}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Chat Send Message form */}
              <form onSubmit={handleSendChatMessage} className="bg-[#1f1f1f] p-2.5 border-t border-slate-800 flex gap-2 shrink-0 items-center">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-slate-900 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-xs focus:outline-none border border-slate-800"
                  placeholder="พิมพ์หารือช่าง, พิมพ์ 'สถานะ' หรือ 'แจ้งซ่อม'..." 
                />
                <button 
                  type="submit"
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white transition-all cursor-pointer shadow-md"
                >
                  <Send size={14} className="stroke-[2.5]" />
                </button>
              </form>
            </div>

            {/* L2: Informative Instructions side column - 7 span */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Feature summary details */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus size={18} className="text-emerald-600 stroke-[2.5]" />
                  หลักการจำลองการตอบกลับแจ้งเตือนผ่านกลุ่ม LINE
                </h3>
                <p className="text-xs text-slate-500 mt-1">นี่คือผังการสื่อสารแบบจำลองเมื่อมีการแจ้งซ่อมจากพนักงานบำรุงในอู่โรงงานจริง</p>

                <div className="mt-6 space-y-4">
                  <div className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0 text-sm">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">ขั้นตอนแจ้งเข้าระบบ:</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">พนักงานโรงงานพิมพ์และกดรายงานผ่านหน้าเว็บบนเบราว์เซอร์ปกติหรือเบราว์เซอร์ LIFT ของแอปพลิเคชัน LINE</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 text-sm">2</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">การคัดกรองฉลาดด้วย Gemini AI (Industrial IoT Expert Mode):</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">ระบบจะรับคำบอกเล่าปัญหา เช่น "ร้อนจัดไหม้เหม็นควัน" แล้วประมวลผลสรุปสาเหตุต้นตอ แผนกู้สถานการณ์ และประเมินระดับภัยความเสี่ยงโดยอัตโนมัติ ไม่ต้องอาศัยวิศวกรผู้เชี่ยวชาญระดับสูงยืนยัน</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0 text-sm">3</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">ส่งข้อความ Flex Card Push:</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">ส่งความคืบหน้าเข้าสู่ระบบกลุ่มชักพาช่างที่ดัดแปลง Webhook URL ไว้เพื่อให้ทำการแจ้งแผนงานแก้ไขปัญหาทันควัน</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111] text-indigo-300 rounded-2xl p-5 mt-6 font-mono text-xs overflow-x-auto space-y-1 shadow-inner relative max-h-[140px]">
                  <span className="absolute top-3 right-3 text-[10px] text-slate-500 uppercase tracking-widest bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded font-bold">Line Webhook Trigger Json</span>
                  <div className="text-slate-400">// API trigger request model structure</div>
                  {"{"}
                  <div>  &quot;to&quot;: &quot;Group_Signal_Operator_ID&quot;,</div>
                  <div>  &quot;messages&quot;: [</div>
                  <div>    {"{"}</div>
                  <div>       &quot;type&quot;: &quot;flex&quot;,</div>
                  <div>       &quot;altText&quot;: &quot;ระดับความจำเป็น: ตรวจพบเซ็นเซอร์เกิดข้อผิดพลาดคลาวด์ซิงก์&quot;,</div>
                  <div>       &quot;contents&quot;: {"{... flex cards container design ...}"}</div>
                  <div>    {"}"}</div>
                  <div>  ]</div>
                  {"}"}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Informative Google Sheets Apps Script How-To Section */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="text-emerald-600" size={24} />
                คู่มือการนำระบบพิมพ์แจ้งซ่อมขึ้นระบบจริง (Production Deployment Guide)
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                เนื่องจาก <strong>LINE Notify ได้ยกเลิกการให้บริการไปตั้งแต่วันที่ 31 มีนาคม 2025</strong> ระบบเวอร์ชันปัจจุบันนี้จึงออกแบบโดยใช้สถาปัตยกรรมยุคใหม่ที่เต็มรูปแบบผ่าน <strong>LIFF (LINE Front-end Framework)</strong> และ <strong>Messaging API</strong> ร่วมกับ <strong>Google Sheets (Google Apps Script)</strong> และ <strong>Gemini AI</strong> เพื่อความเสถียรและยั่งยืนในการทำงาน
              </p>
            </div>

            {/* Announcement Banner regarding LINE Notify Sunset */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col md:flex-row items-start gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-xl shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 flex items-center gap-2">
                  ⚠️ ประกาศสำคัญ: ยุคหลัง LINE Notify ปิดตัว (Post-LINE Notify Era)
                </h3>
                <p className="text-xs text-rose-900/90 leading-relaxed mt-1 font-medium">
                  เพื่อเป็นการทดแทน API เก่า ดำเนินการจริงได้ด้วย 2 วิธีที่ดีกว่าและเสถียรกว่า:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="bg-white/85 border border-rose-100 p-3 rounded-xl text-xs">
                    <p className="font-bold text-rose-950">1. LINE Messaging API (Flex Messages) ✅</p>
                    <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">ใช้บัญชี LINE Official Account (LINE OA) เพื่อพุชข้อความแบบการ์ดสวยงาม (Flex Template) เข้าไปยังกลุ่มงานซ่อมหรือแชทเดี่ยวของช่างฟรี 250 ข้อความแรกต่อเดือน</p>
                  </div>
                  <div className="bg-white/85 border border-rose-100 p-3 rounded-xl text-xs">
                    <p className="font-bold text-rose-950">2. LINE LIFF + Messaging API App ✅</p>
                    <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">ฝังฟอร์มนี้เป็น Rich Menu ของ LINE OA เมื่อพนักงานคลิกปุ่ม "แจ้งซ่อม" หน้าเว็บบราวเซอร์จะจำลองขึ้นมาเป็น Webview ทันที เหมาะกับหน้าสไตล์ Google Form</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Interactive Implementation Flow */}
            <div className="space-y-6">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                🛠️ 4 ขั้นตอนการเซ็ตอัปเพื่อใช้จริง (4-Step Deployment Roadmap)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                
                {/* Step 1 */}
                <div className="border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 space-y-3 bg-slate-50 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs">1</span>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">สร้างคอนโซลบน LINE Developers</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                      1. เข้าไปที่เว็บ <a href="https://developers.line.biz" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline">LINE Developers Console</a><br />
                      2. ลงทะเบียนสมัคร Provider และสร้าง <strong>Messaging API Channel</strong> เพื่อเปิดบอท LINE OA ของคุณ<br />
                      3. สร้าง <strong>LIFF App</strong> ภายในคอนโซล เพื่อดึง ลิงก์ที่แอปนี้รันอยู่ฝังเป็นหน้ากากภายในห้องแชท
                    </p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-800 text-[10px] p-2 rounded-lg font-bold border border-emerald-100">
                    💡 Tips: จะได้รหัส <code>LIFF ID</code> และ <code>Channel Access Token</code> มาใช้งาน
                  </div>
                </div>

                {/* Step 2 */}
                <div className="border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 space-y-3 bg-slate-50 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs">2</span>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">เซ็ตอัป Google Sheet และ Apps Script</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                      1. สร้าง Google Spreadsheet ใหม่ขึ้นมา 1 ตัว<br />
                      2. เลือกเมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong><br />
                      3. คัดลอกและวางโค้ด Apps Script ด่วนดังตัวอย่างขวา เพื่อรับ Webhook การส่งตระกร้าข้อมูลจากฟอร์มหลัก
                    </p>
                  </div>
                  <div className="bg-slate-100 text-slate-600 text-[10px] p-2 rounded-lg font-mono truncate">
                    Spreadsheet URL: docs.google.com/spreadsheets/d/...
                  </div>
                </div>

                {/* Step 3 */}
                <div className="border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 space-y-3 bg-slate-50 transition-colors flex flex-col justify-between md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs">3</span>
                        <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wide">โค้ดส่วนขยายฝั่ง Google Apps Script (Webhook)</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        วางฟังก์ชันนี้ใน Apps Script และกด <strong>"ใช้งานจริง (Deploy) เป็น เว็บแอป (Web App)"</strong> โดยกำหนดให้ผู้เข้าถึงเป็น <strong>"Anyone (ทุกคน)"</strong> เพื่อปลดล็อกให้ API ของเว็บเราโพสต์บันทึกความเสียซ่อมสถิติตรงลง Google Sheets
                      </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 text-indigo-200 p-4 rounded-xl text-[11px] font-mono overflow-y-auto max-h-[150px] leading-relaxed">
{`function doPost(e) {
  // 1. ระบุ ID ของสเปรดชีตจริงของคุณ (ดึงตามแอปหลักของท่าน)
  var ss = SpreadsheetApp.openById("${googleSheetId}");
  var sheet = ss.getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  var timestamp = new Date();
  
  // 2. บันทึกข้อมูลแยกคอลัมน์เหมือนแผงบอร์ดหลัก
  sheet.appendRow([
    data.id || "INCID-" + Date.now().toString().substring(8),
    timestamp,
    data.sensorId,
    data.sensorName,
    data.urgency,
    data.description,
    data.reporterName,
    "Pending", // สถานะเริ่มต้น
    "", // บันทึกจากแอดมิน
    data.aiDiagnostic || "กำลังประเมินด้านเทคนิค..."
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 space-y-3 bg-slate-50 transition-colors flex flex-col justify-between md:col-span-2">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-8">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs">4</span>
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">โฮสต์ซอฟต์แวร์และการกำหนดค่าสภาพแวดล้อม (.env)</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                        นำ Source Code ชุดเต็มนี้ไปโฮสต์จริงบนแพลตฟอร์มคลาวด์ เช่น <strong>Google Cloud Run</strong>, <strong>Vercel</strong>, หรือ <strong>VPC Linux Docker</strong> แล้วกำหนดค่าตัวแปรสภาพแวดล้อมดังนี้:
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>GEMINI_API_KEY</strong><br />
                          คีย์รับการวิเคราะห์แผนซ่อมของ AI
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>GOOGLE_SHEET_WEBHOOK_URL</strong><br />
                          ลิงก์เว็บแอป Apps Script
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>GOOGLE_SHEET_ID</strong><br />
                          ไอดี Google Spreadsheet จริง
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>LINE_CHANNEL_ACCESS_TOKEN</strong><br />
                          รหัส Access Token ของ LINE Bot
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>LINE_TARGET_ID</strong><br />
                          ไอดีกลุ่ม/แชทปลายทางที่จะส่งข้อความหา
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2 md:col-span-1">
                          <strong>FIREBASE_PROJECT_ID</strong><br />
                          ไอดีโปรเจกต์ของ Firebase Database
                        </div>
                        <div className="bg-white border rounded p-2 text-[10px] font-mono col-span-2">
                          <strong>FIREBASE_CLIENT_EMAIL & PRIVATE_KEY</strong><br />
                          ข้อมูล Service Account สำหรับเชื่อมต่อฐานข้อมูล
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-4 bg-indigo-950 text-indigo-100 p-4 rounded-2xl flex flex-col gap-2 h-full justify-between">
                      <div>
                        <span className="text-[9px] bg-indigo-800 uppercase px-2 py-0.5 rounded font-bold font-mono tracking-wider">Production Architecture</span>
                        <p className="text-xs font-bold mt-1">สถาปัตยกรรมระดับองค์กร (Enterprise)</p>
                        <p className="text-[10px] mt-1 text-indigo-200/90 leading-relaxed font-sans font-medium">แอปนี้พร้อมสำหรับการปรับขนาดในระดับการแชร์ที่เสถียร ใช้แบรนดิ้งของตัวเอง ปราศจากค่าสัญญารายเดือน และตอบกลับได้ด้วยความฉลาดระดับแนวหน้าของ Google Gemini</p>
                      </div>
                      <a 
                        href="https://developers.line.biz/th/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] py-1.5 px-3 rounded-lg font-bold text-center transition-all flex items-center justify-center gap-1.5"
                      >
                        📊 เอกสาร LINE API ภาษาไทย <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* Admin Action Modal for Case Status resolution / Investigating */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest bg-slate-200 font-extrabold px-2.5 py-1 rounded text-slate-500">
                  ADMIN INCIDENT MANAGER
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-2 flex items-center gap-1.5">
                  🔧 อัปเดตความคืบหน้ากรณี: [{selectedIncident.id}]
                </h3>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 max-h-[450px]">
              
              {/* Detailed incident statistics representation */}
              <div className="grid grid-cols-2 gap-3.5 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">พิกัดเสื่อมเสีย / เซ็นเซอร์:</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedIncident.sensorName}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">ผู้แจ้งซ่อม / ทีม LINE:</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedIncident.reporterName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">อธิบายปัญหา:</p>
                  <p className="text-slate-600 mt-1 text-justify font-medium leading-relaxed bg-white border border-slate-200 p-2.5 rounded-xl">{selectedIncident.description}</p>
                </div>
              </div>

              {/* Gemini AI diagnostic assessment inside resolution modal */}
              {selectedIncident.aiAnalysis?.cause && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl space-y-2">
                  <h4 className="text-xs font-extrabold text-indigo-900 flex items-center gap-1">
                    <Sparkles size={11} className="fill-indigo-500 text-indigo-500" />
                    แผนการประเมินวิจัยของ AI (Gemini Expert Plan)
                  </h4>
                  <div>
                    <p className="text-[11px] font-bold text-indigo-800">สาเหตุที่เป็นไปได้:</p>
                    <p className="text-xs text-slate-700 leading-relaxed font-semibold mt-0.5">{selectedIncident.aiAnalysis.cause}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-indigo-800">แผนแนะนำช่างปฏิบัติงาน:</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-line mt-1 p-2 bg-white/70 rounded-xl border border-indigo-100">
                      {selectedIncident.aiAnalysis.actionPlan}
                    </p>
                  </div>
                </div>
              )}

              {/* Resolution Form input fields */}
              <div className="space-y-2.5 pt-2">
                <label className="text-xs font-extrabold text-slate-400 uppercase tracking-widest block">
                  บันทึกความคืบหน้า / วิธีการแก้ไข (Resolution notes)
                </label>
                <textarea 
                  rows={3}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none font-medium leading-relaxed"
                  placeholder="กรุณาระบุรายละเอียดการดำเนินการ เช่น ช่างเข้าตรวจแล้ว, รีเซ็ตวงจรแล้ว, เปลี่ยนหัววัดเซ็นเซอร์ใหม่..."
                ></textarea>
              </div>

            </div>

            {/* Modal Footer with Actions */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2 shrink-0 justify-end">
              <button 
                onClick={() => handleUpdateStatus(selectedIncident.id, 'Investigating', resolutionText)}
                disabled={resolving}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer border border-amber-300"
              >
                กำลังสืบสวนตรวจค้น
              </button>
              <button 
                onClick={() => handleUpdateStatus(selectedIncident.id, 'Resolved', resolutionText)}
                disabled={resolving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-200 cursor-pointer flex items-center gap-1.5"
              >
                <span>แก้ไขปัญหาเสร็จสิ้น (Resolved)</span>
                <CheckCircle2 size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Primary Sticky Footer Detail */}
      <footer id="main-footer" className="h-12 bg-slate-800 flex flex-col md:flex-row items-center justify-between px-6 text-[10px] uppercase tracking-widest font-bold text-slate-400 shrink-0 gap-1.5 py-2 md:py-0">
        <p>SECURE ENTERPRISE INCIDENT REPORTING SYSTEM v4.2.1</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> 
            Line Webhook Connected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> 
            Spreadsheet ID Sync Active
          </span>
        </div>
      </footer>

    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

const ADMIN_CREDS = { username: "admin", password: "Admin@123" };
const OFFICE_RADIUS_METERS = 200;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const INIT_EMPLOYEES = [
  { id: 1, name: "Rahul Sharma",  role: "Developer",  username: "rahul",  password: "rahul123",  phone: "9876543210", joinDate: "2024-01-15", totalLeaves: 18, avatar: "RS" },
  { id: 2, name: "Priya Singh",   role: "Designer",   username: "priya",  password: "priya123",  phone: "9876543211", joinDate: "2024-03-01", totalLeaves: 18, avatar: "PS" },
  { id: 3, name: "Amit Kumar",    role: "Manager",    username: "amit",   password: "amit123",   phone: "9876543212", joinDate: "2023-06-10", totalLeaves: 24, avatar: "AK" },
];
const INIT_OFFICE = { lat: 28.6139, lng: 77.2090, name: "Head Office, Delhi", radius: OFFICE_RADIUS_METERS };
const INIT_REMINDERS = [
  { id: 1, empId: 1, title: "Appraisal Review",  date: "2026-03-20", note: "Quarterly review baaki hai",  seen: false },
  { id: 2, empId: 3, title: "Leave Approval",     date: "2026-03-15", note: "3 din ki leave pending",       seen: false },
];
const INIT_LEAVES = [
  { id: 1, empId: 2, from: "2026-03-10", to: "2026-03-12", reason: "Family function", status: "pending"  },
  { id: 2, empId: 1, from: "2026-03-05", to: "2026-03-06", reason: "Medical",         status: "approved" },
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function isWeekend(y, m, d) { const day = new Date(y,m,d).getDay(); return day===0||day===6; }
function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}
function dateLabel(str) {
  if (!str) return "";
  const [y,m,d] = str.split("-");
  return `${d} ${MONTHS_SHORT[parseInt(m)-1]} ${y}`;
}
function leaveDays(from, to) {
  if (!from||!to) return 0;
  return Math.ceil((new Date(to)-new Date(from))/(86400000))+1;
}
function getMonthStats(empId, attendanceMap, year, month) {
  const empAtt = attendanceMap[empId] || {};
  const total = daysInMonth(year, month);
  let working=0, present=0, absent=0, leave=0, halfday=0;
  for (let d=1; d<=total; d++) {
    if (!isWeekend(year,month,d)) {
      working++;
      const key=`${year}-${month}-${d}`;
      const s=empAtt[key];
      if(s==="P") present++;
      else if(s==="A") absent++;
      else if(s==="L") leave++;
      else if(s==="H") halfday++;
    }
  }
  return { working, present, absent, leave, halfday };
}
function usedApprovedLeaves(empId, leaveApps) {
  return leaveApps.filter(l=>l.empId===empId&&l.status==="approved")
    .reduce((acc,l)=>acc+leaveDays(l.from,l.to),0);
}

const C = {
  bg:"#080c14", surface:"#0e1422", card:"#131928", border:"#1e2840",
  accent:"#3b82f6", purple:"#8b5cf6", green:"#22c55e", red:"#ef4444",
  amber:"#f59e0b", cyan:"#06b6d4", text:"#e2e8f0", muted:"#64748b", dim:"#334155",
};
const btn = (color="#3b82f6", ghost=false) => ({
  background: ghost ? "transparent" : color,
  border: `1.5px solid ${color}`,
  color: ghost ? color : "#fff",
  borderRadius: 10, padding: "9px 20px", fontWeight: 700,
  fontSize: 13, cursor: "pointer", letterSpacing: 0.3, transition: "all .15s",
});
const inp = {
  background: "#0a0f1a", border: `1.5px solid #1e2840`, color: "#e2e8f0",
  borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none",
  width: "100%", boxSizing: "border-box",
};

function Chip({ label }) {
  const map = {
    approved:"#14532d|#4ade80", pending:"#78350f|#fbbf24", rejected:"#450a0a|#f87171",
    APPROVED:"#14532d|#4ade80", PENDING:"#78350f|#fbbf24", REJECTED:"#450a0a|#f87171",
    P:"#14532d|#4ade80", A:"#450a0a|#f87171", L:"#1e3a5f|#60a5fa", H:"#3b1f6b|#c084fc"
  };
  const [bg, fg] = (map[label]||"#1e2840|#94a3b8").split("|");
  return <span style={{ background:bg, color:fg, borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{label}</span>;
}

function Avatar({ initials, size=38, gradient="linear-gradient(135deg,#3b82f6,#8b5cf6)" }) {
  return <div style={{ width:size, height:size, borderRadius:size*0.28, background:gradient, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:size*0.38, color:"#fff", flexShrink:0 }}>{initials}</div>;
}

export default function App() {
  const today = new Date();
  const [session, setSession] = useState(null);
  const [employees, setEmployees] = useState(INIT_EMPLOYEES);
  const [attendance, setAttendance] = useState({});
  const [reminders, setReminders] = useState(INIT_REMINDERS);
  const [leaveApps, setLeaveApps] = useState(INIT_LEAVES);
  const [officeConfig, setOfficeConfig] = useState(INIT_OFFICE);

  const markAtt = (empId, year, month, day, status) => {
    const key=`${year}-${month}-${day}`;
    setAttendance(prev=>({ ...prev, [empId]:{ ...(prev[empId]||{}), [key]:status } }));
  };

  if (!session) return <LoginScreen employees={employees} onLogin={setSession} />;
  if (session.role === "admin")
    return <AdminPanel employees={employees} setEmployees={setEmployees}
      attendance={attendance} markAtt={markAtt}
      reminders={reminders} setReminders={setReminders}
      leaveApps={leaveApps} setLeaveApps={setLeaveApps}
      officeConfig={officeConfig} setOfficeConfig={setOfficeConfig}
      onLogout={()=>setSession(null)} today={today} />;
  return <EmployeePanel emp={session.emp} employees={employees}
    attendance={attendance} markAtt={markAtt}
    reminders={reminders.filter(r=>r.empId===session.emp.id)} setReminders={setReminders}
    leaveApps={leaveApps} setLeaveApps={setLeaveApps}
    officeConfig={officeConfig} onLogout={()=>setSession(null)} today={today} />;
}

function LoginScreen({ employees, onLogin }) {
  const [mode, setMode] = useState("choose");
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const loginAdmin = () => {
    if (uname===ADMIN_CREDS.username && pass===ADMIN_CREDS.password) onLogin({role:"admin"});
    else setErr("Galat username ya password!");
  };
  const loginEmp = () => {
    const emp = employees.find(e=>e.username===uname && e.password===pass);
    if (emp) onLogin({role:"employee", emp});
    else setErr("Galat credentials!");
  };
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(59,130,246,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.04) 1px,transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:420, padding:24, position:"relative" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px", boxShadow:"0 0 40px #3b82f666" }}>🏢</div>
          <div style={{ fontWeight:800, fontSize:22, color:C.text }}>Office Manager Pro</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Attendance · Leaves · Reminders</div>
        </div>
        {mode==="choose" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <button onClick={()=>setMode("admin")} style={{ ...btn(C.accent), padding:"16px", fontSize:15, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>🛡️</span> Super Admin Login
            </button>
            <button onClick={()=>setMode("employee")} style={{ ...btn(C.purple), padding:"16px", fontSize:15, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>👤</span> Employee Login
            </button>
          </div>
        )}
        {(mode==="admin"||mode==="employee") && (
          <div style={{ background:C.card, borderRadius:18, padding:28, border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:22 }}>
              <button onClick={()=>{setMode("choose");setErr("");setUname("");setPass("");}} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>←</button>
              <span style={{ fontWeight:700, fontSize:16, color:C.text }}>{mode==="admin"?"🛡️ Super Admin":"👤 Employee"} Login</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:5, fontWeight:600 }}>USERNAME</div>
                <input style={inp} placeholder={mode==="admin"?"admin":"aapka username"} value={uname} onChange={e=>{setUname(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&(mode==="admin"?loginAdmin():loginEmp())} />
              </div>
              <div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:5, fontWeight:600 }}>PASSWORD</div>
                <input style={inp} type="password" placeholder="••••••••" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&(mode==="admin"?loginAdmin():loginEmp())} />
              </div>
              {err && <div style={{ background:"#450a0a", border:"1px solid #ef4444", borderRadius:8, padding:"8px 12px", color:"#f87171", fontSize:13 }}>⚠️ {err}</div>}
              <button onClick={mode==="admin"?loginAdmin:loginEmp} style={{ ...btn(mode==="admin"?C.accent:C.purple), padding:"13px", fontSize:15, borderRadius:12, marginTop:4 }}>Login →</button>
              {mode==="employee" && <div style={{ fontSize:12, color:C.muted, textAlign:"center" }}>Demo: rahul / rahul123 | priya / priya123</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel({ employees,setEmployees,attendance,markAtt,reminders,setReminders,leaveApps,setLeaveApps,officeConfig,setOfficeConfig,onLogout,today }) {
  const [tab, setTab] = useState("dashboard");
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selEmp, setSelEmp] = useState(employees[0]?.id);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [newEmp, setNewEmp] = useState({ name:"",role:"",username:"",password:"",phone:"",joinDate:"",totalLeaves:18 });
  const [showAddRem, setShowAddRem] = useState(false);
  const [newRem, setNewRem] = useState({ empId:"",title:"",date:"",note:"" });
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [newLeave, setNewLeave] = useState({ empId:"",from:"",to:"",reason:"" });
  const [editOffice, setEditOffice] = useState(false);
  const [officeDraft, setOfficeDraft] = useState(officeConfig);
  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"⊞" },
    { id:"attendance", label:"Attendance", icon:"✓" },
    { id:"leaves", label:"Leaves", icon:"🗓" },
    { id:"reminders", label:"Reminders", icon:"🔔" },
    { id:"employees", label:"Employees", icon:"👥" },
    { id:"settings", label:"Settings", icon:"⚙️" },
  ];
  const todayReminders = reminders.filter(r=>r.date===todayStr());
  const pendingLeaves = leaveApps.filter(l=>l.status==="pending");
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.text }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏢</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>Office Manager Pro</div>
            <div style={{ fontSize:11, color:C.muted }}>Super Admin Panel</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {todayReminders.length>0 && <span style={{ background:C.purple, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>🔔 {todayReminders.length}</span>}
          {pendingLeaves.length>0 && <span style={{ background:C.amber, color:"#000", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>⏳ {pendingLeaves.length}</span>}
          <div style={{ fontSize:12, color:C.muted, background:C.card, padding:"6px 12px", borderRadius:20, border:`1px solid ${C.border}` }}>📅 {today.toDateString()}</div>
          <button onClick={onLogout} style={{ ...btn(C.red, true), padding:"6px 14px", fontSize:12 }}>Logout</button>
        </div>
      </div>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", overflowX:"auto" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"13px 18px", background:"none", border:"none", color:tab===t.id?C.accent:C.muted, fontWeight:tab===t.id?700:400, fontSize:13, cursor:"pointer", borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding:20, maxWidth:1100, margin:"0 auto" }}>
        {tab==="dashboard" && (
          <div>
            <h2 style={{ fontWeight:800, fontSize:20, marginBottom:20 }}>📊 Overview</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:24 }}>
              {[
                {l:"Total Staff", v:employees.length, c:C.accent, icon:"👥"},
                {l:"Pending Leaves", v:pendingLeaves.length, c:C.red, icon:"⏳"},
                {l:"Reminders", v:reminders.filter(r=>new Date(r.date)>=today).length, c:C.purple, icon:"🔔"},
              ].map((s,i)=>(
                <div key={i} style={{ background:C.card, borderRadius:14, padding:"18px 14px", border:`1px solid ${C.border}`, textAlign:"center" }}>
                  <div style={{ fontSize:24 }}>{s.icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:s.c, marginTop:4 }}>{s.v}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {todayReminders.length>0 && (
              <div style={{ background:"#1a0d3a", border:`1px solid ${C.purple}`, borderRadius:14, padding:16, marginBottom:20 }}>
                <div style={{ fontWeight:700, color:C.purple, marginBottom:10 }}>🔔 Aaj ke Reminders</div>
                {todayReminders.map(r=>{
                  const emp=employees.find(e=>e.id===r.empId);
                  return <div key={r.id} style={{ background:"#120a2a", borderRadius:8, padding:"10px 14px", marginBottom:6, fontSize:13 }}>
                    <span style={{ fontWeight:600, color:C.text }}>{emp?.name}</span> — <span style={{ color:C.purple }}>{r.title}</span>: {r.note}
                  </div>;
                })}
              </div>
            )}
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, fontWeight:700, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>👥 Staff — {MONTHS_SHORT[viewMonth]} {viewYear}</span>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}} style={{ ...btn(C.dim,true), padding:"4px 10px" }}>◀</button>
                  <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}} style={{ ...btn(C.dim,true), padding:"4px 10px" }}>▶</button>
                </div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:C.surface }}>
                      {["Naam","Role","Working","Present","Absent","Leave","Half-day","Leaves Left"].map(h=>(
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:12, color:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp=>{
                      const s = getMonthStats(emp.id,attendance,viewYear,viewMonth);
                      const ul = usedApprovedLeaves(emp.id,leaveApps);
                      const rem = emp.totalLeaves - ul;
                      return (
                        <tr key={emp.id} style={{ borderTop:`1px solid ${C.border}`, cursor:"pointer" }} onClick={()=>{setSelEmp(emp.id);setTab("attendance");}}>
                          <td style={{ padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Avatar initials={emp.avatar} size={30}/><span style={{ fontWeight:600 }}>{emp.name}</span></div></td>
                          <td style={{ padding:"12px 14px", color:C.muted, fontSize:13 }}>{emp.role}</td>
                          <td style={{ padding:"12px 14px", color:C.accent, fontWeight:700 }}>{s.working}</td>
                          <td style={{ padding:"12px 14px", color:C.green, fontWeight:700 }}>{s.present}</td>
                          <td style={{ padding:"12px 14px", color:C.red, fontWeight:700 }}>{s.absent}</td>
                          <td style={{ padding:"12px 14px", color:C.amber, fontWeight:700 }}>{s.leave}</td>
                          <td style={{ padding:"12px 14px", color:C.purple, fontWeight:700 }}>{s.halfday}</td>
                          <td style={{ padding:"12px 14px" }}><Chip label={String(rem)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {tab==="attendance" && <AdminAttendance employees={employees} attendance={attendance} markAtt={markAtt} viewMonth={viewMonth} setViewMonth={setViewMonth} viewYear={viewYear} setViewYear={setViewYear} selEmp={selEmp} setSelEmp={setSelEmp} today={today} />}
        {tab==="leaves" && <AdminLeaves employees={employees} leaveApps={leaveApps} setLeaveApps={setLeaveApps} showForm={showLeaveForm} setShowForm={setShowLeaveForm} newLeave={newLeave} setNewLeave={setNewLeave} />}
        {tab==="reminders" && <AdminReminders employees={employees} reminders={reminders} setReminders={setReminders} showForm={showAddRem} setShowForm={setShowAddRem} newRem={newRem} setNewRem={setNewRem} today={today} />}
        {tab==="employees" && <AdminEmployees employees={employees} setEmployees={setEmployees} attendance={attendance} leaveApps={leaveApps} viewMonth={viewMonth} viewYear={viewYear} showForm={showAddEmp} setShowForm={setShowAddEmp} newEmp={newEmp} setNewEmp={setNewEmp} />}
        {tab==="settings" && (
          <div>
            <h2 style={{ fontWeight:800, fontSize:20, marginBottom:20 }}>⚙️ Office Location Settings</h2>
            <div style={{ background:C.card, borderRadius:14, padding:24, border:`1px solid ${C.border}`, maxWidth:520 }}>
              <div style={{ fontWeight:700, marginBottom:18, color:C.accent }}>📍 Office GPS Coordinates</div>
              {!editOffice ? (
                <div>
                  <div style={{ marginBottom:10 }}><span style={{ color:C.muted, fontSize:12 }}>Office Naam</span><div style={{ fontWeight:600, marginTop:3 }}>{officeConfig.name}</div></div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                    <div><span style={{ color:C.muted, fontSize:12 }}>Latitude</span><div style={{ fontWeight:700, color:C.accent }}>{officeConfig.lat}</div></div>
                    <div><span style={{ color:C.muted, fontSize:12 }}>Longitude</span><div style={{ fontWeight:700, color:C.accent }}>{officeConfig.lng}</div></div>
                    <div><span style={{ color:C.muted, fontSize:12 }}>Radius (m)</span><div style={{ fontWeight:700, color:C.green }}>{officeConfig.radius}m</div></div>
                  </div>
                  <button onClick={()=>{setOfficeDraft(officeConfig);setEditOffice(true);}} style={btn(C.accent)}>Edit Location</button>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {[["Office Naam","name","text"],["Latitude","lat","number"],["Longitude","lng","number"],["Allowed Radius (meters)","radius","number"]].map(([label,key,type])=>(
                    <div key={key}>
                      <div style={{ fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>{label}</div>
                      <input type={type} style={inp} value={officeDraft[key]} onChange={e=>setOfficeDraft({...officeDraft,[key]:type==="number"?parseFloat(e.target.value):e.target.value})} />
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:10, marginTop:4 }}>
                    <button onClick={()=>{setOfficeConfig(officeDraft);setEditOffice(false);}} style={btn(C.green)}>✓ Save</button>
                    <button onClick={()=>setEditOffice(false)} style={btn(C.dim,true)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminAttendance({ employees,attendance,markAtt,viewMonth,setViewMonth,viewYear,setViewYear,selEmp,setSelEmp,today }) {
  const emp = employees.find(e=>e.id===selEmp);
  const empAtt = (attendance[selEmp]||{});
  const days = daysInMonth(viewYear,viewMonth);
  const firstDay = new Date(viewYear,viewMonth,1).getDay();
  const s = emp ? getMonthStats(emp.id,attendance,viewYear,viewMonth) : {};
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ fontWeight:800, fontSize:20 }}>✅ Attendance</h2>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}} style={{ ...btn(C.dim,true), padding:"6px 12px" }}>◀</button>
          <span style={{ fontWeight:700, minWidth:110, textAlign:"center" }}>{MONTHS_SHORT[viewMonth]} {viewYear}</span>
          <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}} style={{ ...btn(C.dim,true), padding:"6px 12px" }}>▶</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {employees.map(e=>(
          <button key={e.id} onClick={()=>setSelEmp(e.id)} style={{ padding:"7px 16px", borderRadius:20, background:selEmp===e.id?"linear-gradient(135deg,#3b82f6,#8b5cf6)":C.card, border:`1px solid ${selEmp===e.id?C.accent:C.border}`, color:selEmp===e.id?"#fff":C.muted, fontWeight:selEmp===e.id?700:400, cursor:"pointer", fontSize:13 }}>{e.name}</button>
        ))}
      </div>
      {emp && (
        <>
          <div style={{ display:"flex", gap:12, marginBottom:18, flexWrap:"wrap" }}>
            {[{l:"Working",v:s.working,c:C.accent},{l:"Present",v:s.present,c:C.green},{l:"Absent",v:s.absent,c:C.red},{l:"Leave",v:s.leave,c:C.amber},{l:"Half-day",v:s.halfday,c:C.purple}].map((x,i)=>(
              <div key={i} style={{ background:C.card, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.border}`, textAlign:"center", minWidth:80 }}>
                <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
                <div style={{ fontSize:11, color:C.muted }}>{x.l}</div>
              </div>
            ))}
          </div>
          <div style={{ background:C.card, borderRadius:14, padding:18, border:`1px solid ${C.border}` }}>
            <div style={{ fontWeight:700, marginBottom:14 }}>{emp.name} — {MONTHS[viewMonth]} {viewYear}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:6 }}>
              {WEEKDAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:11, color:C.muted, fontWeight:600, padding:"4px 0" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
              {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i}/>)}
              {Array.from({length:days},(_,i)=>i+1).map(day=>{
                const key=`${viewYear}-${viewMonth}-${day}`;
                const status=empAtt[key];
                const weekend=isWeekend(viewYear,viewMonth,day);
                const isToday=day===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
                const colorMap={P:"#22c55e",A:"#ef4444",L:"#3b82f6",H:"#8b5cf6"};
                return (
                  <div key={day} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:11, color:isToday?C.accent:weekend?C.dim:C.text, fontWeight:isToday?800:400, marginBottom:2 }}>{day}</div>
                    {weekend ? (
                      <div style={{ height:30, borderRadius:6, background:C.surface, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:C.dim }}>OFF</div>
                    ) : (
                      <select value={status||""} onChange={e=>markAtt(selEmp,viewYear,viewMonth,day,e.target.value)} style={{ width:"100%", height:30, borderRadius:6, border:`1px solid ${status?colorMap[status]:C.border}`, background:status?`${colorMap[status]}22`:C.surface, color:status?colorMap[status]:C.muted, fontSize:12, cursor:"pointer", outline:"none" }}>
                        <option value="">—</option>
                        <option value="P">P</option>
                        <option value="A">A</option>
                        <option value="L">L</option>
                        <option value="H">H</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:16, marginTop:14, fontSize:12, flexWrap:"wrap" }}>
              {[["P","Present",C.green],["A","Absent",C.red],["L","Leave",C.accent],["H","Half-day",C.purple]].map(([k,l,c])=>(
                <span key={k} style={{ color:c }}>● {k} — {l}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AdminLeaves({ employees,leaveApps,setLeaveApps,showForm,setShowForm,newLeave,setNewLeave }) {
  const submit = () => {
    if(!newLeave.empId||!newLeave.from||!newLeave.to) return;
    setLeaveApps(prev=>[...prev,{...newLeave,id:Date.now(),empId:Number(newLeave.empId),status:"pending"}]);
    setNewLeave({empId:"",from:"",to:"",reason:""});
    setShowForm(false);
  };
  const setStatus = (id,status) => setLeaveApps(prev=>prev.map(l=>l.id===id?{...l,status}:l));
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20 }}>🗓 Leave Management</h2>
        <button onClick={()=>setShowForm(true)} style={btn(C.accent)}>+ Leave Apply</button>
      </div>
      {showForm && (
        <div style={{ background:C.card, borderRadius:14, padding:20, marginBottom:20, border:`1px solid ${C.accent}` }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>New Leave Application</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            <select value={newLeave.empId} onChange={e=>setNewLeave({...newLeave,empId:e.target.value})} style={inp}>
              <option value="">Employee</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="date" style={inp} value={newLeave.from} onChange={e=>setNewLeave({...newLeave,from:e.target.value})} />
            <input type="date" style={inp} value={newLeave.to} onChange={e=>setNewLeave({...newLeave,to:e.target.value})} />
            <input style={inp} placeholder="Reason" value={newLeave.reason} onChange={e=>setNewLeave({...newLeave,reason:e.target.value})} />
          </div>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={submit} style={btn(C.green)}>Submit</button>
            <button onClick={()=>setShowForm(false)} style={btn(C.dim,true)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:24 }}>
        {employees.map(emp=>{
          const ul = usedApprovedLeaves(emp.id,leaveApps);
          const rem = emp.totalLeaves-ul;
          const pct = Math.round((ul/emp.totalLeaves)*100);
          return (
            <div key={emp.id} style={{ background:C.card, borderRadius:14, padding:18, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <Avatar initials={emp.avatar} size={34} />
                <div><div style={{ fontWeight:700 }}>{emp.name}</div><div style={{ fontSize:12, color:C.muted }}>{emp.role}</div></div>
              </div>
              <div style={{ height:5, borderRadius:10, background:C.border, marginBottom:8 }}>
                <div style={{ height:"100%", borderRadius:10, width:`${Math.min(pct,100)}%`, background:pct>80?C.red:pct>50?C.amber:C.green }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                <span style={{ color:C.red }}>Used: {ul}</span>
                <span style={{ color:C.green }}>Left: {rem}</span>
                <span style={{ color:C.muted }}>/{emp.totalLeaves}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, fontWeight:700 }}>Leave Applications</div>
        {leaveApps.length===0 && <div style={{ padding:30, textAlign:"center", color:C.muted }}>Koi application nahi</div>}
        {leaveApps.map(l=>{
          const emp=employees.find(e=>e.id===l.empId);
          return (
            <div key={l.id} style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontWeight:600 }}>{emp?.name} <span style={{ color:C.muted, fontWeight:400, fontSize:13 }}>({emp?.role})</span></div>
                <div style={{ fontSize:13, color:C.muted }}>{dateLabel(l.from)} → {dateLabel(l.to)} · {leaveDays(l.from,l.to)} din · {l.reason}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {l.status==="pending" ? (
                  <>
                    <button onClick={()=>setStatus(l.id,"approved")} style={{ ...btn(C.green), padding:"5px 14px" }}>✓ Approve</button>
                    <button onClick={()=>setStatus(l.id,"rejected")} style={{ ...btn(C.red), padding:"5px 14px" }}>✗ Reject</button>
                  </>
                ) : <Chip label={l.status.toUpperCase()} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminReminders({ employees,reminders,setReminders,showForm,setShowForm,newRem,setNewRem,today }) {
  const submit = () => {
    if(!newRem.empId||!newRem.title||!newRem.date) return;
    setReminders(prev=>[...prev,{...newRem,id:Date.now(),empId:Number(newRem.empId),seen:false}]);
    setNewRem({empId:"",title:"",date:"",note:""});
    setShowForm(false);
  };
  const upcoming = [...reminders].sort((a,b)=>new Date(a.date)-new Date(b.date));
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20 }}>🔔 Reminders</h2>
        <button onClick={()=>setShowForm(true)} style={btn(C.purple)}>+ Add Reminder</button>
      </div>
      {showForm && (
        <div style={{ background:C.card, borderRadius:14, padding:20, marginBottom:20, border:`1px solid ${C.purple}` }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>New Reminder</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            <select value={newRem.empId} onChange={e=>setNewRem({...newRem,empId:e.target.value})} style={inp}>
              <option value="">Employee</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input style={inp} placeholder="Title" value={newRem.title} onChange={e=>setNewRem({...newRem,title:e.target.value})} />
            <input type="date" style={inp} value={newRem.date} onChange={e=>setNewRem({...newRem,date:e.target.value})} />
            <input style={inp} placeholder="Note (optional)" value={newRem.note} onChange={e=>setNewRem({...newRem,note:e.target.value})} />
          </div>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={submit} style={btn(C.purple)}>Save</button>
            <button onClick={()=>setShowForm(false)} style={btn(C.dim,true)}>Cancel</button>
          </div>
        </div>
      )}
      {upcoming.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:40 }}>Koi reminder nahi hai</div>}
      {upcoming.map(r=>{
        const emp=employees.find(e=>e.id===r.empId);
        const isToday2=r.date===todayStr();
        return (
          <div key={r.id} style={{ background:C.card, borderRadius:12, padding:"16px 18px", marginBottom:10, border:`1px solid ${isToday2?C.purple:C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div>
              {isToday2 && <span style={{ background:C.purple, color:"#fff", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700, marginRight:8 }}>TODAY</span>}
              <span style={{ fontWeight:700 }}>{r.title}</span>
              <div style={{ fontSize:13, color:C.muted, marginTop:4 }}><span style={{ color:C.accent, fontWeight:600 }}>{emp?.name}</span> — {r.note||"No note"}</div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 12px", fontSize:13, color:C.accent }}>📅 {dateLabel(r.date)}</span>
              <button onClick={()=>setReminders(prev=>prev.filter(x=>x.id!==r.id))} style={{ ...btn(C.red,true), padding:"5px 10px" }}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminEmployees({ employees,setEmployees,attendance,leaveApps,viewMonth,viewYear,showForm,setShowForm,newEmp,setNewEmp }) {
  const submit = () => {
    if(!newEmp.name||!newEmp.username||!newEmp.password) return;
    setEmployees(prev=>[...prev,{...newEmp,id:Date.now(),totalLeaves:Number(newEmp.totalLeaves),avatar:newEmp.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}]);
    setNewEmp({name:"",role:"",username:"",password:"",phone:"",joinDate:"",totalLeaves:18});
    setShowForm(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20 }}>👥 Employees</h2>
        <button onClick={()=>setShowForm(true)} style={btn(C.green)}>+ Add Employee</button>
      </div>
      {showForm && (
        <div style={{ background:C.card, borderRadius:14, padding:20, marginBottom:20, border:`1px solid ${C.green}` }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>New Employee</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            {[["Naam","name","text"],["Role","role","text"],["Username","username","text"],["Password","password","text"],["Phone","phone","tel"],["Join Date","joinDate","date"]].map(([label,key,type])=>(
              <div key={key}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>{label}</div>
                <input type={type} style={inp} value={newEmp[key]} onChange={e=>setNewEmp({...newEmp,[key]:e.target.value})} />
              </div>
            ))}
            <div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:4, fontWeight:600 }}>Total Leaves/Year</div>
              <input type="number" style={inp} value={newEmp.totalLeaves} onChange={e=>setNewEmp({...newEmp,totalLeaves:e.target.value})} />
            </div>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={submit} style={btn(C.green)}>Add Karo</button>
            <button onClick={()=>setShowForm(false)} style={btn(C.dim,true)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
        {employees.map(emp=>{
          const s = getMonthStats(emp.id,attendance,viewYear,viewMonth);
          const ul = usedApprovedLeaves(emp.id,leaveApps);
          const rem = emp.totalLeaves-ul;
          return (
            <div key={emp.id} style={{ background:C.card, borderRadius:14, padding:20, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <Avatar initials={emp.avatar} size={44} />
                <div><div style={{ fontWeight:700, fontSize:15 }}>{emp.name}</div><div style={{ fontSize:12, color:C.accent }}>{emp.role}</div></div>
              </div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:3 }}>📞 {emp.phone}</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:3 }}>🔑 @{emp.username}</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>📅 Joined: {dateLabel(emp.joinDate)}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
                {[["Present",s.present,C.green],["Absent",s.absent,C.red],["Leaves",rem,C.purple]].map(([l,v,c])=>(
                  <div key={l} style={{ background:C.surface, borderRadius:8, padding:"8px 0", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{l}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setEmployees(prev=>prev.filter(e=>e.id!==emp.id))} style={{ ...btn(C.red,true), width:"100%", padding:"7px 0" }}>Remove</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmployeePanel({ emp,employees,attendance,markAtt,reminders,setReminders,leaveApps,setLeaveApps,officeConfig,onLogout,today }) {
  const [tab, setTab] = useState("home");
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const myLeaves = leaveApps.filter(l=>l.empId===emp.id);
  const myAtt = attendance[emp.id]||{};
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todayStatus = myAtt[todayKey];
  const unreadRem = reminders.filter(r=>!r.seen);
  const tabs = [
    { id:"home", label:"Home", icon:"🏠" },
    { id:"selfie", label:"Attendance", icon:"📸" },
    { id:"leaves", label:"Leaves", icon:"🗓" },
    { id:"reminders", label:"Reminders", icon:"🔔" },
    { id:"profile", label:"Profile", icon:"👤" },
  ];
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.text }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Avatar initials={emp.avatar} size={36} />
          <div><div style={{ fontWeight:700, fontSize:14 }}>{emp.name}</div><div style={{ fontSize:11, color:C.muted }}>{emp.role}</div></div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {unreadRem.length>0 && <span style={{ background:C.purple, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>🔔 {unreadRem.length}</span>}
          <button onClick={onLogout} style={{ ...btn(C.red,true), padding:"6px 14px", fontSize:12 }}>Logout</button>
        </div>
      </div>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", overflowX:"auto" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{ setTab(t.id); if(t.id==="reminders") setReminders(prev=>prev.map(r=>({...r,seen:true}))); }} style={{ padding:"13px 16px", background:"none", border:"none", color:tab===t.id?C.accent:C.muted, fontWeight:tab===t.id?700:400, fontSize:13, cursor:"pointer", borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding:20, maxWidth:700, margin:"0 auto" }}>
        {tab==="home" && (
          <div>
            <div style={{ background:"linear-gradient(135deg,#0f2044,#1a0d3a)", borderRadius:18, padding:24, marginBottom:20, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>Namaste 👋</div>
              <div style={{ fontWeight:800, fontSize:22 }}>{emp.name}</div>
              <div style={{ fontSize:13, color:C.accent, marginBottom:16 }}>{emp.role}</div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:13, color:C.muted }}>Aaj ka status:</span>
                {todayStatus ? <Chip label={todayStatus==="P"?"Present":todayStatus==="A"?"Absent":todayStatus==="L"?"Leave":"Half-Day"} /> : <span style={{ fontSize:13, color:C.amber }}>⏳ Abhi mark nahi hua</span>}
              </div>
            </div>
            {(() => {
              const s = getMonthStats(emp.id,attendance,viewYear,viewMonth);
              const ul = usedApprovedLeaves(emp.id,leaveApps);
              const rem = emp.totalLeaves-ul;
              return (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div style={{ fontWeight:700 }}>{MONTHS_SHORT[viewMonth]} {viewYear}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}} style={{ ...btn(C.dim,true), padding:"4px 10px", fontSize:12 }}>◀</button>
                      <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}} style={{ ...btn(C.dim,true), padding:"4px 10px", fontSize:12 }}>▶</button>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                    {[{l:"Working Days",v:s.working,c:C.accent},{l:"Present",v:s.present,c:C.green},{l:"Absent",v:s.absent,c:C.red},{l:"Leave",v:s.leave,c:C.amber},{l:"Half-day",v:s.halfday,c:C.purple},{l:"Leaves Left",v:rem,c:C.cyan}].map((x,i)=>(
                      <div key={i} style={{ background:C.card, borderRadius:12, padding:"14px 12px", border:`1px solid ${C.border}`, textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
                      {WEEKDAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, color:C.muted, fontWeight:600 }}>{d}</div>)}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                      {Array(new Date(viewYear,viewMonth,1).getDay()).fill(null).map((_,i)=><div key={"e"+i}/>)}
                      {Array.from({length:daysInMonth(viewYear,viewMonth)},(_,i)=>i+1).map(day=>{
                        const key=`${viewYear}-${viewMonth}-${day}`;
                        const status=(attendance[emp.id]||{})[key];
                        const weekend=isWeekend(viewYear,viewMonth,day);
                        const isToday2=day===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
                        const bgMap={P:"#14532d",A:"#450a0a",L:"#1e3a5f",H:"#3b1f6b"};
                        const fgMap={P:"#4ade80",A:"#f87171",L:"#60a5fa",H:"#c084fc"};
                        return (
                          <div key={day} style={{ height:28, borderRadius:5, background:isToday2?"#1e3a5f":weekend?C.surface:status?bgMap[status]:C.surface, border:isToday2?`1px solid ${C.accent}`:"1px solid transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:isToday2?800:400, color:isToday2?C.accent:weekend?C.dim:status?fgMap[status]:C.muted }}>
                            {day}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {tab==="selfie" && <SelfieAttendance emp={emp} attendance={attendance} markAtt={markAtt} officeConfig={officeConfig} today={today} />}
        {tab==="leaves" && <EmpLeaves emp={emp} leaveApps={myLeaves} setLeaveApps={setLeaveApps} />}
        {tab==="reminders" && (
          <div>
            <h2 style={{ fontWeight:800, fontSize:20, marginBottom:20 }}>🔔 Mere Reminders</h2>
            {reminders.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:40 }}>Koi reminder nahi</div>}
            {[...reminders].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(r=>{
              const isToday2=r.date===todayStr();
              return (
                <div key={r.id} style={{ background:C.card, borderRadius:12, padding:"16px 18px", marginBottom:10, border:`1px solid ${isToday2?C.purple:C.border}` }}>
                  {isToday2 && <span style={{ background:C.purple, color:"#fff", borderRadius:6, padding:"1px 8px", fontSize:11, fontWeight:700, marginRight:8 }}>TODAY</span>}
                  <span style={{ fontWeight:700 }}>{r.title}</span>
                  <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>📅 {dateLabel(r.date)} — {r.note||"No note"}</div>
                </div>
              );
            })}
          </div>
        )}
        {tab==="profile" && (
          <div>
            <h2 style={{ fontWeight:800, fontSize:20, marginBottom:20 }}>👤 Mera Profile</h2>
            <div style={{ background:C.card, borderRadius:18, padding:28, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
                <Avatar initials={emp.avatar} size={64} />
                <div><div style={{ fontWeight:800, fontSize:20 }}>{emp.name}</div><div style={{ color:C.accent, fontSize:14 }}>{emp.role}</div></div>
              </div>
              {[["📞 Phone",emp.phone],["🔑 Username",emp.username],["📅 Join Date",dateLabel(emp.joinDate)||emp.joinDate],["🗓 Total Leaves/Year",emp.totalLeaves]].map(([label,val])=>(
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.muted, fontSize:14 }}>{label}</span>
                  <span style={{ fontWeight:600, fontSize:14 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SelfieAttendance({ emp, attendance, markAtt, officeConfig, today }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [gpsStatus, setGpsStatus] = useState("");
  const [gpsOk, setGpsOk] = useState(false);
  const [dist, setDist] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [stream, setStream] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const alreadyMarked = (attendance[emp.id]||{})[todayKey];
  const stopStream = useCallback(()=>{ stream?.getTracks().forEach(t=>t.stop()); setStream(null); },[stream]);
  useEffect(()=>()=>stopStream(),[]);
  const checkGPS = () => {
    setPhase("gps"); setGpsStatus("📡 Location detect ho rahi hai...");
    if(!navigator.geolocation){ setErrMsg("Browser mein location support nahi hai."); setPhase("error"); return; }
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const d = haversine(pos.coords.latitude,pos.coords.longitude,officeConfig.lat,officeConfig.lng);
        setDist(Math.round(d));
        if(d<=officeConfig.radius){ setGpsOk(true); setGpsStatus(`✅ Office ke andar hain (${Math.round(d)}m)`); setPhase("camera"); openCamera(); }
        else { setGpsOk(false); setPhase("error"); setErrMsg(`Aap office se ${Math.round(d)} meter door hain. Max allowed: ${officeConfig.radius}m`); }
      },
      ()=>{ setErrMsg("Location access denied."); setPhase("error"); },
      { enableHighAccuracy:true, timeout:10000 }
    );
  };
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:false });
      setStream(s);
      setTimeout(()=>{ if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); } },200);
    } catch(e){ setErrMsg("Camera access denied."); setPhase("error"); }
  };
  const capture = () => {
    if(!videoRef.current||!canvasRef.current) return;
    const v=videoRef.current, c=canvasRef.current;
    c.width=v.videoWidth||320; c.height=v.videoHeight||240;
    c.getContext("2d").drawImage(v,0,0);
    setSelfie(c.toDataURL("image/jpeg",0.85));
    stopStream(); setPhase("preview");
  };
  const confirm = () => { markAtt(emp.id,today.getFullYear(),today.getMonth(),today.getDate(),"P"); setSuccess(true); setPhase("done"); };
  const reset = () => { setSelfie(null); setGpsOk(false); setDist(null); setErrMsg(""); setSuccess(false); setPhase("idle"); stopStream(); };
  if(alreadyMarked && !success) return (
    <div style={{ textAlign:"center", padding:40 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <div style={{ fontWeight:800, fontSize:20, color:C.green }}>Aaj ki Attendance Mark Ho Gayi!</div>
    </div>
  );
  return (
    <div>
      <h2 style={{ fontWeight:800, fontSize:20, marginBottom:4 }}>📸 Selfie Attendance</h2>
      <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>GPS verify hoga, phir selfie leni hogi</div>
      <div style={{ background:C.card, borderRadius:12, padding:"12px 16px", marginBottom:20, border:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:12, color:C.muted }}>📍 {officeConfig.name}</div>
          <div style={{ fontSize:12, color:C.muted }}>Lat: {officeConfig.lat}, Lng: {officeConfig.lng}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:12, color:C.muted }}>Allowed Radius</div>
          <div style={{ fontWeight:700, color:C.green, fontSize:18 }}>{officeConfig.radius}m</div>
        </div>
      </div>
      {phase==="idle" && (
        <div style={{ textAlign:"center", padding:"30px 0" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📍</div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Ready hain?</div>
          <div style={{ color:C.muted, fontSize:13, marginBottom:24 }}>Pehle GPS verify hogi, phir selfie leni hogi</div>
          <button onClick={checkGPS} style={{ ...btn(C.accent), padding:"14px 32px", fontSize:15, borderRadius:14 }}>Start GPS Verification 📡</button>
        </div>
      )}
      {phase==="gps" && (
        <div style={{ textAlign:"center", padding:30 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📡</div>
          <div style={{ color:C.amber, fontWeight:600, fontSize:15 }}>{gpsStatus}</div>
        </div>
      )}
      {phase==="camera" && gpsOk && (
        <div>
          <div style={{ background:"#0a1f0a", border:`1px solid ${C.green}`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.green }}>✅ GPS Verified — {dist}m</div>
          <div style={{ background:C.card, borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:16 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", display:"block", transform:"scaleX(-1)", maxHeight:360, objectFit:"cover", background:"#000" }} />
          </div>
          <canvas ref={canvasRef} style={{ display:"none" }} />
          <button onClick={capture} style={{ ...btn(C.green), width:"100%", padding:"14px", fontSize:15, borderRadius:12 }}>📸 Selfie Lo</button>
        </div>
      )}
      {phase==="preview" && selfie && (
        <div>
          <div style={{ background:C.card, borderRadius:14, overflow:"hidden", border:`1px solid ${C.green}`, marginBottom:16 }}>
            <img src={selfie} alt="selfie" style={{ width:"100%", display:"block", transform:"scaleX(-1)", maxHeight:360, objectFit:"cover" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={confirm} style={{ ...btn(C.green), flex:1, padding:"13px", fontSize:15, borderRadius:12 }}>✅ Confirm & Mark Present</button>
            <button onClick={()=>{ setSelfie(null); setPhase("camera"); openCamera(); }} style={{ ...btn(C.amber,true), padding:"13px 18px", borderRadius:12 }}>🔄 Retake</button>
          </div>
        </div>
      )}
      {phase==="done" && (
        <div style={{ textAlign:"center", padding:40 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>🎉</div>
          <div style={{ fontWeight:800, fontSize:22, color:C.green, marginBottom:8 }}>Attendance Mark Ho Gayi!</div>
          <div style={{ color:C.muted, marginBottom:20, fontSize:13 }}>Selfie ke saath verified ✅</div>
          <button onClick={reset} style={{ ...btn(C.dim,true) }}>Back</button>
        </div>
      )}
      {phase==="error" && (
        <div style={{ textAlign:"center", padding:30 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
          <div style={{ background:"#450a0a", border:`1px solid ${C.red}`, borderRadius:12, padding:16, marginBottom:20, color:C.red, fontWeight:600 }}>{errMsg}</div>
          <button onClick={reset} style={btn(C.accent)}>Dobara Try Karo</button>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function EmpLeaves({ emp, leaveApps, setLeaveApps }) {
  const [showForm, setShowForm] = useState(false);
  const [newLeave, setNewLeave] = useState({ from:"", to:"", reason:"" });
  const ul = usedApprovedLeaves(emp.id,leaveApps);
  const rem = emp.totalLeaves-ul;
  const pct = Math.round((ul/emp.totalLeaves)*100);
  const submit = () => {
    if(!newLeave.from||!newLeave.to) return;
    setLeaveApps(prev=>[...prev,{ id:Date.now(), empId:emp.id, ...newLeave, status:"pending" }]);
    setNewLeave({from:"",to:"",reason:""}); setShowForm(false);
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h2 style={{ fontWeight:800, fontSize:20 }}>🗓 Meri Leaves</h2>
        <button onClick={()=>setShowForm(true)} style={btn(C.accent)}>+ Apply</button>
      </div>
      <div style={{ background:C.card, borderRadius:14, padding:20, border:`1px solid ${C.border}`, marginBottom:20 }}>
        <div style={{ fontWeight:700, marginBottom:12 }}>Leave Balance</div>
        <div style={{ height:8, borderRadius:10, background:C.border, marginBottom:10 }}>
          <div style={{ height:"100%", borderRadius:10, width:`${Math.min(pct,100)}%`, background:pct>80?C.red:pct>50?C.amber:C.green }} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[{l:"Used",v:ul,c:C.red},{l:"Left",v:rem,c:C.green},{l:"Total",v:emp.totalLeaves,c:C.muted}].map((x,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:x.c }}>{x.v}</div>
              <div style={{ fontSize:12, color:C.muted }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>
      {showForm && (
        <div style={{ background:C.card, borderRadius:14, padding:20, marginBottom:20, border:`1px solid ${C.accent}` }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>Leave Request</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div><div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>From Date</div><input type="date" style={inp} value={newLeave.from} onChange={e=>setNewLeave({...newLeave,from:e.target.value})} /></div>
            <div><div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>To Date</div><input type="date" style={inp} value={newLeave.to} onChange={e=>setNewLeave({...newLeave,to:e.target.value})} /></div>
            <div><div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Reason</div><input style={inp} placeholder="Leave ka karan" value={newLeave.reason} onChange={e=>setNewLeave({...newLeave,reason:e.target.value})} /></div>
            {newLeave.from&&newLeave.to&&<div style={{ background:C.surface, borderRadius:8, padding:"8px 12px", fontSize:13, color:C.amber }}>📅 {leaveDays(newLeave.from,newLeave.to)} din ki leave</div>}
          </div>
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button onClick={submit} style={btn(C.accent)}>Submit</button>
            <button onClick={()=>setShowForm(false)} style={btn(C.dim,true)}>Cancel</button>
          </div>
        </div>
      )}
      {leaveApps.length===0 && <div style={{ color:C.muted, textAlign:"center", padding:30 }}>Koi leave application nahi</div>}
      {[...leaveApps].reverse().map(l=>(
        <div key={l.id} style={{ background:C.card, borderRadius:12, padding:"16px 18px", marginBottom:10, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontWeight:600 }}>{dateLabel(l.from)} → {dateLabel(l.to)}</span>
            <Chip label={l.status.toUpperCase()} />
          </div>
          <div style={{ fontSize:13, color:C.muted }}>{leaveDays(l.from,l.to)} din · {l.reason||"No reason"}</div>
        </div>
      ))}
    </div>
  );
}

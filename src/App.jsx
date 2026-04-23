import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import "./App.css";

// Helper utilities
const formatTime = (ms, showMinutes = false) => {
  if (!ms) return "--.---";
  const totalSeconds = ms / 1000;
  if (showMinutes) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  }
  return totalSeconds.toFixed(3);
};

const getTeamColor = (id) => {
  const colors = ["team-red", "team-papaya", "team-teal", "team-blue", "team-green", "team-pink", "team-white"];
  return colors[id % colors.length];
};

const getTeamHex = (id) => {
  const colors = ["#dc0000", "#ff8700", "#00d2be", "#0600ef", "#0090d0", "#f596c8", "#ffffff"];
  return colors[id % colors.length];
};

const getTyreInfo = (id) => {
  const compounds = [{ type: 'S', comp: 'tyre-s' }, { type: 'M', comp: 'tyre-m' }, { type: 'H', comp: 'tyre-h' }];
  return compounds[id % 3];
};

export default function App() {
  const [laps, setLaps] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [races, setRaces] = useState([]);

  const [liveData, setLiveData] = useState([]);
  const [raceInfo, setRaceInfo] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const svgPathRef = useRef(null);

  // LOAD DATA
  useEffect(() => {
    Papa.parse("/lap_times.csv", { download: true, header: true, complete: r => setLaps(r.data) });
    Papa.parse("/drivers.csv", { download: true, header: true, complete: r => setDrivers(r.data) });
    Papa.parse("/races.csv", { download: true, header: true, complete: r => setRaces(r.data) });
  }, []);

  // SIMULATION INIT
  useEffect(() => {
    if (!laps.length || !drivers.length || !races.length) return;

    const race = races.find(r => Number(r.year) >= 2015);
    const raceId = race.raceId;
    setRaceInfo(`${race.name}: Race`);

    // Group Laps
    const grouped = {};
    laps.forEach(l => {
      if (l.raceId !== raceId) return;
      if (!grouped[l.driverId]) grouped[l.driverId] = [];
      grouped[l.driverId].push(Number(l.milliseconds));
    });

    const driverIds = Object.keys(grouped).slice(0, 15);

    const sim = driverIds.map((id, index) => ({
      id,
      lapIndex: 0,
      lapProgress: 0,
      totalTime: 0,
      pits: index % 2 === 0 ? 1 : 2, 
      posChange: index % 3 === 0 ? `+${(index % 3)+1}` : (index % 4 === 0 ? `-${(index%2)+1}` : '-'),
      drsType: index > 5 ? 'active' : 'inactive'
    }));

    const generateSectorData = (lapMs, prevSec) => {
        const s1 = lapMs * 0.31 + (Math.random() * 500 - 250);
        const s2 = lapMs * 0.39 + (Math.random() * 500 - 250);
        const s3 = lapMs - (s1 + s2);
        const s1C = Math.random() > 0.8 ? 'purple' : (Math.random() > 0.4 ? 'green' : 'yellow');
        const s2C = Math.random() > 0.8 ? 'purple' : (Math.random() > 0.4 ? 'green' : 'yellow');
        const s3C = Math.random() > 0.8 ? 'purple' : (Math.random() > 0.4 ? 'green' : 'yellow');
        return { s1, s1C, s2, s2C, s3, s3C, prevS1: prevSec ? prevSec.s1 : s1 + 1500, prevS2: prevSec ? prevSec.s2 : s2 + 1500, prevS3: prevSec ? prevSec.s3 : s3 + 1500 };
    };

    const interval = setInterval(() => {
      sim.forEach((d) => {
        const lapTimes = grouped[d.id];
        const lapTime = lapTimes[d.lapIndex] || 85000;
        d.lapProgress += Math.random() * 50 + 100;
        
        if (!d.sectors) d.sectors = generateSectorData(lapTime, null);

        if (d.lapProgress >= lapTime) {
          d.totalTime += lapTime;
          d.lapIndex++;
          d.lapProgress = 0;
          d.lastLapTime = lapTime;
          d.sectors = generateSectorData(lapTimes[d.lapIndex] || 85000, d.sectors);
        }
      });

      const updated = sim.map((d) => {
        const driver = drivers.find(dr => dr.driverId === d.id) || { surname: "UNK", code: "UNK" };
        return {
           ...d,
           name: driver.code || driver.surname.substring(0, 3).toUpperCase(),
           fullName: `${driver.forename} ${driver.surname}`,
           teamCol: getTeamColor(d.id),
           teamHex: getTeamHex(d.id),
           tyre: getTyreInfo(d.id),
           progressPercent: d.lapProgress / (grouped[d.id][d.lapIndex] || 85000)
        };
      });

      updated.sort((a,b) => (a.totalTime + a.lapProgress) - (b.totalTime + b.lapProgress));
      const leaderTime = updated[0].totalTime + updated[0].lapProgress;

      const enriched = updated.map((d, index) => {
         const currentTotal = d.totalTime + d.lapProgress;
         const gapToAhead = index > 0 ? currentTotal - (updated[index-1].totalTime + updated[index-1].lapProgress) : 0;
         return { ...d, pos: index + 1, gap: index === 0 ? "Leader" : "+" + ((currentTotal - leaderTime)/1000).toFixed(3), int: index === 0 ? "" : "+" + (gapToAhead/1000).toFixed(3)};
      });

      setLiveData([...enriched]);
    }, 200);

    return () => clearInterval(interval);
  }, [laps, drivers, races]);

  // =============== RENDER TABS ===============

  const renderDashboard = () => (
    <div className="flex-1 overflow-x-auto overflow-y-auto p-6 relative pb-32">
       <div className="table-container min-w-[1100px]">
          <div className="table-row table-header sticky top-0 bg-[#0b0f14] z-10">
             <div className="text-center">Pos</div>
             <div className="text-center">Driver</div>
             <div className="text-center">DRS</div>
             <div className="text-center">Tyre</div>
             <div className="pl-4">Laps / Pits</div>
             <div className="pl-2">Int</div>
             <div className="pl-2">Gap</div>
             <div>Last Lap</div>
             <div>Sector 1</div>
             <div>Sector 2</div>
             <div>Sector 3</div>
          </div>

          <div className="pb-20">
            {liveData.map((d, i) => {
              const c1 = d.sectors?.s1C === 'purple' ? 'text-purple-fastest' : d.sectors?.s1C === 'green' ? 'text-green-pb' : 'text-yellow-no';
              const c2 = d.sectors?.s2C === 'purple' ? 'text-purple-fastest' : d.sectors?.s2C === 'green' ? 'text-green-pb' : 'text-yellow-no';
              const c3 = d.sectors?.s3C === 'purple' ? 'text-purple-fastest' : d.sectors?.s3C === 'green' ? 'text-green-pb' : 'text-yellow-no';
              const pc = d.posChange.includes('+') ? 'text-green-500' : d.posChange.includes('-') && d.posChange.length > 1 ? 'text-red-500' : 'text-gray-500';

              return (
                <div key={d.id} className={`table-row ${i === 0 ? 'bg-[#2b1836]/40 border-l-4 border-purple-600' : 'border-l-4 border-transparent'}`}>
                  <div className="flex justify-center"><span className={`pill ${d.teamCol} w-auto min-w-7 px-2`}>{d.pos}</span></div>
                  <div className="font-bold flex items-center justify-center gap-1"><span className="px-2 py-0.5 rounded text-black bg-white">{d.name}</span></div>
                  <div className={`text-[10px] font-bold text-center ${d.drsType === 'active' ? 'text-white' : 'text-[#444]'}`}>DRS</div>
                  <div className="flex justify-center"><span className={`tyre ${d.tyre.comp}`}>{d.tyre.type}</span></div>
                  <div className="flex flex-col pl-4 border-l border-[#333]">
                     <span className="font-bold text-sm">L {d.lapIndex || 1}</span>
                     <span className="text-[10px] text-gray-500">PIT {d.pits}</span>
                  </div>
                  <div className={`font-bold pl-2 ${pc}`}>{d.posChange}</div>
                  <div className="flex flex-col text-[#00d05a] font-mono text-sm pl-2">
                     <span>{d.gap}</span><span className="text-[11px] text-gray-400">{d.int || '---'}</span>
                  </div>
                  <div className="flex flex-col font-mono text-sm">
                     <span className={i===0 ? 'text-white' : 'text-[#ffffcc]'}>{formatTime(d.lastLapTime, true)}</span>
                     <span className="text-[11px] text-[#b138ff]">{formatTime(d.lastLapTime - 200, true)}</span>
                  </div>
                  <div className="font-mono text-[13px] pr-4">
                     <div className="mini-sector-bar">{Array.from({length: 8}).map((_, i) => (<div key={i} className={`mini-sector ${d.sectors?.s1C}`}></div>))}</div>
                     <span className={`font-bold ${c1} mr-2`}>{formatTime(d.sectors?.s1)}</span>
                     <span className="text-[11px] text-gray-500">{formatTime(d.sectors?.prevS1)}</span>
                  </div>
                  <div className="font-mono text-[13px] pr-4">
                     <div className="mini-sector-bar">{Array.from({length: 8}).map((_, i) => (<div key={i} className={`mini-sector ${d.sectors?.s2C}`}></div>))}</div>
                     <span className={`font-bold ${c2} mr-2`}>{formatTime(d.sectors?.s2)}</span>
                     <span className="text-[11px] text-gray-500">{formatTime(d.sectors?.prevS2)}</span>
                  </div>
                  <div className="font-mono text-[13px]">
                     <div className="mini-sector-bar">{Array.from({length: 8}).map((_, i) => (<div key={i} className={`mini-sector ${d.sectors?.s3C}`}></div>))}</div>
                     <span className={`font-bold ${c3} mr-2`}>{formatTime(d.sectors?.s3)}</span>
                     <span className="text-[11px] text-gray-500">{formatTime(d.sectors?.prevS3)}</span>
                  </div>
                </div>
              );
            })}
          </div>
       </div>
    </div>
  );

  const renderTrackMap = () => {
    // Helper to extract points along SVG path
    const getPointAtPercent = (p) => {
       if (!svgPathRef.current) return {x:-100, y:-100};
       try {
         const len = svgPathRef.current.getTotalLength();
         return svgPathRef.current.getPointAtLength(p * len);
       } catch (e) { return {x:0,y:0}; }
    };

    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0d10]">
         <div className="w-full max-w-5xl aspect-[2/1] relative border-2 border-gray-800 rounded-3xl bg-[#080a0c] shadow-2xl p-12 overflow-hidden flex items-center justify-center">
            
            <h2 className="absolute top-8 left-8 text-3xl font-bold tracking-widest text-[#444] uppercase pointer-events-none">Circuit Map Live</h2>

            <svg viewBox="0 0 800 400" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
               <path 
                  ref={svgPathRef}
                  className="track-map-outline" 
                  d="M 100 200 C 50 100, 200 50, 400 50 S 700 100, 750 200 C 650 350, 400 350, 300 250 S 150 300, 100 200" 
               />
               
               {/* Map Cars to Path */}
               {liveData.map(d => {
                  const pt = getPointAtPercent(d.progressPercent || 0);
                  // Safety check if SVG hasn't fully rendered yet
                  if (pt.x < 0) return null;
                  
                  return (
                     <g key={d.id} transform={`translate(${pt.x}, ${pt.y})`} className="transition-transform duration-200">
                        <circle r="8" fill={d.teamHex} className="car-dot shadow-xl" />
                        <text y="-14" x="-10" fill="white" fontSize="12" fontWeight="bold" fontFamily="monospace" className="drop-shadow-md">
                           {d.name}
                        </text>
                     </g>
                  );
               })}
            </svg>

         </div>
      </div>
    );
  };

  const renderStandings = () => (
    <div className="flex-1 p-12 overflow-y-auto bg-[#0d1115]">
       <h1 className="text-3xl font-bold mb-8 tracking-wider text-white border-b border-gray-800 pb-4">Live Race Order</h1>
       <div className="max-w-4xl grid grid-cols-1 gap-2">
          {liveData.map((d, i) => (
             <div key={d.id} className="bg-[#12181f] flex items-center p-4 rounded-xl border border-gray-800 shadow-sm hover:border-gray-600 transition-colors">
                <span className={`pill ${d.teamCol} w-auto min-w-10 text-lg py-1 px-3 mr-6`}>{d.pos}</span>
                <div className="flex-1">
                   <h3 className="text-xl font-bold">{d.fullName}</h3>
                   <span className="text-sm text-gray-400 font-mono">L {d.lapIndex || 1} • Pits: {d.pits}</span>
                </div>
                <div className="text-right mr-8">
                   <div className="text-lg text-green-400 font-mono font-bold">{d.gap}</div>
                   <div className="text-xs text-gray-500 font-mono">Interval: {d.int || '--'}</div>
                </div>
                <div className="w-24 border-l border-gray-700 pl-6 flex justify-center items-center">
                   <span className={`tyre ${d.tyre.comp} w-10 h-10 text-lg`}>{d.tyre.type}</span>
                </div>
             </div>
          ))}
       </div>
    </div>
  );

  const renderWeather = () => (
    <div className="flex-1 p-12 overflow-y-auto bg-[#0d1115]">
       <h1 className="text-3xl font-bold mb-8 tracking-wider text-white border-b border-gray-800 pb-4">Environmental Radar</h1>
       
       <div className="max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="weather-card flex flex-col items-center justify-center text-center">
             <span className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Track Range</span>
             <span className="text-5xl font-mono text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">32°</span>
             <span className="text-xs text-gray-600 mt-2">Celsius</span>
          </div>
          <div className="weather-card flex flex-col items-center justify-center text-center">
             <span className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Air Temp</span>
             <span className="text-5xl font-mono text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]">19°</span>
             <span className="text-xs text-gray-600 mt-2">Celsius</span>
          </div>
          <div className="weather-card flex flex-col items-center justify-center text-center">
             <span className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Precipitation</span>
             <span className="text-5xl font-mono text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.4)]">14%</span>
             <span className="text-xs text-gray-600 mt-2">Risk in 30 mins</span>
          </div>
          <div className="weather-card flex flex-col items-center justify-center text-center">
             <span className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Wind Speed</span>
             <span className="text-5xl font-mono text-gray-300">1.2</span>
             <span className="text-xs text-gray-600 mt-2">m/s • South</span>
          </div>
       </div>

       <div className="weather-card w-full max-w-5xl aspect-[3/1] relative flex items-center justify-center opacity-80 border border-blue-900/50">
          <span className="absolute top-4 left-6 text-gray-500 font-bold uppercase text-xs">Live Radar Proxy Map</span>
          {/* Abstract Radar Background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0d1115] to-[#0d1115]"></div>
          {/* Sweeping Radar Line */}
          <div className="w-full h-[1px] bg-blue-500/50 absolute animate-[spin_4s_linear_infinite] origin-center opacity-50"></div>
          
          <div className="flex gap-12 z-10 relative mt-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 blur-xl"></div>
            <div className="w-32 h-20 rounded-full bg-blue-500/20 blur-2xl -mt-8 ml-12"></div>
            <div className="w-24 h-24 rounded-full bg-purple-500/10 blur-xl mt-4 ml-16"></div>
          </div>
          <p className="absolute bottom-6 font-mono text-gray-400 text-sm border border-gray-700 px-4 py-1 rounded bg-[#0d1115]">TRACK IS CURRENTLY DRY. NO ACTIVE CELLS.</p>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#0b0f14] text-white overflow-hidden">

      {/* LEFT SIDEBAR NAVIGATION */}
      <div className="w-52 bg-[#111111] flex flex-col pt-8 px-4 border-r border-[#1f252d] shrink-0 z-20 shadow-[10px_0_20px_rgba(0,0,0,0.3)]">
         <div className="text-[#6b7280] text-xs font-bold uppercase tracking-wider mb-4 mt-2 ml-2">Live Timing</div>
         
         <button onClick={() => setActiveTab("dashboard")} className={`w-full text-left px-4 py-2 text-sm font-semibold mb-1 rounded transition-colors ${activeTab === 'dashboard' ? 'bg-[#2a313b] text-white' : 'text-gray-400 hover:text-white hover:bg-[#1a2027]'}`}>
           Dashboard
         </button>
         <button onClick={() => setActiveTab("trackmap")} className={`w-full text-left px-4 py-2 text-sm font-semibold mb-1 rounded transition-colors ${activeTab === 'trackmap' ? 'bg-[#2a313b] text-white' : 'text-gray-400 hover:text-white hover:bg-[#1a2027]'}`}>
           Track Map
         </button>
         <button onClick={() => setActiveTab("standings")} className={`w-full text-left px-4 py-2 text-sm font-semibold mb-1 rounded transition-colors ${activeTab === 'standings' ? 'bg-[#2a313b] text-white' : 'text-gray-400 hover:text-white hover:bg-[#1a2027]'}`}>
           Standings
         </button>
         <button onClick={() => setActiveTab("weather")} className={`w-full text-left px-4 py-2 text-sm font-semibold mb-1 rounded transition-colors ${activeTab === 'weather' ? 'bg-[#2a313b] text-white' : 'text-gray-400 hover:text-white hover:bg-[#1a2027]'}`}>
           Weather
         </button>

         <div className="text-[#6b7280] text-xs font-bold uppercase tracking-wider mb-2 mt-8 ml-2">General</div>
         <button className="w-full text-left  text-gray-500 px-4 py-1.5 text-sm mb-1 cursor-not-allowed">Settings</button>
         <button className="w-full text-left  text-gray-500 px-4 py-1.5 text-sm mb-1 cursor-not-allowed">Schedule</button>
         <button className="w-full text-left  text-gray-500 px-4 py-1.5 text-sm mb-1 cursor-not-allowed">Help</button>
         <button className="w-full text-left  text-gray-500 px-4 py-1.5 text-sm mb-1 cursor-not-allowed">Home</button>
      </div>

      {/* RIGHT MAIN CONTENT PANEL */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        
         {/* HEADER - PERSISTENT */}
         <div className="h-20 shrink-0 border-b border-[#1f252d] flex items-center px-8 justify-between bg-[#111111] shadow-md z-10">
            <div className="flex items-center gap-6">
               <div className="bg-white rounded flex items-center justify-center p-1.5 px-3 border-2 border-gray-600 shadow-sm">
                  <div className="w-5 h-5 bg-red-600 rounded-full"></div>
               </div>
               <div>
                 <div className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">{raceInfo}</div>
                 <div className="text-2xl font-mono font-bold leading-none tracking-tight">00:00:00</div>
               </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex flex-col items-center border-2 border-[#222] bg-[#161a22] rounded-full w-14 h-14 justify-center relative shadow-inner shadow-black">
                    <span className="text-xl font-mono text-yellow-400 font-bold">32°</span>
                    <span className="text-[9px] text-gray-500 absolute bottom-1 font-bold">TRC</span>
                </div>
                <div className="flex flex-col items-center border-2 border-[#222] bg-[#161a22] rounded-full w-14 h-14 justify-center relative shadow-inner shadow-black">
                    <span className="text-xl font-mono text-green-400 font-bold">19°</span>
                    <span className="text-[9px] text-gray-500 absolute bottom-1 font-bold">AIR</span>
                </div>
                <div className="flex items-center gap-4 border-l border-[#333] pl-8 ml-2">
                   <span className="text-3xl font-bold font-mono text-white tracking-widest">53/53</span>
                   <span className="bg-green-600 px-4 py-1.5 rounded font-bold text-sm ml-2 shadow-lg shadow-green-900/50">Track Clear</span>
                </div>
            </div>
         </div>

         {/* DYNAMIC TAB CONTROLLER */}
         {activeTab === 'dashboard' && renderDashboard()}
         {activeTab === 'trackmap' && renderTrackMap()}
         {activeTab === 'standings' && renderStandings()}
         {activeTab === 'weather' && renderWeather()}

      </div>

    </div>
  );
}
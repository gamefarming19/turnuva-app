"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, getDocs, getDoc } from "firebase/firestore";
import { useParams, useSearchParams } from "next/navigation";
import { Search, ListOrdered, Swords, X, Hash, School, User, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function SpectatorPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white italic">VERİLER HAZIRLANIYOR...</div>}>
      <MobileSpectatorView />
    </Suspense>
  );
}

function MobileSpectatorView() {
  const { id } = useParams(); 
  const searchParams = useSearchParams();
  const backCode = searchParams.get('back'); 
  
  const [tournament, setTournament] = useState(null);
  const [realTournId, setRealTournId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('standings');
  const [search, setSearch] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const findTournament = async () => {
      try {
        const q = query(collection(db, "tournaments"), where("accessCode", "==", id.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRealTournId(snap.docs[0].id);
          setTournament({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          const docSnap = await getDoc(doc(db, "tournaments", id));
          if (docSnap.exists()) {
            setRealTournId(id);
            setTournament({ id: docSnap.id, ...docSnap.data() });
          } else { setNotFound(true); }
        }
      } catch (e) { setNotFound(true); }
    };
    findTournament();
  }, [id]);

  useEffect(() => {
    if (!realTournId) return;
    const unsubT = onSnapshot(doc(db, "tournaments", realTournId), (d) => setTournament({ id: d.id, ...d.data() }));
    const unsubP = onSnapshot(query(collection(db, "players"), where("tournamentId", "==", realTournId)), (snap) => {
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubM = onSnapshot(query(collection(db, "matches"), where("tournamentId", "==", realTournId)), (snap) => {
        setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubT(); unsubP(); unsubM(); };
  }, [realTournId]);

  const visibleMatches = useMemo(() => {
    const s = tournament?.spectatorSettings || { mode: 'instant' };
    return matches.filter(m => {
      if (s.mode === 'instant') return true;
      if (s.mode === 'manual') return m.round <= (s.lastPublishedRound || 0);
      if (s.mode === 'round_end') return matches.filter(x => x.round === m.round).every(x => x.status === 'completed');
      return false;
    });
  }, [matches, tournament]);

  const standings = useMemo(() => {
    const avgPoints = players.length > 0 ? players.reduce((sum, p) => sum + (p.points || 0), 0) / players.length : 0;
    const baseStats = players.map(player => {
        const myMatches = visibleMatches.filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed');
        let pts = 0; let wins = 0;
        myMatches.forEach(m => {
            if (m.p1_id === player.id && m.result === "1-0") { pts += 1; wins += 1; }
            else if (m.p2_id === player.id && m.result === "0-1") { pts += 1; wins += 1; }
            else if (m.result === "0.5-0.5") pts += 0.5;
            else if (m.p1_id === player.id && m.p2 === "BYE") { pts += 1; wins += 1; }
        });
        const oppPoints = myMatches.map(m => {
            const oppId = m.p1_id === player.id ? m.p2_id : m.p1_id;
            if (oppId === "BYE") return avgPoints;
            const oppMatchList = visibleMatches.filter(vm => (vm.p1_id === oppId || vm.p2_id === oppId) && vm.status === 'completed');
            return oppMatchList.reduce((sum, vm) => {
                const isOpP1 = vm.p1_id === oppId;
                if ((isOpP1 && vm.result === "1-0") || (!isOpP1 && vm.result === "0-1")) return sum + 1;
                return vm.result === "0.5-0.5" ? sum + 0.5 : sum;
            }, 0);
        });
        const bh = oppPoints.reduce((a, b) => a + b, 0);
        const bh_c1 = oppPoints.length > 1 ? bh - Math.min(...oppPoints) : bh;
        let sb = 0;
        myMatches.forEach((m, idx) => {
            const opP = oppPoints[idx] || 0;
            if ((m.p1_id === player.id && m.result === "1-0") || (m.p2_id === player.id && m.result === "0-1") || m.p2 === "BYE") sb += opP;
            else if (m.result === "0.5-0.5") sb += (opP * 0.5);
        });
        return { ...player, currentPoints: pts, bh, bh_c1, sb, wins };
    });

    return baseStats.map(player => {
        const myMatches = visibleMatches.filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed');
        const bh_sum = myMatches.reduce((acc, m) => {
            const oppId = m.p1_id === player.id ? m.p2_id : m.p1_id;
            return acc + (baseStats.find(p => p.id === oppId)?.bh || 0);
        }, 0);
        return { ...player, bh_sum };
    }).sort((a, b) => b.currentPoints - a.currentPoints || b.bh_c1 - a.bh_c1 || b.sb - a.sb || b.bh_sum - a.bh_sum || b.wins - a.wins || a.bNo - b.bNo);
  }, [players, visibleMatches]);

  const filteredStandings = standings.filter(p => p.name.includes(search.toUpperCase()));
  const visibleCols = tournament?.spectatorSettings?.visibleColumns || ["rank", "bNo", "name", "points"];

  if (notFound) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black">TURNUVA BULUNAMADI</div>;
  if (!tournament) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans pb-24 text-left">
      <div className="sticky top-0 z-[100] bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-800 p-4 shadow-xl flex justify-between items-center max-w-4xl mx-auto">
          <div className="overflow-hidden"><h1 className="font-black text-white uppercase text-sm truncate">{tournament.name}</h1><p className="text-[10px] text-indigo-500 font-black tracking-widest uppercase">Canlı Skor</p></div>
          <Link href={backCode ? `/portal/${backCode}` : "/"} className="flex items-center gap-2 bg-slate-800/80 hover:bg-indigo-600 px-4 py-2 rounded-2xl text-slate-300 hover:text-white transition-all"><ChevronLeft size={16}/><span className="text-[10px] font-black uppercase">Turnuvalar</span></Link>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        <div className="mb-6 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18}/><input onChange={e => setSearch(e.target.value)} placeholder="Oyuncu ara..." className="w-full bg-slate-800/50 border border-slate-700/50 p-4 pl-12 rounded-2xl text-white text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/></div>

        {activeTab === 'standings' ? (
           <div className="overflow-x-auto bg-slate-800/40 rounded-[2rem] border border-slate-700/50 shadow-2xl">
              <table className="w-full text-[10px] text-center border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-500 font-black uppercase border-b border-slate-800">
                    {visibleCols.includes('rank') && <th className="p-4">SIRA</th>}
                    {visibleCols.includes('bNo') && <th className="p-4">B.NO</th>}
                    {visibleCols.includes('name') && <th className="p-4 text-left">AD SOYAD</th>}
                    {visibleCols.includes('school') && <th className="p-4 text-left">KURUM</th>}
                    {visibleCols.includes('city') && <th className="p-4">İL</th>}
                    {visibleCols.includes('district') && <th className="p-4">İLÇE</th>}
                    {visibleCols.includes('points') && <th className="p-4 bg-indigo-900/30 text-indigo-400">PUAN</th>}
                    {visibleCols.includes('bh') && <th className="p-4">BH:C1</th>}
                    {visibleCols.includes('sb') && <th className="p-4">SB</th>}
                    {visibleCols.includes('bhs') && <th className="p-4">BHs</th>}
                    {visibleCols.includes('winp') && <th className="p-4">WIN</th>}
                  </tr>
                </thead>
                <tbody className="font-bold">
                  {filteredStandings.map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                      {visibleCols.includes('rank') && <td className="p-4 text-white text-sm">{i+1}</td>}
                      {visibleCols.includes('bNo') && <td className="p-4 opacity-40">{p.bNo}</td>}
                      {visibleCols.includes('name') && <td className="p-4 text-left uppercase text-white truncate max-w-[140px]">{p.name}</td>}
                      {visibleCols.includes('school') && <td className="p-4 text-left opacity-30 text-[9px] uppercase truncate max-w-[100px]">{p.school || '-'}</td>}
                      {visibleCols.includes('city') && <td className="p-4 opacity-30 text-[9px] uppercase">{p.city || '-'}</td>}
                      {visibleCols.includes('district') && <td className="p-4 opacity-30 text-[9px] uppercase">{p.district || '-'}</td>}
                      {visibleCols.includes('points') && <td className="p-4 text-indigo-400 text-sm font-black bg-indigo-400/5">{p.currentPoints}</td>}
                      {visibleCols.includes('bh') && <td className="p-4 opacity-30">{(p.bh_c1 || 0).toFixed(1)}</td>}
                      {visibleCols.includes('sb') && <td className="p-4 opacity-30">{(p.sb || 0).toFixed(1)}</td>}
                      {visibleCols.includes('bhs') && <td className="p-4 opacity-30">{(p.bh_sum || 0).toFixed(1)}</td>}
                      {visibleCols.includes('winp') && <td className="p-4 opacity-30">{p.wins || 0}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        ) : (
           <div className="space-y-4 animate-in slide-in-from-right duration-500">
              {visibleMatches.sort((a,b)=> b.round - a.round || a.tableNumber - b.tableNumber).filter(m => m.p1.includes(search.toUpperCase()) || m.p2.includes(search.toUpperCase())).map(m => (
                <div key={m.id} className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 relative shadow-xl overflow-hidden">
                  <div className="absolute top-0 left-0 bg-indigo-600 px-4 py-1.5 rounded-br-2xl text-[10px] font-black text-white uppercase italic tracking-tighter shadow-lg">TUR {m.round} — MASA {m.tableNumber === 99 ? 'BYE' : m.tableNumber}</div>
                  <div className="flex justify-between items-center text-center mt-6">
                    <div className="flex-1 min-w-0 text-left"><p className="text-[8px] block opacity-40 mb-1 font-black">B.NO: {m.p1_bNo}</p><span className="text-sm font-black text-white uppercase truncate block">{m.p1}</span></div>
                    <div className={`px-5 py-2 rounded-2xl text-[11px] font-black mx-3 border-2 transition-all ${m.status === 'completed' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'}`}>{m.status === 'completed' ? m.result : 'LIVE'}</div>
                    <div className="flex-1 min-w-0 text-right"><p className="text-[8px] block opacity-40 mb-1 font-black">B.NO: {m.p2_bNo}</p><span className="text-sm font-black text-white uppercase truncate block">{m.p2}</span></div>
                  </div>
                </div>
              ))}
              {visibleMatches.length === 0 && <p className="text-center py-20 text-slate-700 font-bold uppercase italic tracking-widest text-xs">Yayınlanan tur bulunmuyor.</p>}
           </div>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-slate-900/90 backdrop-blur-2xl border border-white/5 p-1.5 rounded-full shadow-2xl flex gap-1 border border-slate-800">
          <button onClick={()=>setActiveTab('standings')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${activeTab === 'standings' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}><ListOrdered size={16}/> SIRALAMA</button>
          <button onClick={()=>setActiveTab('matches')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${activeTab === 'matches' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}><Swords size={16}/> MAÇLAR</button>
      </div>
    </div>
  );
}
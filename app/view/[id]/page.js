"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, getDocs, getDoc } from "firebase/firestore";
import { useParams, useSearchParams } from "next/navigation";
import { Search, ListOrdered, Swords, X, Hash, EyeOff, ChevronLeft, Activity, Lock } from "lucide-react";
import Link from "next/link";

export default function SpectatorPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white italic animate-pulse">VERİLER HAZIRLANIYOR...</div>}>
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

  // 1. ADIM: TURNUVAYI BUL
  useEffect(() => {
    if (!id) return;
    const findTournament = async () => {
      try {
        const q = query(collection(db, "tournaments"), where("accessCode", "==", id.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setRealTournId(snap.docs[0].id);
        } else {
          const docSnap = await getDoc(doc(db, "tournaments", id));
          if (docSnap.exists()) setRealTournId(id);
          else setNotFound(true);
        }
      } catch (e) { setNotFound(true); }
    };
    findTournament();
  }, [id]);

  // 2. ADIM: VERİLERİ CANLI DİNLE
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

  // 🛡️ YAYIN DURUMU KONTROLÜ (KAPAT MODU)
  const isPublished = useMemo(() => {
    const s = tournament?.spectatorSettings;
    if (!s) return true; // Ayar yoksa açık varsay
    if (s.mode === 'instant') return true;
    if (s.mode === 'manual') return (s.lastPublishedRound || 0) > 0;
    if (s.mode === 'round_end') return matches.some(m => m.status === 'completed');
    return false;
  }, [tournament, matches]);

  // 🛡️ GÖRÜNÜR MAÇLAR FİLTRESİ
  const visibleMatches = useMemo(() => {
    const s = tournament?.spectatorSettings || { mode: 'instant' };
    return matches.filter(m => {
      if (s.mode === 'instant') return true;
      if (s.mode === 'manual') return m.round <= (s.lastPublishedRound || 0);
      if (s.mode === 'round_end') {
          const roundMatches = matches.filter(x => x.round === m.round);
          return roundMatches.every(x => x.status === 'completed');
      }
      return false;
    });
  }, [matches, tournament]);

  // 🧠 SIRALAMA MOTORU (Sadece Görünen Maçlarla)
  const standings = useMemo(() => {
    const avgPoints = players.length > 0 ? players.reduce((sum, p) => sum + (p.points || 0), 0) / players.length : 0;
    const list = players.map(player => {
        const myVisibleMatches = visibleMatches.filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed');
        let pts = 0; let wins = 0;
        myVisibleMatches.forEach(m => {
            if (m.p1_id === player.id && m.result === "1-0") { pts += 1; wins += 1; }
            else if (m.p2_id === player.id && m.result === "0-1") { pts += 1; wins += 1; }
            else if (m.result === "0.5-0.5") pts += 0.5;
            else if (m.p1_id === player.id && m.p2 === "BYE") { pts += 1; wins += 1; }
        });
        const oppPoints = myVisibleMatches.map(m => {
            const oppId = m.p1_id === player.id ? m.p2_id : m.p1_id;
            if (oppId === "BYE") return avgPoints;
            const oppM = visibleMatches.filter(vm => (vm.p1_id === oppId || vm.p2_id === oppId) && vm.status === 'completed');
            return oppM.reduce((sum, vm) => {
                if (vm.p1_id === oppId && vm.result === "1-0") return sum + 1;
                if (vm.p2_id === oppId && vm.result === "0-1") return sum + 1;
                return vm.result === "0.5-0.5" ? sum + 0.5 : sum;
            }, 0);
        });
        const bh_c1 = oppPoints.length > 1 ? oppPoints.reduce((a,b)=>a+b,0) - Math.min(...oppPoints) : oppPoints.reduce((a,b)=>a+b,0);
        return { ...player, currentPoints: pts, bh_c1, wins };
    }).sort((a,b) => b.currentPoints - a.currentPoints || b.bh_c1 - a.bh_c1 || a.bNo - b.bNo);
    return list.filter(p => p.name.includes(search.toUpperCase()));
  }, [players, visibleMatches, search]);

  const visibleCols = tournament?.spectatorSettings?.visibleColumns || ["rank", "bNo", "name", "points"];

  if (notFound) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black">TURNUVA BULUNAMADI</div>;
  if (!tournament) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans pb-24 text-left">
      {/* 📱 HEADER */}
      <div className="sticky top-0 z-[100] bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-800 p-4 shadow-xl">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
            <div className="overflow-hidden pr-4 text-left">
              <h1 className="font-black text-white uppercase text-sm truncate tracking-tight">{tournament.name}</h1>
              <p className="text-[10px] text-indigo-500 font-black tracking-widest uppercase italic leading-none">Canlı Yayın Paneli</p>
            </div>
            <Link href={backCode ? `/portal/${backCode}` : "/"} className="flex items-center gap-2 bg-slate-800/80 hover:bg-indigo-600 px-4 py-2 rounded-2xl text-slate-300 hover:text-white transition-all border border-slate-700 active:scale-95">
                <ChevronLeft size={16} /><span className="text-[10px] font-black uppercase tracking-tighter">Turnuvalar</span>
            </Link>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Yayın Açıksa Arama Çubuğunu Göster */}
        {isPublished && (
          <div className="mb-6 relative px-2 animate-in slide-in-from-top-2">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
            <input onChange={e => setSearch(e.target.value)} placeholder="İsim veya Kurum Ara..." className="w-full bg-slate-800/50 border border-slate-700/50 p-4 pl-12 rounded-2xl outline-none text-white text-sm font-bold shadow-inner focus:ring-2 focus:ring-indigo-500 transition-all" />
          </div>
        )}

        {/* 🔒 YAYIN KAPALI DURUMU */}
        {!isPublished ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-slate-900/50 p-10 rounded-[4rem] border border-slate-800 mb-8 shadow-2xl relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 p-4 rounded-3xl border border-slate-700 shadow-xl">
                 <EyeOff size={32} className="text-indigo-500" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mt-4">YAYIN ŞU AN KAPALI</h2>
              <p className="text-slate-500 text-sm font-medium mt-4 max-w-[240px] mx-auto leading-relaxed italic">Turnuva verileri koordinatör tarafından yayına hazırlandığında burada listelenecektir.</p>
            </div>
            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
               <Activity size={14}/> Sistem Çevrimiçi
            </div>
          </div>
        ) : (
          /* 📊 YAYIN AÇIKSA İÇERİĞİ GÖSTER */
          activeTab === 'standings' ? (
            <div className="overflow-x-auto bg-slate-800/40 rounded-[2.5rem] border border-slate-700/50 shadow-2xl mx-2">
                <table className="w-full text-[10px] text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-500 font-black uppercase border-b border-slate-800">
                      {visibleCols.includes('rank') && <th className="p-4">SIRA</th>}
                      {visibleCols.includes('bNo') && <th className="p-4">B.NO</th>}
                      {visibleCols.includes('name') && <th className="p-4 text-left">AD SOYAD</th>}
                      {visibleCols.includes('points') && <th className="p-4 bg-indigo-900/30 text-indigo-400">PUAN</th>}
                      {visibleCols.includes('bh') && <th className="p-4 italic">BH:C1</th>}
                      {visibleCols.includes('sb') && <th className="p-4 italic">SB</th>}
                      {visibleCols.includes('winp') && <th className="p-4 italic">WIN</th>}
                      {visibleCols.includes('school') && <th className="p-4 text-left border-l border-white/5">KURUM</th>}
                       {visibleCols.includes('city') && <th className="p-4 border-l border-white/5">İL</th>}
                       {visibleCols.includes('district') && <th className="p-4 border-l border-white/5">İLÇE</th>}
                    </tr>
                  </thead>
                  <tbody className="font-bold">
                    {standings.map((p, i) => (
                      <tr key={p.id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-all">
                        {visibleCols.includes('rank') && <td className="p-4 text-white text-sm font-black italic">{i+1}</td>}
                        {visibleCols.includes('bNo') && <td className="p-4 opacity-40">{p.bNo}</td>}
                        {visibleCols.includes('name') && <td className="p-4 text-left uppercase text-white truncate max-w-[140px]">{p.name}</td>}
                        {visibleCols.includes('points') && <td className="p-4 text-indigo-400 text-base font-black bg-indigo-400/5">{p.currentPoints}</td>}
                        {visibleCols.includes('bh') && <td className="p-4 opacity-30">{(p.bh_c1 || 0).toFixed(1)}</td>}
                        {visibleCols.includes('sb') && <td className="p-4 opacity-30">{(p.sb || 0).toFixed(1)}</td>}
                        {visibleCols.includes('winp') && <td className="p-4 opacity-30">{p.wins || 0}</td>}
                         {visibleCols.includes('school') && <td className="p-4 text-left opacity-30 text-[9px] uppercase truncate max-w-[100px]">{p.school || '-'}</td> }
                         {visibleCols.includes('city') && <td className="p-4 opacity-30 text-[9px] uppercase">{p.city || '-'}</td>}
                         {visibleCols.includes('district') && <td className="p-4 opacity-30 text-[9px] uppercase">{p.district || '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right duration-500 px-2 text-center">
                {visibleMatches
                  .sort((a,b)=> b.round - a.round || a.tableNumber - b.tableNumber)
                  .filter(m => m.p1.includes(search.toUpperCase()) || m.p2.includes(search.toUpperCase()))
                  .map(m => (
                  <div key={m.id} className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 relative shadow-xl overflow-hidden group">
                    <div className="absolute top-0 left-0 bg-indigo-600 px-4 py-1.5 rounded-br-2xl flex items-center gap-2 shadow-lg">
                      <Hash size={12} className="text-indigo-200" />
                      <span className="text-[10px] font-black text-white uppercase italic">TUR {m.round} — MASA {m.tableNumber === 99 ? 'BYE' : m.tableNumber}</span>
                    </div>
                    <div className="flex justify-between items-center text-center mt-6">
                      <div className="flex-1 min-w-0 text-left"><span className="text-[8px] block opacity-40 mb-1 font-black">B.NO: {m.p1_bNo}</span><span className="text-sm font-black text-white uppercase truncate block tracking-tighter">{m.p1}</span></div>
                      <div className={`px-5 py-2 rounded-2xl text-[11px] font-black mx-3 border-2 transition-all ${m.status === 'completed' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'}`}>{m.status === 'completed' ? m.result : 'LIVE'}</div>
                      <div className="flex-1 min-w-0 text-right"><span className="text-[8px] block opacity-40 mb-1 font-black">B.NO: {m.p2_bNo}</span><span className="text-sm font-black text-white uppercase truncate block tracking-tighter">{m.p2}</span></div>
                    </div>
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      {/* 📱 ALT NAVİGASYON (Sadece Yayın Açıksa Görünür) */}
      {isPublished && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-slate-900/90 backdrop-blur-2xl border border-white/5 p-1.5 rounded-full shadow-2xl flex gap-1 border border-slate-800">
            <button onClick={()=>setActiveTab('standings')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${activeTab === 'standings' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-slate-500'}`}>SIRALAMA</button>
            <button onClick={()=>setActiveTab('matches')} className={`px-8 py-3 rounded-full text-xs font-black transition-all ${activeTab === 'matches' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-slate-500'}`}>MAÇLAR</button>
        </div>
      )}
    </div>
  );
}
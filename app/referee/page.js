"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, doc, 
  updateDoc, increment, getDocs, writeBatch, getDoc 
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Swal from "sweetalert2";
import { Trophy, AlertTriangle, LogOut, ChevronLeft, Hash, Edit3, ShieldCheck, User } from "lucide-react";

export default function RefereePage() {
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [user, setUser] = useState(null);
  const [refereePermissions, setRefereeData] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedT, setSelectedT] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubUser = () => {}; 
    let unsubCoordinator = () => {};
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) { router.push("/login"); } else {
        setUser(authUser);
        unsubUser = onSnapshot(doc(db, "users", authUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setRefereeData(userData);
            if (userData.ownerUid) {
              unsubCoordinator = onSnapshot(doc(db, "users", userData.ownerUid), (coordDoc) => {
                if (coordDoc.exists()) { setIsSystemActive(coordDoc.data().systemActive !== false); }
              });
            } else if (userData.role === "admin") { setIsSystemActive(true); }
            setLoading(false);
          } else { signOut(auth); router.push("/login"); }
        });
      }
    });
    return () => { unsubAuth(); unsubUser(); unsubCoordinator(); };
  }, [router]);

  useEffect(() => {
    if (selectedT && refereePermissions && refereePermissions.role !== "admin") {
      const isStillAuthorized = refereePermissions.assignedTournaments?.includes(selectedT.id);
      if (!isStillAuthorized) {
        setSelectedT(null); setSelectedMatch(null); setMatches([]);
        Swal.fire({ title: "Erişim Engellendi", text: "Yetkiniz kaldırıldı.", icon: "warning", background: "#0f172a", color: "#fff" });
      }
    }
  }, [refereePermissions, selectedT]);

  useEffect(() => {
    if (!refereePermissions) return;
    let q = refereePermissions.role === "admin" ? query(collection(db, "tournaments"), where("ownerUid", "==", auth.currentUser.uid)) : query(collection(db, "tournaments"), where("__name__", "in", refereePermissions.assignedTournaments || []));
    return onSnapshot(q, (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [refereePermissions]);

  useEffect(() => {
    if (!selectedT || !refereePermissions) return;
    const q = query(collection(db, "matches"), where("tournamentId", "==", selectedT.id), where("status", "==", "pending"));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      let filtered = data;
      const allowed = (refereePermissions.tournamentTables?.[selectedT.id] || []).map(t => t.trim()).filter(t => t !== "");
      if (refereePermissions.role !== "admin" && allowed.length > 0) filtered = data.filter(m => allowed.includes(m.tableNumber?.toString()));
      setMatches(filtered.sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0)));
    });
  }, [selectedT, refereePermissions]);

  // 🔥 SADECE MAÇ İÇİN İHTAR VERME 🔥
  const giveWarning = async (matchId, field) => {
    try {
      await updateDoc(doc(db, "matches", matchId), { [field]: increment(1) });
      Swal.fire({ title: 'İhtar Verildi', icon: 'warning', timer: 800, showConfirmButton: false, background: '#0f172a', color: '#fff' });
    } catch (error) { console.error(error); }
  };

  const handleResult = async (m, score, wName) => {
    if (!isSystemActive) return Swal.fire("Hata", "Sistem kapalı!", "error");
    const res = await Swal.fire({ title: score === "0.5-0.5" ? "Berabere mi?" : `${wName} Kazandı mı?`, icon: 'question', showCancelButton: true, background: '#0f172a', color: '#fff' });
    
    if (res.isConfirmed) {
        try {
            const batch = writeBatch(db);
            const finalDetails = { 
                ...details, 
                p1_match_warnings: m.p1_warnings || 0, // Sadece bu maçın ihtarı
                p2_match_warnings: m.p2_warnings || 0,
                refereeName: refereePermissions.name, 
                finishTime: new Date().toLocaleTimeString('tr-TR') 
            };

            batch.update(doc(db, "matches", m.id), { result: score, status: "completed", details: finalDetails, refereeId: auth.currentUser.uid });
            if (score === "1-0" && m.p1_id !== "BYE") batch.update(doc(db, "players", m.p1_id), { points: increment(1), win_count: increment(1) });
            else if (score === "0-1" && m.p2_id !== "BYE") batch.update(doc(db, "players", m.p2_id), { points: increment(1), win_count: increment(1) });
            else if (score === "0.5-0.5") {
                if(m.p1_id !== "BYE") batch.update(doc(db, "players", m.p1_id), { points: increment(0.5) });
                if(m.p2_id !== "BYE") batch.update(doc(db, "players", m.p2_id), { points: increment(0.5) });
            }
            await batch.commit(); setSelectedMatch(null); setDetails({});
        } catch (e) { Swal.fire("Hata", "Kayıt hatası", "error"); }
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic font-bold">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans relative">
      {!isSystemActive && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6 text-center">
            <ShieldCheck size={80} className="text-red-500 mb-6 animate-bounce" />
            <h1 className="text-3xl font-black text-white uppercase">SİSTEM DURDURULDU</h1>
            <p className="text-slate-400 mt-2 text-sm">Koordinatör çevrimdışı. Veri girişi kapalıdır.</p>
        </div>
      )}

      <div className="max-w-2xl mx-auto mb-10 bg-slate-900/60 p-6 rounded-[3rem] border border-slate-800 flex justify-between items-center shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-4 text-left">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20"><User size={28} /></div>
              <div className="overflow-hidden"><h2 className="font-black text-white text-base uppercase truncate leading-tight">{refereePermissions?.name || 'Hakem'}</h2><p className="text-[10px] text-slate-500 font-bold truncate tracking-widest">{refereePermissions?.email}</p></div>
          </div>
          <button onClick={() => signOut(auth).then(() => router.push("/login"))} className="p-4 bg-slate-950 text-rose-500 rounded-3xl hover:bg-rose-500 hover:text-white transition-all shadow-inner border border-white/5"><LogOut size={24} /></button>
      </div>

      {!selectedT ? (
        <div className="max-w-md mx-auto py-4">
          <h1 className="text-xs font-black text-center mb-10 text-slate-500 tracking-[0.4em] uppercase italic">Görevli Olduğunuz Turnuvalar</h1>
          <div className="space-y-5">
            {tournaments.map(t => (
                <button key={t.id} onClick={() => setSelectedT(t)} className="w-full bg-slate-900 p-8 rounded-[3.5rem] text-left border border-slate-800 hover:border-indigo-500 transition-all flex justify-between items-center group shadow-2xl relative overflow-hidden">
                    <div className="z-10"><span className="block text-indigo-500 text-[9px] font-black uppercase mb-2 tracking-widest">Giriş Yap</span><span className="text-2xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tighter">{t.name}</span></div>
                    <ChevronLeft size={24} className="rotate-180 text-slate-700 group-hover:text-indigo-500 transition-all z-10"/>
                </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto animate-in slide-in-from-right duration-500">
          <div className="flex items-center gap-5 mb-10 text-left">
            <button onClick={() => {setSelectedT(null); setMatches([]);}} className="p-5 bg-slate-900 rounded-[2rem] text-slate-400 hover:text-white transition border border-slate-800 shadow-xl"><ChevronLeft size={24}/></button>
            <div><h2 className="text-2xl font-black text-white uppercase truncate">{selectedT.name}</h2><p className="text-[10px] text-indigo-500 font-black tracking-[0.3em] uppercase mt-1 italic">Aktif Maçlar</p></div>
          </div>
          <div className="space-y-6">
            {matches.map((m) => (
              <div key={m.id} className="bg-slate-900 rounded-[3.5rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 bg-indigo-600 px-8 py-3 rounded-br-[2rem] text-[10px] font-black text-white uppercase italic tracking-widest shadow-lg">TUR {m.round} — MASA {m.tableNumber}</div>
                <div className="flex justify-between items-center mt-10">
                  <div className="text-center flex-1">
                    <p className="text-[9px] font-black text-indigo-400 mb-1 tracking-tighter uppercase">B.NO: {m.p1_bNo}</p>
                    <p className="text-xl font-black text-white mb-4 h-16 flex items-center justify-center leading-tight uppercase tracking-tight">{m.p1}</p>
                    <button onClick={() => giveWarning(m.id, "p1_warnings")} className="bg-amber-500/10 text-amber-500 px-6 py-2.5 rounded-full text-[10px] font-black border border-amber-500/20 active:bg-amber-500 active:text-white transition-all uppercase tracking-widest italic shadow-sm">İHTAR ({m.p1_warnings || 0})</button>
                  </div>
                  <div className="px-6 flex flex-col items-center opacity-10"><div className="h-10 w-px bg-white"></div><span className="py-4 text-white font-black italic text-xs">VS</span><div className="h-10 w-px bg-white"></div></div>
                  <div className="text-center flex-1">
                    <p className="text-[9px] font-black text-indigo-400 mb-1 tracking-tighter uppercase">B.NO: {m.p2_bNo}</p>
                    <p className="text-xl font-black text-white mb-4 h-16 flex items-center justify-center leading-tight uppercase tracking-tight">{m.p2}</p>
                    <button onClick={() => giveWarning(m.id, "p2_warnings")} className="bg-amber-500/10 text-amber-500 px-6 py-2.5 rounded-full text-[10px] font-black border border-amber-500/20 active:bg-amber-500 active:text-white transition-all uppercase tracking-widest italic shadow-sm">İHTAR ({m.p2_warnings || 0})</button>
                  </div>
                </div>
                <button onClick={() => setSelectedMatch(m)} className="w-full mt-12 bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-[2.5rem] font-black text-sm tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95"><Edit3 size={20}/> SONUÇ GİRİŞİ</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-2xl z-[150] flex items-center justify-center p-4 animate-in zoom-in duration-300">
          <div className="bg-slate-900 w-full max-w-lg rounded-[4.5rem] p-12 border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-center text-indigo-500 text-[10px] font-black uppercase tracking-[0.5em] mb-12 italic underline underline-offset-[12px] decoration-slate-800 text-left">Teknik Veri Kaydı</h3>
            {selectedT.customFields?.length > 0 && (
              <div className="grid grid-cols-2 gap-10 mb-12 border-b border-slate-800 pb-12 text-left">
                {['p1', 'p2'].map((pK) => (
                  <div key={pK} className="space-y-6">
                    <p className="text-[11px] font-black text-slate-400 uppercase text-center mb-6 truncate italic opacity-60">{pK === 'p1' ? selectedMatch.p1 : selectedMatch.p2}</p>
                    {selectedT.customFields.map((f, i) => (
                      <div key={i} className="text-left"><label className="text-[9px] font-bold text-slate-600 ml-2 mb-2 block uppercase tracking-widest">{f.label}</label><input type="number" className="w-full bg-slate-800 border border-slate-700 p-5 rounded-3xl text-white font-black outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="0" onChange={(e) => setDetails(prev => ({...prev, [`${pK}_${f.label}`]: e.target.value}))} /></div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-4">
              <button onClick={() => handleResult(selectedMatch, "1-0", selectedMatch.p1)} className="w-full bg-indigo-600 hover:bg-indigo-500 py-7 rounded-[2.5rem] text-white font-black shadow-xl text-base uppercase">{selectedMatch.p1.split(' ')[0]} KAZANDI</button>
              <button onClick={() => handleResult(selectedMatch, "0.5-0.5", "Berabere")} className="w-full bg-slate-800 border border-slate-700 py-6 rounded-[2.5rem] text-white font-black text-xs uppercase tracking-[0.3em]">BERABERE</button>
              <button onClick={() => handleResult(selectedMatch, "0-1", selectedMatch.p2)} className="w-full bg-rose-600 hover:bg-rose-500 py-7 rounded-[2.5rem] text-white font-black shadow-xl text-base uppercase">{selectedMatch.p2.split(' ')[0]} KAZANDI</button>
              <button onClick={() => {setSelectedMatch(null); setDetails({});}} className="w-full pt-8 text-slate-600 font-black text-xs uppercase tracking-widest underline underline-offset-8 decoration-slate-800 hover:text-slate-400 transition-colors">Vazgeç</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
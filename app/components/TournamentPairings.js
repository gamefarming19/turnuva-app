"use client";
import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, doc, writeBatch, increment, getDocs, query, where 
} from "firebase/firestore";
import { Info, X, RotateCcw, RefreshCw, Edit3 } from "lucide-react";
import Swal from "sweetalert2";
import { runSwissPairing } from "../lib/pairingLogic"; // Daha önce ayırdığımız motor

export default function TournamentPairings({ selectedT, players, calculatedPlayers, matches, user }) {
  const [activeInfoId, setActiveInfoId] = useState(null); 
  const [matchForResult, setMatchForResult] = useState(null);
  const [adminDetails, setAdminDetails] = useState({});

  // --- 🛠️ 1. SON TURU İPTAL ET (Rollback) ---
  const deleteLastRound = async () => {
    if (matches.length === 0) return;
    const maxRound = Math.max(...matches.map(m => m.round));
    const confirm = await Swal.fire({
      title: `${maxRound}. Turu İptal Et?`,
      text: "Tüm puanlar geri alınacak ve eşleşmeler silinecektir!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, Geri Al',
      confirmButtonColor: '#e67e22'
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Geri alınıyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const batch = writeBatch(db);
      const roundMatches = matches.filter(m => m.round === maxRound);

      for (const m of roundMatches) {
        if (m.status === 'completed') {
            // ID bazlı puan geri alma
            if (m.result === "1-0" && m.p1_id) batch.update(doc(db, "players", m.p1_id), { points: increment(-1), win_count: increment(-1) });
            if (m.result === "0-1" && m.p2_id) batch.update(doc(db, "players", m.p2_id), { points: increment(-1), win_count: increment(-1) });
            if (m.result === "0.5-0.5") {
                if(m.p1_id) batch.update(doc(db, "players", m.p1_id), { points: increment(-0.5) });
                if(m.p2_id) batch.update(doc(db, "players", m.p2_id), { points: increment(-0.5) });
            }
        }
        batch.delete(doc(db, "matches", m.id));
      }
      await batch.commit();
      Swal.fire("Başarılı", "Tur geri alındı.", "success");
    }
  };

  // --- 🛠️ 2. TÜMÜNÜ SIFIRLA ---
  const resetAllMatches = async () => {
    const confirm = await Swal.fire({
      title: 'TÜM TURNUVAYI SIFIRLA?',
      text: 'Herkesin puanı 0 olacak ve tüm maçlar silinecek!',
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Evet, Her Şeyi Sil'
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Sıfırlanıyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const batch = writeBatch(db);
      matches.forEach(m => batch.delete(doc(db, "matches", m.id)));
      players.forEach(p => batch.update(doc(db, "players", p.id), { points: 0, win_count: 0 }));
      await batch.commit();
      Swal.fire("Sıfırlandı", "", "success");
    }
  };

  // --- 🛠️ 3. KOORDİNATÖR SONUÇ GİRİŞİ ---
  const handleAdminResultSubmit = async (match, score, winnerName) => {
    const res = await Swal.fire({
      title: score === "0.5-0.5" ? "Berabere mi?" : `${winnerName} Kazandı mı?`,
      showCancelButton: true, confirmButtonText: 'Evet', background: '#fff'
    });

    if (res.isConfirmed) {
      try {
        const batch = writeBatch(db);
        if (match.status === 'completed') {
            if (match.result === "1-0" && match.p1_id) batch.update(doc(db, "players", match.p1_id), { points: increment(-1), win_count: increment(-1) });
            if (match.result === "0-1" && match.p2_id) batch.update(doc(db, "players", match.p2_id), { points: increment(-1), win_count: increment(-1) });
            if (match.result === "0.5-0.5") {
                if(match.p1_id) batch.update(doc(db, "players", match.p1_id), { points: increment(-0.5) });
                if(match.p2_id) batch.update(doc(db, "players", match.p2_id), { points: increment(-0.5) });
            }
        }
        const finalDetails = { ...match.details, ...adminDetails, refereeName: "Koordinatör" };
        batch.update(doc(db, "matches", match.id), { result: score, status: "completed", details: finalDetails });
        if (score === "1-0" && match.p1_id !== "BYE") batch.update(doc(db, "players", match.p1_id), { points: increment(1), win_count: increment(1) });
        if (score === "0-1" && match.p2_id !== "BYE") batch.update(doc(db, "players", match.p2_id), { points: increment(1), win_count: increment(1) });
        if (score === "0.5-0.5") {
            if(match.p1_id !== "BYE") batch.update(doc(db, "players", match.p1_id), { points: increment(0.5) });
            if(match.p2_id !== "BYE") batch.update(doc(db, "players", match.p2_id), { points: increment(0.5) });
        }
        await batch.commit(); setMatchForResult(null);
      } catch (e) { Swal.fire("Hata", "", "error"); }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* 🛡️ YÖNETİM BUTONLARI (MISSING BUTTONS) 🛡️ */}
      <div className="flex gap-4 justify-end px-4">
          <button onClick={deleteLastRound} className="flex items-center gap-2 bg-amber-50 text-amber-600 px-6 py-3 rounded-2xl font-black text-[10px] hover:bg-amber-600 hover:text-white transition-all shadow-sm border border-amber-100 uppercase tracking-tighter italic">
              <RotateCcw size={16}/> SON TURU İPTAL ET
          </button>
          <button onClick={resetAllMatches} className="flex items-center gap-2 bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-[10px] hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100 uppercase tracking-tighter italic">
              <RefreshCw size={16}/> TÜMÜNÜ SIFIRLA
          </button>
      </div>

      {/* MAÇ KARTLARI LİSTESİ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map(m => (
              <div key={m.id} className={`p-8 rounded-[3.5rem] border-2 bg-white flex flex-col justify-between transition-all relative overflow-hidden ${m.status==='pending'?'border-amber-100 shadow-xl shadow-amber-50':'border-slate-100 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-6 text-left relative z-10">
                      <span className="text-[9px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase italic tracking-widest leading-none">TUR {m.round} — Masa {m.tableNumber}</span>
                      {m.status === 'completed' && (
                          <button onClick={()=>setActiveInfoId(activeInfoId === m.id ? null : m.id)} className={`p-1.5 rounded-xl transition-all ${activeInfoId === m.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}><Info size={16} /></button>
                      )}
                  </div>

                  {/* KART İÇİ ANALİZ PANELİ */}
                  {activeInfoId === m.id && (
                      <div className="absolute inset-0 bg-slate-950 text-white p-4 rounded-[3.5rem] z-20 flex flex-col">
                          <div className="flex justify-between items-center mb-1 border-b border-white/10 shrink-0"><p className="font-black text-indigo-400 uppercase text-[9px]">HAKEM: {m.details?.refereeName || 'Admin'}</p><button onClick={()=>setActiveInfoId(null)} className="p-1"><X size={14}/></button></div>
                          <div className="overflow-y-auto flex-1 text-[9px] space-y-1 mt-2">
                                   <div className="flex justify-between items-center text-[8px] bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 mb-2 font-black text-amber-500 uppercase italic">
                <span>MAÇ İHTARLARI:</span>
                <span className="text-[10px]">{m.details?.p1_match_warnings || 0} — {m.details?.p2_match_warnings || 0}</span>
            </div>
                              {selectedT.customFields?.map((f, idx) => ( 
                                <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                                    <span className="text-slate-400 uppercase">{f.label}:</span>
                                    <span className="font-black">{m.details?.[`p1_${f.label}`] || 0} — {m.details?.[`p2_${f.label}`] || 0}</span></div> ))}
                          </div>
                      </div>
                  )}

                  <div onClick={() => setMatchForResult(m)} className="flex justify-between items-center font-black text-slate-800 leading-tight gap-2 text-center overflow-hidden cursor-pointer group">
                      <div className="flex-1 min-w-0 text-left"><span className="text-[8px] text-indigo-500 block mb-1 uppercase opacity-50">B.NO: {m.p1_bNo}</span><span className="truncate block text-sm tracking-tighter uppercase font-black" title={m.p1}>{m.p1}</span></div>
                      <div className={`px-3 py-1.5 rounded-full text-[9px] shrink-0 font-black border-2 transition-all ${m.status==='pending' ? 'bg-amber-100 text-amber-700 border-amber-200 group-hover:bg-amber-500 group-hover:text-white' : 'bg-indigo-600 text-white shadow-md'}`}>{m.status==='pending' ? 'GİRİŞ' : m.result}</div>
                      <div className="flex-1 min-w-0 text-right"><span className="text-[8px] text-indigo-500 block mb-1 uppercase opacity-50">B.NO: {m.p2_bNo}</span><span className="truncate block text-sm tracking-tighter uppercase font-black" title={m.p2}>{m.p2}</span></div>
                  </div>
              </div>
          ))}
      </div>

      {/* 📊 ADMIN SONUÇ MODALI */}
      {matchForResult && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[4.5rem] p-12 shadow-2xl animate-in zoom-in duration-300">
                <h3 className="text-center text-indigo-600 text-[10px] font-black uppercase mb-12 italic underline underline-offset-8">Koordinatör Sonuç Girişi</h3>
                {selectedT.customFields?.length > 0 && (
                    <div className="grid grid-cols-2 gap-8 mb-12 border-b pb-12">
                        {['p1', 'p2'].map(pk => (
                            <div key={pk} className="space-y-4 text-left">
                                <p className="text-[11px] font-black text-slate-400 uppercase text-center truncate">{pk === 'p1' ? matchForResult.p1 : matchForResult.p2}</p>
                                {selectedT.customFields.map((f, i) => (
                                    <div key={i}><label className="text-[9px] font-bold text-slate-600 ml-2 mb-2 block uppercase">{f.label}</label>
                                    <input type="number" className="w-full bg-slate-50 border p-4 rounded-3xl font-black outline-none" placeholder="0" onChange={(e) => setAdminDetails(prev => ({...prev, [`${pk}_${f.label}`]: e.target.value}))} /></div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                <div className="space-y-4">
                    <button onClick={() => handleAdminResultSubmit(matchForResult, "1-0", matchForResult.p1)} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-base uppercase shadow-xl">{matchForResult.p1.split(' ')[0]} KAZANDI</button>
                    <button onClick={() => handleAdminResultSubmit(matchForResult, "0.5-0.5", "")} className="w-full bg-slate-100 text-slate-600 py-5 rounded-[2.5rem] font-black text-xs uppercase">BERABERE</button>
                    <button onClick={() => handleAdminResultSubmit(matchForResult, "0-1", matchForResult.p2)} className="w-full bg-rose-600 text-white py-6 rounded-[2.5rem] font-black text-base shadow-xl uppercase">{matchForResult.p2.split(' ')[0]} KAZANDI</button>
                    <button onClick={() => {setMatchForResult(null); setAdminDetails({});}} className="w-full pt-8 text-slate-400 font-black text-xs uppercase underline underline-offset-8">Kapat</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
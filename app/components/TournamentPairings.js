"use client";
import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, doc, writeBatch, increment, getDocs, query, where 
} from "firebase/firestore";
import { Info, X, RotateCcw, RefreshCw, Edit3 } from "lucide-react";
import Swal from "sweetalert2";
import { submitMatchResult } from "../swiss/matchActions";
import ResultModal from "./ResultModal";
export default function TournamentPairings({ selectedT, players, calculatedPlayers, matches, user }) {
  const [activeInfoId, setActiveInfoId] = useState(null); 
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [details, setDetails] = useState({});


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
 // app/components/TournamentPairings.js içinde bu fonksiyonu bul ve değiştir:

const resetAllMatches = async () => {
  const confirm = await Swal.fire({
    title: 'TÜM TURNUVAYI SIFIRLA?',
    text: 'Herkesin puanı, renk geçmişi ve tüm verileri temizlenecek!',
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: 'Evet, Her Şeyi Sil',
    confirmButtonColor: '#ef4444'
  });

  if (confirm.isConfirmed) {
    Swal.fire({ title: 'Sıfırlanıyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const batch = writeBatch(db);

    // 1. Tüm Maçları Sil
    matches.forEach(m => batch.delete(doc(db, "matches", m.id)));

    // 2. Oyuncuların Tüm Swiss Verilerini Temizle (KRİTİK BÖLÜM ✅)
    players.forEach(p => {
      batch.update(doc(db, "players", p.id), { 
        points: 0, 
        win_count: 0,
        colorHistory: "",      // Renk geçmişini metin olarak siler
        whiteCount: 0,         // Beyaz oynama sayısını sıfırlar
        blackCount: 0,         // Siyah oynama sayısını sıfırlar
        receivedBye: false,    // Daha önce BYE aldığı bilgisini siler
        lastColor: "",         // Son oynadığı rengi siler
        bh_c1: 0,              // Averajları sıfırlar
        sb: 0,
        bh_sum: 0
      });
    });

    await batch.commit();
    Swal.fire("Sıfırlandı", "Turnuva ilk haline döndürüldü.", "success");
  }
};

  // --- 🛠️ 3. KOORDİNATÖR SONUÇ GİRİŞİ ---
  const handleResult = async (match, score, winnerName) => {
    const res = await Swal.fire({
      title: score === "0.5-0.5" ? "Berabere mi?" : `${winnerName} Kazandı mı?`,
      showCancelButton: true,
      confirmButtonText: 'Evet',
      background: '#fff'
    });

    if (!res.isConfirmed) return;

    try {
      // Mevcut detayları Modal'dan gelen detaylarla (details state'i) birleştir
      const finalDetails = {
        ...match.details,
        ...details
      };

      // Merkezi kayıt fonksiyonu (swiss/matchActions.js)
      await submitMatchResult({
        match: match,
        score: score,
        refereeName: "KOORDİNATÖR (" + user.name + ")",
        refereeId: user.uid,
        details: finalDetails
      });

      // State'leri temizle
      setSelectedMatch(null);
      setDetails({});

      Swal.fire({
        title: "Kaydedildi",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });

    } catch (e) {
      console.error(e);
      Swal.fire("Hata", e.message || "Sonuç kaydedilemedi", "error");
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
              <div key={m.id} className={`p-8 rounded-[3.5rem] border-2 flex flex-col justify-between transition-all relative overflow-hidden 
               ${m.status==='pending'
               ?'border-blue-300 bg-blue-40 shadow-lg shadow-blue-500'
               :'border-gray-200 bg-gray-25 shadow-lg shadow-gray-500'}`}               
               >
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
                  <span className="text-[10px]">{m.p1_warnings || 0} — {m.p2_warnings || 0}</span>
              
            </div>
                              {selectedT.customFields?.map((f, idx) => ( 
                                <div key={idx} className="flex justify-between border-b border-white/5 pb-1">
                                    <span className="text-slate-400 uppercase">{f.label}:</span>
                                    <span className="font-black">{m.details?.[`p1_${f.label}`] || 0} — {m.details?.[`p2_${f.label}`] || 0}</span></div> ))}
                          </div>
                      </div>
                  )}

                  <div onClick={() => setSelectedMatch(m)} className="flex justify-between items-center font-black text-slate-800 leading-tight gap-2 text-center overflow-hidden cursor-pointer group">
                      <div className="flex-1 min-w-0 text-left"><span className="text-[8px] text-indigo-500 block mb-1 uppercase opacity-50">B.NO: {m.p1_bNo}</span><span className="truncate block text-sm tracking-tighter uppercase font-black" title={m.p1}>{m.p1}</span></div>
                      <div className={`px-3 py-1.5 rounded-full text-[10px] shrink-0 font-black border-2 transition-all ${m.status==='pending' ? 'bg-blue-500 text-white border-red-200 group-hover:bg-[#F07D1D] group-hover:text-white border-none shadow-md shadow-blue-500' : 'bg-[#F07D1D] text-white shadow-md border-none shadow-gray-500'}`}>{m.status==='pending' ? 'GİRİŞ' : m.result}</div>
                      <div className="flex-1 min-w-0 text-right"><span className="text-[8px] text-indigo-500 block mb-1 uppercase opacity-50">B.NO: {m.p2_bNo}</span><span className="truncate block text-sm tracking-tighter uppercase font-black" title={m.p2}>{m.p2}</span></div>
                  </div>
              </div>
          ))}
      </div>

      {/* 📊 ADMIN SONUÇ MODALI */}
   {selectedMatch && (
        <ResultModal 
          match={selectedMatch}
          customFields={selectedT?.customFields}
          onClose={() => { setSelectedMatch(null); setDetails({}); }}
          onSubmit={handleResult} // Artık yukarıdaki yeni isimle eşleşiyor
          details={details}
          setDetails={setDetails}
        />
      )}
    </div>
  );
}
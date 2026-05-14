"use client";
import { useState, useEffect } from "react";
import { updateDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Radio, Table as TableIcon, CheckCircle2, Circle, Send, Check, Loader2 } from "lucide-react";
import Swal from "sweetalert2";

export default function SpectatorSettings({ selectedT, matches = [] }) {
  const [liveSettings, setLiveSettings] = useState(null);

  // 1. Ayarları Veritabanından Canlı Dinle
  useEffect(() => {
    if (!selectedT?.id) return;
    const unsub = onSnapshot(doc(db, "tournaments", selectedT.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Sadece spectatorSettings kısmını alıyoruz
        setLiveSettings(data.spectatorSettings || {
          mode: "instant",
          visibleColumns: ["rank", "bNo", "name", "points"],
          lastPublishedRound: 0
        });
      }
    });
    return () => unsub();
  }, [selectedT?.id]);

  const rounds = matches && matches.length > 0 
    ? Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b)
    : [];

  const updateDB = async (newVal) => {
    if (!selectedT?.id) return;
    const tournamentRef = doc(db, "tournaments", selectedT.id);
    // Veritabanına sadece spectatorSettings objesini güncelleyerek yazıyoruz
    await updateDoc(tournamentRef, {
      spectatorSettings: { ...liveSettings, ...newVal }
    });
  };

  const toggleColumn = (colId) => {
    const currentCols = liveSettings?.visibleColumns || [];
    const newCols = currentCols.includes(colId)
      ? currentCols.filter(c => c !== colId)
      : [...currentCols, colId];
    updateDB({ visibleColumns: newCols });
  };

  if (!liveSettings) return <div className="p-10 text-center font-bold animate-pulse text-slate-400 uppercase tracking-widest">Ayarlar Yükleniyor...</div>;

  return (
    <div className="space-y-8 animate-in fade-in max-w-5xl mx-auto pb-20 text-left">
      {/* 📡 YAYIN AKIŞ MODU */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
            <Radio size={16}/> Yayın Akış Modu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
                { id: 'instant', label: 'Anlık', desc: 'HER ŞEY AÇIK' },
                { id: 'manual', label: 'Onaylı', desc: 'TUR TUR AÇIN' },
                { id: 'round_end', label: 'Tur Sonu', desc: 'OTO-AÇILIR' }
            ].map(m => (
                <button key={m.id} onClick={() => updateDB({ mode: m.id })} 
                className={`p-6 rounded-[2rem] border-2 text-left transition-all ${liveSettings.mode === m.id ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-50'}`}>
                    <p className={`font-black text-sm ${liveSettings.mode === m.id ? 'text-indigo-600' : 'text-slate-800'}`}>{m.label}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{m.desc}</p>
                </button>
            ))}
        </div>
      </div>

      {/* 📢 TUR YAYINLAMA (SADECE MANUEL MODDA) */}
      {liveSettings.mode === 'manual' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-top-4">
            <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Send size={16}/> Yayınlanacak Turları Seçin
            </h3>
            <div className="flex flex-wrap gap-3">
                <button onClick={() => updateDB({ lastPublishedRound: 0 })} className={`px-6 py-3 rounded-xl font-black text-xs transition-all ${liveSettings.lastPublishedRound === 0 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>KAPAT</button>
                {rounds.map(r => (
                    <button key={r} onClick={() => updateDB({ lastPublishedRound: r })} 
                    className={`px-8 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${liveSettings.lastPublishedRound === r ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500'}`}>
                        {liveSettings.lastPublishedRound >= r && <Check size={14}/>} {r}. TUR
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* 📊 SIRALAMA TABLOSU GÖRÜNÜRLÜĞÜ */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
            <TableIcon size={16}/> Sıralama Tablosu Görünürlüğü
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
                { id: 'rank', label: 'SIRA' }, { id: 'bNo', label: 'B.NO' },
                { id: 'name', label: 'AD SOYAD' }, { id: 'school', label: 'KURUM' },
                { id: 'city', label: 'İL' }, { id: 'district', label: 'İLÇE' },
                { id: 'points', label: 'PUAN' }, { id: 'bh', label: 'BH' },
                { id: 'sb', label: 'SB' }, { id: 'bhs', label: 'BHs' },
                { id: 'winp', label: 'WIN' }
            ].map(col => {
                const isActive = liveSettings.visibleColumns?.includes(col.id);
                return (
                  <button key={col.id} onClick={() => toggleColumn(col.id)} 
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isActive ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                      <span className="text-[10px] font-black uppercase">{col.label}</span>
                      {isActive ? <CheckCircle2 size={16} className="text-white animate-in zoom-in"/> : <Circle size={16} className="opacity-20"/>}
                  </button>
                );
            })}
        </div>
      </div>
    </div>
  );
}
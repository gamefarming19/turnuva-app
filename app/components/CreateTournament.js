"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { X, Plus } from "lucide-react";
import Swal from "sweetalert2";

export default function CreateTournament({ user, isDemo, existingTournamentsCount, onSuccess }) {
  const [tName, setTName] = useState("");
  const [customFields, setCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState("");

  const addCustomField = () => {
    if (!newFieldName) return;
    if (customFields.find(f => f.label === newFieldName)) return Swal.fire("Uyarı", "Bu alan zaten var!", "warning");
    setCustomFields([...customFields, { label: newFieldName }]);
    setNewFieldName("");
  };

  const createTournament = async () => {
     if (isDemo && existingTournamentsCount >= 1) {
      return Swal.fire({
        title: "Limit Doldu",
        text: "Deneme sürümünde sadece 1 turnuva oluşturabilirsiniz. Daha fazlası için PRO lisans almalısınız.",
        icon: "lock",
        confirmButtonText: "Anladım",
        confirmButtonColor: "#4f46e5"
      });
    }
    if (!tName) return Swal.fire("Hata", "Turnuva adı girin", "error");
    try {
      await addDoc(collection(db, "tournaments"), {
        name: tName,
        customFields,
        ownerUid: user.uid,
        createdAt: new Date(),
        spectatorSettings: {
    mode: "manual",           // "instant" yerine "manual" (onaylı) yapıldı
    lastPublishedRound: 0,    // 0 demek yayın KAPALI demektir
    visibleColumns: ["rank", "bNo", "name", "points"]
  }
      });
      setTName(""); setCustomFields([]);
      Swal.fire("Mükemmel", "Turnuva başarıyla oluşturuldu.", "success");
      onSuccess(); 
    } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-2xl bg-white p-12 rounded-[4rem] shadow-2xl border animate-in zoom-in duration-300">
      <h2 className="text-3xl font-black mb-8 tracking-tighter uppercase">Yeni Turnuva Kur</h2>
      <input value={tName} onChange={e => setTName(e.target.value)} placeholder="Turnuva Adı" className="w-full p-5 bg-slate-50 rounded-3xl text-lg font-bold mb-6 outline-none shadow-inner"/>
      <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 mb-8">
        <p className="text-[10px] font-black text-indigo-900 mb-4 uppercase">Dinamik Veri Girişi Ayarları</p>
        <div className="flex gap-2 mb-4">
          <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Alan Adı" className="flex-1 p-4 rounded-2xl text-sm font-bold outline-none shadow-sm"/>
          <button onClick={addCustomField} className="bg-indigo-600 text-white px-6 rounded-2xl font-black uppercase text-xs">Ekle</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {customFields.map((f, i) => (
            <span key={i} className="bg-white px-4 py-2 rounded-xl text-xs font-black text-indigo-600 flex items-center gap-2">
              {f.label} <X size={14} className="text-red-400 cursor-pointer" onClick={() => setCustomFields(customFields.filter((_,idx)=>idx!==i))}/>
            </span>
          ))}
        </div>
      </div>
      <button onClick={createTournament} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-xl shadow-indigo-100">BAŞLAT</button>
    </div>
  );
}
"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, writeBatch, deleteDoc, query, where, getDocs } from "firebase/firestore";
import { 
  Plus, FileSpreadsheet, Clipboard, Trash2, School, MapPin, 
  Edit2, Database, Fingerprint, Tag, Layers, Columns, X, UserPlus 
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

export default function PlayerRegistration({ selectedT, players, setEditingPlayer, isDemo, playersCount }) {
  const [pForm, setPForm] = useState({ name: "", school: "", tc: "", category: "", level: "", city: "", district: "" });
  const [pastedNames, setPastedNames] = useState("");
  
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [mapping, setMapping] = useState({ 
    fullName: "", firstName: "", lastName: "", school: "", 
    tc: "", category: "", level: "", city: "", district: "",
    customFields: {} 
  });

  const formatNameSmart = (rawName) => {
    if (!rawName) return "";
    const parts = String(rawName).trim().split(/\s+/);
    if (parts.length < 2) return String(rawName).toUpperCase();
    const surname = parts.pop();
    const names = parts.join(" ");
    return `${surname.toUpperCase()} ${names.toUpperCase()}`;
  };

  const addPlayer = async () => {
    if (isDemo && players.length >= 12) {
      return Swal.fire("Demo Sınırı", "Deneme sürümünde en fazla 12 oyuncu ekleyebilirsiniz.", "warning");
    }
    if (!pForm.name) return Swal.fire("Hata", "İsim girmelisiniz", "error");
    try {
      await addDoc(collection(db, "players"), {
        ...pForm,
        name: formatNameSmart(pForm.name),
        tournamentId: selectedT.id,
        points: 0, warnings: 0, bNo: players.length + 1, extraData: {}
      });
      setPForm({ name: "", school: "", tc: "", category: "", level: "", city: "", district: "" });
      Swal.fire({ title: "Eklendi", icon: "success", timer: 1000, showConfirmButton: false });
    } catch (e) { console.error(e); }
  };

  const handleFileSelect = (e) => {
    if (isDemo) {
      return Swal.fire("PRO Özellik", "Excel ile toplu yükleme sadece PRO lisans sahiplerine açıktır.", "lock");
    }
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        setExcelRows(data);
        setExcelHeaders(Object.keys(data[0]));
        setShowImportWizard(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const finalizeImport = async () => {
    const batch = writeBatch(db);
    let startNo = players.length + 1;
    let count = 0;

    excelRows.forEach(row => {
      let finalName = "";
      if (mapping.fullName) finalName = formatNameSmart(row[mapping.fullName]);
      else if (mapping.firstName && mapping.lastName) {
        finalName = `${String(row[mapping.lastName] || "").toUpperCase()} ${String(row[mapping.firstName] || "").toUpperCase()}`;
      }

      if (finalName) {
        const pData = {
          name: finalName,
          school: row[mapping.school] || "",
          tc: row[mapping.tc] || "",
          category: row[mapping.category] || "",
          level: row[mapping.level] || "",
          city: row[mapping.city] || "",
          district: row[mapping.district] || "",
          tournamentId: selectedT.id,
          points: 0, warnings: 0, bNo: startNo++, extraData: {}
        };
        selectedT.customFields?.forEach(f => {
            if(mapping.customFields[f.label]) pData.extraData[f.label] = row[mapping.customFields[f.label]] || "";
        });
        batch.set(doc(collection(db, "players")), pData);
        count++;
      }
    });

    await batch.commit();
    setShowImportWizard(false);
    Swal.fire("Başarılı", `${count} oyuncu aktarıldı.`, "success");
  };

  const clearTournamentData = async () => {
    const confirm = await Swal.fire({ title: 'DİKKAT!', text: 'Tüm liste ve maçlar silinecek!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (confirm.isConfirmed) {
      const batch = writeBatch(db);
      const pSnap = await getDocs(query(collection(db, "players"), where("tournamentId", "==", selectedT.id)));
      const mSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", selectedT.id)));
      pSnap.forEach(d => batch.delete(d.ref));
      mSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      Swal.fire("Sıfırlandı", "", "success");
    }
  };

  return (
    <div className="grid grid-cols-12 gap-10 animate-in fade-in duration-500">
      
      {/* EXCEL IMPORT SİHİRBAZI MODALI */}
      {showImportWizard && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[4rem] p-12 shadow-2xl overflow-y-auto max-h-[90vh] text-left">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3"><Database className="text-indigo-600"/> Sütun Eşleştirme</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-4 bg-slate-50 p-6 rounded-[2.5rem]">
                        <p className="text-[10px] font-black text-indigo-600 uppercase mb-4 tracking-widest">KİMLİK BİLGİLERİ</p>
                        <select className="w-full p-3 bg-white rounded-xl text-xs font-bold border-none" value={mapping.fullName} onChange={e=>setMapping({...mapping, fullName: e.target.value})}>
                            <option value="">--- Tam Ad Sütunu ---</option>
                            {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <select className="flex-1 p-3 bg-white rounded-xl text-xs font-bold" value={mapping.firstName} onChange={e=>setMapping({...mapping, firstName: e.target.value})}>
                                <option value="">Ad Sütunu</option>
                                {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <select className="flex-1 p-3 bg-white rounded-xl text-xs font-bold" value={mapping.lastName} onChange={e=>setMapping({...mapping, lastName: e.target.value})}>
                                <option value="">Soyad Sütunu</option>
                                {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <select className="w-full p-3 bg-white rounded-xl text-xs font-bold" value={mapping.tc} onChange={e=>setMapping({...mapping, tc: e.target.value})}>
                            <option value="">--- TC No Sütunu ---</option>
                            {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>
                    <div className="space-y-4 bg-indigo-50/50 p-6 rounded-[2.5rem]">
                        <p className="text-[10px] font-black text-indigo-600 uppercase mb-4 tracking-widest">DİĞER VERİLER</p>
                        {['category', 'level', 'school', 'city', 'district'].map(f => (
                            <select key={f} className="w-full p-3 bg-white rounded-xl text-[10px] font-bold mb-1 border-none" value={mapping[f]} onChange={e=>setMapping({...mapping, [f]: e.target.value})}>
                                <option value="">--- {f.toUpperCase()} Seç ---</option>
                                {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        ))}
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={finalizeImport} className="flex-1 bg-slate-900 text-white py-6 rounded-[2.5rem] font-black hover:bg-indigo-600 transition-all uppercase tracking-widest text-sm">AKTARMAYI BAŞLAT</button>
                    <button onClick={()=>setShowImportWizard(false)} className="px-10 bg-slate-100 text-slate-400 py-6 rounded-[2.5rem] font-bold uppercase text-xs">VAZGEÇ</button>
                </div>
            </div>
        </div>
      )}

      {/* SOL PANEL: KAYIT FORMU */}
      <div className="col-span-12 lg:col-span-5 space-y-6">
        <div className="bg-white p-10 rounded-[4rem] shadow-xl border border-slate-100 text-left">
          <h4 className="font-black text-slate-800 text-xl uppercase mb-8 border-l-4 border-indigo-600 pl-4 italic">Kayıt Masası</h4>
          <div className="space-y-4">
            <div className="flex gap-2">
                <UserPlus size={16} className="text-indigo-600 mt-4" />
                <input value={pForm.name} onChange={e=>setPForm({...pForm, name:e.target.value})} placeholder="Ad Soyad" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner outline-none focus:ring-2 focus:ring-indigo-100"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="flex gap-2"><Fingerprint size={16} className="text-slate-400 mt-4"/><input value={pForm.tc} onChange={e=>setPForm({...pForm, tc:e.target.value})} placeholder="TC No" className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none border-none shadow-inner"/></div>
                <div className="flex gap-2"><Tag size={16} className="text-slate-400 mt-4"/><input value={pForm.category} onChange={e=>setPForm({...pForm, category:e.target.value})} placeholder="Kategori" className="w-full p-3 bg-slate-50 rounded-xl font-bold outline-none border-none shadow-inner"/></div>
            </div>
            <div className="flex gap-2">
                <Layers size={16} className="text-slate-400 mt-4" />
                <input value={pForm.level} onChange={e=>setPForm({...pForm, level:e.target.value})} placeholder="Kademe (İlkokul/Ortaokul)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner outline-none focus:ring-2 focus:ring-indigo-100"/>
            </div>
            <input value={pForm.school} onChange={e=>setPForm({...pForm, school:e.target.value})} placeholder="Kurum Adı" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none shadow-inner outline-none focus:ring-2 focus:ring-indigo-100"/>
            <div className="flex gap-4"><input value={pForm.city} onChange={e=>setPForm({...pForm, city:e.target.value})} placeholder="İl" className="w-full p-4 bg-slate-50 rounded-2xl font-bold shadow-inner border-none outline-none"/><input value={pForm.district} onChange={e=>setPForm({...pForm, district:e.target.value})} placeholder="İlçe" className="w-full p-4 bg-slate-50 rounded-2xl font-bold shadow-inner border-none outline-none"/></div>
            
            <button onClick={addPlayer} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black shadow-2xl hover:bg-indigo-600 transition-all uppercase tracking-widest text-sm">SİSTEME KAYDET</button>
            <div className="h-px bg-slate-100 my-4"></div>
            <label className="flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed border-indigo-200 rounded-[2.5rem] cursor-pointer hover:bg-indigo-50 transition-all text-indigo-600 font-black text-sm uppercase tracking-widest leading-none text-center">
                <FileSpreadsheet size={24}/> EXCEL SİHİRBAZINI AÇ <input type="file" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>
        </div>
      </div>

      {/* SAĞ PANEL: LİSTE */}
      <div className="col-span-12 lg:col-span-7 bg-white p-10 rounded-[4rem] shadow-sm border max-h-[800px] overflow-auto border-slate-100 relative group">
        <button onClick={clearTournamentData} className="absolute top-8 right-10 p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-md z-10"><Trash2 size={24}/></button>
        <h4 className="font-black text-xl text-slate-800 mb-8 flex justify-between uppercase opacity-40 italic tracking-widest pr-20">Mevcut Liste <span>{players.length} Oyuncu</span></h4>
        <div className="grid gap-4">
          {players.sort((a,b)=>a.bNo - b.bNo).map((p) => (
            <div key={p.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group/item hover:bg-white hover:shadow-xl transition-all">
              <div className="flex items-center gap-5 text-left text-slate-800">
                <span className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-lg">{p.bNo}</span>
                <div className="overflow-hidden">
                  <h5 className="font-black uppercase text-base truncate max-w-[200px]">{p.name}</h5>
                  <div className="flex gap-4 mt-1 opacity-50 text-[9px] font-black uppercase tracking-widest leading-none italic">
                    <span className="flex items-center gap-1"><School size={12}/> {p.school || '-'}</span>
                    <span className="flex items-center gap-1"><MapPin size={12}/> {p.city || '-'}/{p.district || '-'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingPlayer(p)} className="p-3 text-indigo-300 hover:text-indigo-600 transition-all opacity-0 group-hover/item:opacity-100"><Edit2 size={20}/></button>
                <button onClick={async()=> {if(confirm('Sil?')) await deleteDoc(doc(db,"players",p.id))}} className="p-3 text-red-200 hover:text-red-500 transition-all opacity-0 group-hover/item:opacity-100"><Trash2 size={20}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
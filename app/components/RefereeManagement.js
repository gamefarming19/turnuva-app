"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { UserPlus, FileSpreadsheet, Clipboard, Trash2, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

export default function RefereeManagement({ user, tournaments }) {
  const [referees, setReferees] = useState([]);
  const [refForm, setRefForm] = useState({ name: "", email: "", password: "" });
  const [pastedRefs, setPastedRefs] = useState("");

  useEffect(() => {
    if (!user) return;
    const qR = query(collection(db, "users"), where("role", "==", "referee"), where("ownerUid", "==", user.uid));
    return onSnapshot(qR, (snap) => setReferees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const callCreateRefAPI = async (name, email, password) => {
    const res = await fetch('/api/create-referee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, ownerUid: user.uid })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
  };

  const updateRefAuthority = async (refId, tIds, tableMap) => {
    await updateDoc(doc(db, "users", refId), { assignedTournaments: tIds, tournamentTables: tableMap });
    Swal.fire({ title: "Güncellendi", icon: "success", timer: 500, showConfirmButton: false });
  };

  return (
    <div className="max-w-6xl animate-in fade-in">
      <h2 className="text-3xl font-black mb-8 text-slate-800 tracking-tighter uppercase italic opacity-80">Hakem Yetki Merkezi</h2>
      <div className="grid grid-cols-12 gap-8 mb-10">
        <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-[3.5rem] shadow-sm border">
          <div className="space-y-6">
            <div className="space-y-2 bg-slate-50 p-4 rounded-3xl">
              <input value={refForm.name} onChange={e=>setRefForm({...refForm, name: e.target.value})} placeholder="Ad Soyad" className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none border border-slate-100"/>
              <div className="flex gap-2">
                <input value={refForm.email} onChange={e=>setRefForm({...refForm, email: e.target.value})} placeholder="E-posta" className="flex-1 p-3 bg-white rounded-xl text-xs font-bold outline-none border border-slate-100"/>
                <input value={refForm.password} onChange={e=>setRefForm({...refForm, password: e.target.value})} placeholder="Şifre" className="w-32 p-3 bg-white rounded-xl text-xs font-bold outline-none border border-slate-100"/>
              </div>
              <button onClick={async () => {
                Swal.fire({title:'Kaydediliyor...'});
                try { await callCreateRefAPI(refForm.name, refForm.email, refForm.password); setRefForm({name:"",email:"",password:""}); Swal.fire("Başarılı","","success"); } catch(e) {Swal.fire("Hata",e.message,"error");}
              }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg mt-2">HAKEMİ KAYDET</button>
            </div>
            <label className="flex items-center justify-center gap-2 w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 transition text-slate-500 font-bold text-xs uppercase tracking-widest"><FileSpreadsheet size={20} className="text-emerald-500"/> EXCEL YÜKLE <input type="file" className="hidden" onChange={(e)=>{
                const reader = new FileReader(); reader.onload = async (evt) => {
                    const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result,{type:"binary"}).Sheets[XLSX.read(evt.target.result,{type:"binary"}).SheetNames[0]]);
                    for(const h of data) { try { await callCreateRefAPI(h.Isim||h.Name, h.Email, h.Sifre||"123456"); } catch(e){} }
                    Swal.fire("Bitti","","success");
                }; reader.readAsBinaryString(e.target.files[0]);
            }} /></label>
            <textarea value={pastedRefs} onChange={e => setPastedRefs(e.target.value)} placeholder="İsim, Email, Şifre (Virgül ile)" className="w-full h-24 p-4 bg-indigo-50/30 rounded-2xl text-[10px] outline-none" />
            <button onClick={async () => {
                const lines = pastedRefs.split("\n").filter(l => l.includes(","));
                for(const l of lines) { const [n,e,p] = l.split(",").map(x=>x.trim()); try{await callCreateRefAPI(n,e,p)}catch(e){} }
                setPastedRefs(""); Swal.fire("Bitti","","success");
            }} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase"><Clipboard size={14} className="inline mr-2"/> Panodan Ekle</button>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-7 space-y-4 max-h-[800px] overflow-auto pr-2">
          {referees.map((ref) => (
            <div key={ref.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">{ref.name?.[0]}</div><div className="text-left"><h3 className="text-sm font-black text-slate-800">{ref.name}</h3><p className="text-[9px] text-slate-400 font-bold">{ref.email}</p></div></div>
                <button onClick={async () => {if(confirm('Sil?')) await fetch('/api/delete-user',{method:'POST', body:JSON.stringify({uid:ref.id})}); Swal.fire("Silindi","","success"); }}><Trash2 size={18} className="text-red-200 hover:text-red-500"/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tournaments.map(t => {
                  const isAssigned = ref.assignedTournaments?.includes(t.id);
                  return (
                    <div key={t.id} onClick={() => {
                        const newList = isAssigned ? ref.assignedTournaments.filter(id => id !== t.id) : [...(ref.assignedTournaments || []), t.id];
                        updateRefAuthority(ref.id, newList, ref.tournamentTables || {});
                    }} className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${isAssigned ? 'border-indigo-600 bg-indigo-50/30 shadow-sm' : 'border-slate-50 opacity-40 hover:opacity-100'}`}>
                      <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-black uppercase">{t.name}</span>{isAssigned && <CheckCircle2 size={14} className="text-indigo-600" />}</div>
                      {isAssigned && <input onClick={e=>e.stopPropagation()} placeholder="Masalar: 1, 2" defaultValue={ref.tournamentTables?.[t.id]?.join(", ")} className="w-full bg-white p-2 rounded-lg text-[10px] font-bold text-indigo-600 outline-none border border-indigo-50" onBlur={(e) => updateRefAuthority(ref.id, ref.assignedTournaments, { ...(ref.tournamentTables || {}), [t.id]: e.target.value.split(",").map(x=>x.trim()) })} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
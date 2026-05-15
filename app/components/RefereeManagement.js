"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, doc, 
  updateDoc, increment, getDocs, writeBatch 
} from "firebase/firestore";
import { 
  UserPlus, FileSpreadsheet, Clipboard, Trash2, CheckCircle2, 
  PauseCircle, PlayCircle, MessageSquare, Key, Lock, X, Database, Phone, Hash 
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

export default function RefereeManagement({ user, tournaments, isDemo }) {
  const [referees, setReferees] = useState([]);
  const [refForm, setRefForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [pastedRefs, setPastedRefs] = useState("");
  
  // Excel Sihirbazı
  const [showWizard, setShowWizard] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ name: "", email: "", phone: "", password: "" });

  useEffect(() => {
    if (!user) return;
    const qR = query(collection(db, "users"), where("role", "==", "referee"), where("ownerUid", "==", user.uid));
    return onSnapshot(qR, (snap) => setReferees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  // --- API ÇAĞRISI ---
  const callCreateRefAPI = async (name, email, password, phone) => {
    const res = await fetch('/api/create-referee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone: phone || "", ownerUid: user.uid })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sunucu hatası");
    return data;
  };

  // --- HAKEM EKLEME (TEKLİ) ---
  const handleAddReferee = async () => {
    if (isDemo && referees.length >= 2) return Swal.fire("Demo Sınırı", "En fazla 2 hakem ekleyebilirsiniz.", "warning");
    if (!refForm.name || !refForm.email || !refForm.password) return Swal.fire("Hata", "Ad, Email ve Şifre zorunludur.", "error");

    Swal.fire({ title: 'Hakem Kaydediliyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await callCreateRefAPI(refForm.name, refForm.email, refForm.password, refForm.phone);
      setRefForm({ name: "", email: "", password: "", phone: "" });
      Swal.fire("Başarılı", "Hakem oluşturuldu.", "success");
    } catch (e) { Swal.fire("Hata", e.message, "error"); }
  };

  // --- EXCEL SİHİRBAZI ---
  const handleFileSelect = (e) => {
    if (isDemo) return Swal.fire("Kilitli", "Excel yükleme sadece PRO lisans içindir.", "lock");
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (data.length > 0) {
        setExcelRows(data);
        setHeaders(Object.keys(data[0]));
        setShowWizard(true);
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const finalizeImport = async () => {
    if (!mapping.name || !mapping.email) return Swal.fire("Hata", "Eşleştirme eksik.", "error");
    
    Swal.fire({ title: 'İşleniyor...', text: 'Kayıtlı olanlar atlanıyor.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    let success = 0;
    let skipped = 0;

    for (const row of excelRows) {
      try {
        const name = row[mapping.name];
        const email = row[mapping.email];
        const phone = mapping.phone ? row[mapping.phone] : "";
        const pass = mapping.password ? row[mapping.password] : "123456";
        
        if (name && email) {
          await callCreateRefAPI(String(name), String(email).trim(), String(pass), String(phone));
          success++;
        }
      } catch (e) {
        if (e.message.includes("already-in-use")) skipped++;
        else console.error(e);
      }
    }
    
    setShowWizard(false);
    Swal.fire("İşlem Tamam", `${success} hakem eklendi, ${skipped} hakem zaten kayıtlı olduğu için atlandı.`, "info");
  };

  // --- ŞİFRE SIFIRLAMA (ANAHTAR BUTONU) ---
// --- 🔑 ŞİFRE SIFIRLAMA FONKSİYONU ---
  const resetPassword = async (ref) => {
    const { value: newPass } = await Swal.fire({
      title: 'Geçici Şifre Ata',
      text: `${ref.name} için yeni bir geçici şifre belirleyin.`,
      input: 'text',
      // inputValue: '123456',  <-- BU SATIRI SİLDİK
      inputPlaceholder: 'Yeni geçici şifreyi buraya yazın...', // 👈 BURAYI EKLEDİK
      showCancelButton: true,
      confirmButtonText: 'Şifreyi Güncelle',
      cancelButtonText: 'Vazgeç',
      background: '#1e293b',
      color: '#fff',
      // Boş bırakılmasını engellemek için kontrol ekleyelim:
      inputValidator: (value) => {
        if (!value) {
          return 'Lütfen bir şifre yazın!'
        }
        if (value.length < 6) {
          return 'Güvenlik için en az 6 karakter olmalı!'
        }
      }
    });

    // Eğer iptal etmediyse ve bir şifre yazdıysa
    if (newPass) {
      Swal.fire({ title: 'Güncelleniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            uid: ref.id, 
            newPassword: newPass 
          })
        });

        if (res.ok) {
          Swal.fire("Başarılı", `Şifre "${newPass}" olarak güncellendi.`, "success");
        } else {
          const data = await res.json();
          throw new Error(data.error);
        }
      } catch (e) {
        Swal.fire("Hata", e.message, "error");
      }
    }
  };

  const sendWhatsApp = (ref) => {
    if (!ref.phone) return Swal.fire("Hata", "Telefon yok.", "error");
    let clean = ref.phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '90' + clean.substring(1);
    window.open(`https://wa.me/${clean.startsWith('90') ? clean : '90'+clean}?text=${encodeURIComponent('Panel linkiniz: ' + window.location.origin + '/referee')}`);
  };

  const updateRefAuthority = async (refId, tIds, tableMap, extra = {}) => {
    await updateDoc(doc(db, "users", refId), { assignedTournaments: tIds, tournamentTables: tableMap, ...extra });
    Swal.fire({ title: "Güncellendi", icon: "success", timer: 600, showConfirmButton: false });
  };

  return (
    <div className="max-w-7xl animate-in fade-in p-2">
      
      {/* 🧙‍♂️ EXCEL SİHİRBAZI */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[600] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2 uppercase"><Database className="text-indigo-600"/> Sütun Eşleştirme</h3>
                <div className="grid grid-cols-1 gap-3 mb-8">
                    {['name', 'email', 'phone', 'password'].map(field => (
                        <div key={field} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl">
                            <label className="w-24 text-[10px] font-black text-slate-400 uppercase">{field}</label>
                            <select className="flex-1 p-2 bg-white rounded-xl text-xs font-bold outline-none border border-slate-200" onChange={e=>setMapping({...mapping, [field]: e.target.value})}>
                                <option value="">--- Seç ---</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button onClick={finalizeImport} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs">BAŞLAT</button>
                    <button onClick={()=>setShowWizard(false)} className="px-6 bg-slate-100 text-slate-400 py-4 rounded-2xl font-bold uppercase text-xs">İPTAL</button>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        {/* SOL: KAYIT */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100 text-left">
            <h4 className="font-black text-slate-800 text-xl uppercase mb-6 border-l-4 border-indigo-600 pl-4">Hakem Kaydı</h4>
            <div className="space-y-4">
              <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                <input value={refForm.name} onChange={e=>setRefForm({...refForm, name: e.target.value})} placeholder="Ad Soyad" className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-slate-100"/>
                <div className="flex gap-2">
                    <input value={refForm.email} onChange={e=>setRefForm({...refForm, email: e.target.value})} placeholder="E-posta" className="flex-1 p-4 bg-white rounded-2xl font-bold outline-none border border-slate-100 text-sm"/>
                    <input value={refForm.password} onChange={e=>setRefForm({...refForm, password: e.target.value})} placeholder="Şifre" className="w-32 p-4 bg-white rounded-2xl font-bold outline-none border border-slate-100 text-sm"/>
                </div>
                <div className="flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-100"><Phone size={18} className="text-slate-400"/><input value={refForm.phone} onChange={e=>setRefForm({...refForm, phone: e.target.value})} placeholder="905..." className="w-full font-bold outline-none text-sm"/></div>
                <button onClick={handleAddReferee} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-indigo-100">HAKEMİ KAYDET</button>
              </div>
              <label className={`flex items-center justify-center gap-2 w-full py-5 border-2 border-dashed rounded-[2rem] transition-all text-xs font-black uppercase ${isDemo ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' : 'border-emerald-200 text-emerald-600 cursor-pointer hover:bg-emerald-50'}`}>
                  <FileSpreadsheet size={20}/> EXCEL LİSTESİ {isDemo && <Lock size={14}/>}
                  {!isDemo && <input type="file" className="hidden" onChange={handleFileSelect} />}
              </label>
            </div>
          </div>
        </div>

        {/* SAĞ: LİSTE */}
        <div className="col-span-12 lg:col-span-7 space-y-4 max-h-[85vh] overflow-auto pr-2 text-left">
          {referees.map((ref) => (
            <div key={ref.id} className={`bg-white p-6 rounded-[2.5rem] border transition-all ${ref.status === 'suspended' ? 'opacity-40 grayscale bg-slate-50 border-slate-200' : 'border-slate-100 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black">{ref.name?.[0]}</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase leading-none">{ref.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">{ref.email}</p>
                    <div className="flex gap-2 mt-3">
                        <button onClick={() => sendWhatsApp(ref)} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><MessageSquare size={16}/></button>
                        <button onClick={() => resetPassword(ref)} className="p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all"><Key size={16}/></button>
                        <button onClick={() => updateRefAuthority(ref.id, ref.assignedTournaments, ref.tournamentTables, { status: ref.status === 'suspended' ? 'active' : 'suspended' })} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${ref.status === 'suspended' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{ref.status === 'suspended' ? 'Yetkiyi Aç' : 'Askıya Al'}</button>
                    </div>
                  </div>
                </div>
                <button onClick={async () => {
                    const confirm = await Swal.fire({ title:'Hesabı Sil?', text:'Giriş yetkisi dahil her şey silinecek!', icon:'warning', showCancelButton:true });
                    if(confirm.isConfirmed) { await fetch('/api/delete-user',{method:'POST', body:JSON.stringify({uid:ref.id})}); }
                }}><Trash2 size={18} className="text-slate-200 hover:text-rose-500"/></button>
              </div>

              {/* TURNUVALAR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tournaments.map(t => {
                  const isAssigned = ref.assignedTournaments?.includes(t.id);
                  return (
                    <div key={t.id} onClick={() => {
                        const newList = isAssigned ? ref.assignedTournaments.filter(id => id !== t.id) : [...(ref.assignedTournaments || []), t.id];
                        updateRefAuthority(ref.id, newList, ref.tournamentTables || {});
                    }} className={`p-4 rounded-3xl border-2 cursor-pointer transition-all ${isAssigned ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-50 opacity-40 hover:opacity-100'}`}>
                      <div className="flex justify-between items-center mb-2 font-black text-[9px] text-slate-700 uppercase"><span>{t.name}</span>{isAssigned && <CheckCircle2 size={14} className="text-indigo-600" />}</div>
                      {isAssigned && <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl shadow-inner"><Hash size={12} className="text-slate-300"/><input onClick={e=>e.stopPropagation()} placeholder="Masalar: 1, 2" defaultValue={ref.tournamentTables?.[t.id]?.join(", ")} className="w-full bg-transparent text-[11px] font-black text-indigo-600 outline-none h-8" onBlur={(e) => { const val = e.target.value.split(",").map(x=>x.trim()).filter(x=>x!==""); updateRefAuthority(ref.id, ref.assignedTournaments, { ...(ref.tournamentTables || {}), [t.id]: val }); }} /></div>}
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
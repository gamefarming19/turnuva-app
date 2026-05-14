"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ShieldAlert, CheckCircle, XCircle, Clock, Trash2, LogOut } from "lucide-react";
import Swal from "sweetalert2";

export default function SuperAdminPage() {
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Yetki Kontrolü
  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (!u) router.push("/login");
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.data()?.role !== "superadmin") router.push("/admin");
      else setLoading(false);
    });
  }, [router]);

  // Koordinatörleri Çek
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    return onSnapshot(q, (snap) => setCoordinators(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const setLicense = async (uid, days) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    await updateDoc(doc(db, "users", uid), {
      isLicensed: true,
      licenseExpires: Timestamp.fromDate(expiry),
      licenseType: days === 1 ? "Günlük" : days === 7 ? "Haftalık" : days === 30 ? "Aylık" : "Yıllık"
    });
    Swal.fire("Başarılı", "Lisans Tanımlandı", "success");
  };

  const toggleLicense = async (uid, status) => {
    await updateDoc(doc(db, "users", uid), { isLicensed: status });
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                <ShieldAlert className="text-indigo-500" size={36}/> SÜPER ADMİN PANELİ
            </h1>
            <button onClick={() => signOut(auth)} className="p-4 bg-slate-800 text-red-500 rounded-3xl"><LogOut/></button>
        </div>

        <div className="grid gap-6">
          {coordinators.map(c => (
            <div key={c.id} className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 flex justify-between items-center shadow-xl">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{c.name}</h3>
                <p className="text-slate-500 text-xs font-bold">{c.email}</p>
                <div className="mt-4 flex gap-3">
                  {c.isLicensed ? (
                    <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                        <CheckCircle size={12}/> AKTİF ({c.licenseType})
                    </span>
                  ) : (
                    <span className="bg-rose-500/10 text-rose-500 px-4 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                        <XCircle size={12}/> LİSANS YOK
                    </span>
                  )}
                  {c.licenseExpires && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Bitiş: {c.licenseExpires.toDate().toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setLicense(c.id, 1)} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all">Günlük</button>
                <button onClick={() => setLicense(c.id, 7)} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all">Haftalık</button>
                <button onClick={() => setLicense(c.id, 30)} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all">Aylık</button>
                <button onClick={() => setLicense(c.id, 365)} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all">Yıllık</button>
                <button onClick={() => toggleLicense(c.id, false)} className="bg-red-500/10 text-red-500 p-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, doc, 
  updateDoc, deleteDoc, Timestamp, getDoc // 👈 getDoc buraya eklendi
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ShieldAlert, CheckCircle, XCircle, Clock, Trash2, LogOut, UserCircle } from "lucide-react";
import Swal from "sweetalert2";

export default function SuperAdminPage() {
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. YETKİ KONTROLÜ (Süper Admin mi?)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }

      try {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists() && snap.data().role === "superadmin") {
          setLoading(false);
        } else {
          // Süper admin değilse normal admin paneline at
          router.push("/admin");
        }
      } catch (error) {
        console.error("Yetki kontrol hatası:", error);
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // 2. KOORDİNATÖRLERİ (ADMINLERİ) CANLI DİNLE
  useEffect(() => {
    // Sadece rolü 'admin' olanları getir
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    const unsub = onSnapshot(q, (snap) => {
      setCoordinators(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Veri çekme hatası:", error);
    });
    return () => unsub();
  }, []);

  // 3. LİSANS ATAMA FONKSİYONU
  const setLicense = async (uid, days) => {
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      
      await updateDoc(doc(db, "users", uid), {
        isLicensed: true,
        licenseExpires: Timestamp.fromDate(expiry),
        licenseType: days === 1 ? "Günlük" : days === 7 ? "Haftalık" : days === 30 ? "Aylık" : "Yıllık",
        status: "active"
      });

      Swal.fire({
        title: "Lisans Tanımlandı",
        text: `${days} günlük kullanım yetkisi verildi.`,
        icon: "success",
        background: "#1e293b",
        color: "#fff"
      });
    } catch (error) {
      Swal.fire("Hata", "Lisans güncellenemedi.", "error");
    }
  };

  // 4. LİSANS İPTAL ETME
  const revokeLicense = async (uid) => {
    const confirm = await Swal.fire({
      title: 'Lisansı İptal Et?',
      text: "Koordinatörün sisteme girişi engellenecektir.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, İptal Et',
      cancelButtonText: 'Vazgeç',
      background: "#1e293b",
      color: "#fff"
    });

    if (confirm.isConfirmed) {
      await updateDoc(doc(db, "users", uid), {
        isLicensed: false,
        licenseType: null,
        status: "suspended"
      });
      Swal.fire("İptal Edildi", "", "success");
    }
  };

  // 5. KULLANICIYI SİSTEMDEN SİL
const deleteCoordinator = async (uid, name) => {
    const confirm = await Swal.fire({
      title: 'EMİN MİSİNİZ?',
      text: `${name} ve ona ait TÜM veriler (Turnuvalar, Hakemler, Maçlar) kalıcı olarak silinecek!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Evet, Her Şeyi Yok Et',
      cancelButtonText: 'Vazgeç',
      background: "#0f172a",
      color: "#fff"
    });

    if (confirm.isConfirmed) {
      Swal.fire({
        title: 'Büyük Temizlik Yapılıyor...',
        text: 'Lütfen bekleyin, tüm veritabanı taranıyor.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        background: "#0f172a",
        color: "#fff"
      });
      
      try {
        const res = await fetch('/api/delete-coordinator', {
          method: 'POST',
          body: JSON.stringify({ uid }) 
        });

        if (res.ok) {
          Swal.fire("Sistem Temizlendi!", "Koordinatör ve tüm verileri silindi.", "success");
        } else {
          throw new Error("API hatası oluştu.");
        }
      } catch (e) {
        Swal.fire("Hata", "Bazı veriler silinememiş olabilir. Manuel kontrol edin.", "error");
      }
    }
  };

const handleWipeSystem = async () => {
    const confirm = await Swal.fire({
      title: 'TÜM SİSTEMİ SIFIRLA?',
      text: "Kendi hesabınız hariç tüm koordinatörler, hakemler, turnuvalar ve maçlar kalıcı olarak silinecek! Bu işlem geri alınamaz.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Evet, Her Şeyi Sil',
      background: "#0f172a",
      color: "#fff"
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Fabrika Ayarlarına Dönülüyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      try {
        const res = await fetch('/api/wipe-system', {
          method: 'POST',
          body: JSON.stringify({ myUid: auth.currentUser.uid })
        });

        if (res.ok) {
          Swal.fire("Sistem Sıfırlandı!", "Pırıl pırıl bir başlangıç yapabilirsiniz.", "success");
        }
      } catch (e) {
        Swal.fire("Hata", "Sıfırlama başarısız.", "error");
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold tracking-widest uppercase text-xs">Yetki Kontrol Ediliyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-500/20">
                    <ShieldAlert size={32}/>
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">SÜPER ADMİN</h1>
                    <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">Sistem Lisans Yönetimi</p>
                </div>
            </div>
                  <button 
            onClick={() => handleWipeSystem(auth.currentUser.uid)} 
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg border border-red-500/20 group"
        >
            <Trash2 size={16} className="group-hover:animate-bounce" />
            Sistemi Sıfırla
        </button>
            <button 
                onClick={() => signOut(auth).then(() => router.push("/login"))}
                className="flex items-center gap-2 bg-slate-800 hover:bg-red-500 text-red-500 hover:text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg"
            >
                <LogOut size={20}/> GÜVENLİ ÇIKIŞ
            </button>

                

        </div>

        {/* KOORDİNATÖR LİSTESİ */}
        <div className="grid gap-6">
          {coordinators.length === 0 ? (
            <div className="text-center py-20 bg-slate-900 rounded-[3rem] border border-dashed border-slate-800 text-slate-500 font-bold uppercase tracking-widest">
                Henüz kayıtlı koordinatör bulunmuyor.
            </div>
          ) : (
            coordinators.map(c => (
              <div key={c.id} className="bg-slate-900 p-8 rounded-[3.5rem] border border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-8 shadow-xl hover:border-indigo-500/50 transition-all group">
                
                {/* Bilgiler */}
                <div className="flex items-center gap-5 flex-1 w-full">
                  <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-indigo-500 border border-slate-700 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <UserCircle size={40} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">{c.name || 'İsimsiz Kullanıcı'}</h3>
                    <p className="text-slate-500 text-sm font-medium truncate mb-2">{c.email}</p>
                    
                    <div className="flex flex-wrap gap-2">
                        {c.isLicensed ? (
                            <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-emerald-500/20">
                                <CheckCircle size={12}/> AKTİF ({c.licenseType})
                            </div>
                        ) : (
                            <div className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-rose-500/20">
                                <XCircle size={12}/> LİSANS YOK
                            </div>
                        )}
                        {c.licenseExpires && (
                            <div className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                                <Clock size={12}/> {c.licenseExpires.toDate().toLocaleDateString('tr-TR')}
                            </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* İşlemler */}
                <div className="flex flex-wrap gap-2 justify-center lg:justify-end w-full lg:w-auto border-t lg:border-t-0 border-slate-800 pt-6 lg:pt-0">
                  <button onClick={() => setLicense(c.id, 1)} className="bg-slate-800 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">Günlük</button>
                  <button onClick={() => setLicense(c.id, 7)} className="bg-slate-800 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">Haftalık</button>
                  <button onClick={() => setLicense(c.id, 30)} className="bg-slate-800 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">Aylık</button>
                  <button onClick={() => setLicense(c.id, 365)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">Yıllık</button>
                  
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => revokeLicense(c.id)} title="Lisans İptal" className="bg-rose-500/10 text-rose-500 p-3 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                        <XCircle size={20}/>
                    </button>
                    <button onClick={() => deleteCoordinator(c.id)} title="Hesabı Sil" className="bg-red-600 text-white p-3 rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20">
                        <Trash2 size={20}/>
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, query, where, collection, updateDoc, getDoc, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import CreateTournament from "../components/CreateTournament";
import TournamentManagement from "../components/TournamentManagement";
import RefereeManagement from "../components/RefereeManagement";
import { ArrowRight, Trash2, Globe, Check, ChevronLeft } from "lucide-react";
import Swal from "sweetalert2";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedT, setSelectedT] = useState(null);

  // 1. OTURUM KONTROLÜ VE KULLANICI VERİSİNİ CANLI DİNLE
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Kullanıcı dökümanını canlı dinle (spectatorCode değişimini anlık yakalamak için)
        const userRef = doc(db, "users", u.uid);
        onSnapshot(userRef, (snap) => {
          if (snap.exists() && snap.data().role === "admin") {
            setUser({ uid: u.uid, ...snap.data() });
            updateDoc(userRef, { systemActive: true });
          } else {
            signOut(auth);
            router.push("/login");
          }
        });
      } else {
        router.push("/login");
      }
    });
    return () => unsubAuth();
  }, [router]);

  // 2. TURNUVALARI ÇEK
  useEffect(() => {
    if (!user?.uid) return;
    const qT = query(collection(db, "tournaments"), where("ownerUid", "==", user.uid));
    return onSnapshot(qT, (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user?.uid]);

  // 3. GÜVENLİ ÇIKIŞ
  const handleLogoutWithLock = async () => {
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { systemActive: false });
      await signOut(auth);
      router.push("/login");
    }
  };

  // 4. PORTAL ERİŞİM KODUNU GÜNCELLE
  const handlePortalCodeUpdate = async (newCode) => {
    const cleanCode = newCode.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (!cleanCode || cleanCode === user.spectatorCode) return;

    try {
      // Kodun benzersizlik kontrolü
      const q = query(collection(db, "users"), where("spectatorCode", "==", cleanCode));
      const snap = await getDocs(q);
      
      if (!snap.empty && snap.docs[0].id !== user.uid) {
        return Swal.fire("Hata", "Bu kod başka bir koordinatör tarafından kullanılıyor!", "error");
      }

      await updateDoc(doc(db, "users", user.uid), { spectatorCode: cleanCode });
      Swal.fire({ title: "Portal Hazır!", text: `Kodunuz: ${cleanCode}`, icon: "success", timer: 1500 });
    } catch (e) {
      Swal.fire("Hata", "Kod güncellenemedi.", "error");
    }
  };

  // 5. TURNUVA SİLME
  const handleDeleteTournament = async (tId, tName) => {
    const confirm = await Swal.fire({
      title: 'EMİN MİSİNİZ?',
      text: `"${tName}" kalıcı olarak silinecektir!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, Sil',
      confirmButtonColor: '#d33'
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Siliniyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const batch = writeBatch(db);
      const pSnap = await getDocs(query(collection(db, "players"), where("tournamentId", "==", tId)));
      pSnap.forEach(d => batch.delete(d.ref));
      const mSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
      mSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "tournaments", tId));
      await batch.commit();
      Swal.fire("Silindi", "", "success");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogoutWithLock} 
      />
      
      <main className="flex-1 ml-64 p-8">
        
        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="max-w-5xl animate-in fade-in">
            <h2 className="text-4xl font-black mb-10 tracking-tighter uppercase text-slate-800">Turnuvalarım</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map(t => (
                <div key={t.id} className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-200 group hover:shadow-xl transition-all relative">
                  <button onClick={() => handleDeleteTournament(t.id, t.name)} className="absolute top-6 right-6 p-3 text-slate-200 hover:text-red-500 transition-colors z-10"><Trash2 size={20}/></button>
                  <h3 className="text-2xl font-black text-slate-800 mb-6">{t.name}</h3>
                  <button onClick={() => { setSelectedT(t); setActiveTab('management'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 group-hover:bg-indigo-600 transition-all text-sm uppercase">Yönetime Git <ArrowRight size={18} /></button>
                </div>
              ))}
              {tournaments.length === 0 && <p className="col-span-2 text-center py-20 text-slate-400 font-bold italic border-2 border-dashed rounded-[3rem]">Henüz bir turnuva oluşturmadınız.</p>}
            </div>
          </div>
        )}

        {/* TAB: PORTAL AYARLARI */}
        {activeTab === 'portal' && (
          <div className="max-w-4xl animate-in fade-in">
            <h2 className="text-3xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic">İzleyici Portalı Ayarları</h2>
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-4 mb-8 bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                <div className="bg-indigo-600 p-3 rounded-2xl text-white"><Globe size={24}/></div>
                <div>
                  <h4 className="font-black text-indigo-900 text-lg uppercase leading-none">Genel Erişim Kodu</h4>
                  <p className="text-indigo-400 text-xs font-bold mt-1 uppercase italic">Bu kod, tüm turnuvalarınızın anahtarıdır.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Özel Erişim Kodunuz</label>
                  <input 
                    defaultValue={user?.spectatorCode || ""}
                    onBlur={(e) => handlePortalCodeUpdate(e.target.value)}
                    placeholder="Örn: denizli20"
                    className="w-full bg-slate-50 p-6 rounded-3xl font-black text-2xl text-indigo-600 outline-none border-2 border-transparent focus:border-indigo-500 transition-all shadow-inner"
                  />
                  <p className="text-[10px] text-slate-400 font-bold italic ml-2">* Veliler bu kodu kullanarak size ait turnuvalara ulaşır.</p>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Paylaşılabilir Link</label>
                   <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100 flex flex-col justify-between h-[120px]">
                      <p className="text-[10px] font-bold text-emerald-700 truncate opacity-60 uppercase mb-2">
                        {typeof window !== "undefined" ? `${window.location.origin}/portal/${user?.spectatorCode || "..."}` : ""}
                      </p>
                      <button 
                        onClick={() => {
                          if(!user?.spectatorCode) return Swal.fire("Uyarı", "Önce bir kod belirleyin", "warning");
                          navigator.clipboard.writeText(`${window.location.origin}/portal/${user.spectatorCode}`);
                          Swal.fire({ title: "Kopyalandı!", icon: "success", timer: 800, showConfirmButton: false });
                        }}
                        className="w-full bg-white text-emerald-600 py-3 rounded-2xl font-black text-xs shadow-sm hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest"
                      >
                        Linki Kopyala
                      </button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DİĞER MODÜLLER */}
        {activeTab === 'create' && <CreateTournament user={user} onSuccess={() => setActiveTab('dashboard')} />}
        {activeTab === 'players' && <RefereeManagement user={user} tournaments={tournaments} />}
        {activeTab === 'management' && selectedT && (
          <TournamentManagement 
            selectedT={selectedT} 
            setSelectedT={setSelectedT}
            onBack={() => setActiveTab('dashboard')} 
          />
        )}

      </main>
    </div>
  );
}
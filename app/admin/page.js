"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
// signOut buradan SİLİNDİ
import { doc, onSnapshot, query, where, collection, updateDoc, getDoc, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
// signOut buraya EKLENDİ
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import CreateTournament from "../components/CreateTournament";
import TournamentManagement from "../components/TournamentManagement";
import RefereeManagement from "../components/RefereeManagement";
import { ArrowRight, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedT, setSelectedT] = useState(null);

  // 1. OTURUM KONTROLÜ VE SİSTEMİ AÇMA
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().role === "admin") {
          setUser(u);
          await updateDoc(userRef, { systemActive: true });
        } else {
          await signOut(auth);
          router.push("/login");
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsub();
  }, [router]);

  // 2. TURNUVALARI ÇEK
  useEffect(() => {
    if (!user) return;
    const qT = query(collection(db, "tournaments"), where("ownerUid", "==", user.uid));
    return onSnapshot(qT, (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  // 3. GÜVENLİ ÇIKIŞ FONKSİYONU
  const handleLogoutWithLock = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { systemActive: false });
        await signOut(auth);
        router.push("/login");
      }
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  // 4. TURNUVAYI TÜM VERİLERİYLE SİLME (OYUNCU VE MAÇLAR DAHİL)
  const handleDeleteTournament = async (tId, tName) => {
    const confirm = await Swal.fire({
      title: 'EMİN MİSİNİZ?',
      text: `"${tName}" turnuvası, içindeki tüm oyuncular ve maçlarla birlikte kalıcı olarak silinecektir!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Evet, Her Şeyi Sil',
      cancelButtonText: 'Vazgeç',
      confirmButtonColor: '#d33'
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Temizlik Yapılıyor...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const batch = writeBatch(db);
        
        // Oyuncuları sil
        const playersSnap = await getDocs(query(collection(db, "players"), where("tournamentId", "==", tId)));
        playersSnap.forEach(d => batch.delete(d.ref));

        // Maçları sil
        const matchesSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
        matchesSnap.forEach(d => batch.delete(d.ref));

        // Turnuvanın kendisini sil
        batch.delete(doc(db, "tournaments", tId));

        await batch.commit();
        Swal.fire("Başarılı", "Turnuva tamamen silindi.", "success");
      } catch (e) {
        Swal.fire("Hata", "Silme işlemi sırasında bir hata oluştu.", "error");
      }
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
        
        {/* DASHBOARD - TURNUVA LİSTESİ */}
        {activeTab === 'dashboard' && (
          <div className="max-w-5xl animate-in fade-in duration-500">
            <h2 className="text-4xl font-black mb-10 tracking-tighter uppercase text-slate-800">Turnuvalarım</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map(t => (
                <div key={t.id} className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-200 group hover:shadow-xl transition-all relative overflow-hidden">
                  {/* SİLME BUTONU */}
                  <button 
                    onClick={() => handleDeleteTournament(t.id, t.name)}
                    className="absolute top-6 right-6 p-3 text-slate-200 hover:text-red-500 transition-colors z-10"
                  >
                    <Trash2 size={20}/>
                  </button>
                  
                  <h3 className="text-2xl font-black text-slate-800 mb-6 pr-10">{t.name}</h3>
                  <button 
                    onClick={() => { setSelectedT(t); setActiveTab('management'); }}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 group-hover:bg-indigo-600 transition-all uppercase text-sm"
                  >
                    Yönetime Git <ArrowRight size={18} />
                  </button>
                </div>
              ))}
              {tournaments.length === 0 && (
                <p className="col-span-2 text-center py-20 text-slate-400 font-bold italic border-2 border-dashed rounded-[3rem]">Henüz bir turnuva oluşturmadınız.</p>
              )}
            </div>
          </div>
        )}

        {/* DİĞER TABLAR (MODÜLER) */}
        {activeTab === 'create' && (
          <CreateTournament user={user} onSuccess={() => setActiveTab('dashboard')} />
        )}

        {activeTab === 'players' && (
          <RefereeManagement user={user} tournaments={tournaments} />
        )}

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
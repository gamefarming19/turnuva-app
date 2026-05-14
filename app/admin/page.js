"use client";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  doc, onSnapshot, query, where, collection, updateDoc, 
  getDoc, deleteDoc, getDocs, writeBatch, increment 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import CreateTournament from "../components/CreateTournament";
import TournamentManagement from "../components/TournamentManagement";
import RefereeManagement from "../components/RefereeManagement";
import { 
  ArrowRight, Trash2, Globe, Check, ChevronLeft, 
  Mail, Clock, ShieldCheck, Lock, AlertCircle, FileSpreadsheet, Clipboard 
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedT, setSelectedT] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [licenseStatus, setLicenseStatus] = useState("checking");
  const [isDemo, setIsDemo] = useState(false);

  // Form State'leri
  const [playerName, setPlayerName] = useState("");
  const [pastedNames, setPastedNames] = useState("");
  const [pastedRefs, setPastedRefs] = useState(""); 
  const [tName, setTName] = useState("");
  const [isEditingT, setIsEditingT] = useState(false);

  // 1. OTURUM VE LİSANS DENETİMİ
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        if (!u.emailVerified) {
          setLicenseStatus("unverified");
          return;
        }

        const userRef = doc(db, "users", u.uid);
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            const now = new Date();
            const expiryDate = userData.licenseExpires?.toDate();

            if (userData.role === "superadmin") {
              setLicenseStatus("active");
              setIsDemo(false);
            } else if (!userData.isLicensed) {
              setLicenseStatus("active"); // Paneli görsün ama kısıtlı
              setIsDemo(true);
            } else if (expiryDate && now > expiryDate) {
              setLicenseStatus("expired");
              setIsDemo(true);
            } else {
              setLicenseStatus("active");
              setIsDemo(false);
            }
            setUser({ uid: u.uid, ...userData });
            updateDoc(userRef, { systemActive: true });
          } else {
            signOut(auth);
            router.push("/login");
          }
        });
        return () => unsubUser();
      } else {
        router.push("/login");
      }
    });
    return () => unsubAuth();
  }, [router]);

  // 2. VERİ ÇEKME
  useEffect(() => {
    if (!user?.uid) return;
    const qT = query(collection(db, "tournaments"), where("ownerUid", "==", user.uid));
    return onSnapshot(qT, (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedT) return;
    const unsubP = onSnapshot(query(collection(db, "players"), where("tournamentId", "==", selectedT.id)), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubM = onSnapshot(query(collection(db, "matches"), where("tournamentId", "==", selectedT.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(data.sort((a, b) => b.round - a.round || a.tableNumber - b.tableNumber));
    });
    return () => { unsubP(); unsubM(); };
  }, [selectedT]);

  // --- 🛑 DEMO KISITLAMA FONKSİYONLARI 🛑 ---

  // 1. Turnuva Oluşturma Kısıtlaması
  const handleCreateTournament = async (data) => {
    if (isDemo && tournaments.length >= 1) {
      return Swal.fire("Demo Sınırı", "Deneme sürümünde sadece 1 turnuva açabilirsiniz. Lütfen lisans alın.", "warning");
    }
    // Normal akış devam eder (CreateTournament bileşenine prop olarak gönderilecek)
  };

  // 2. Oyuncu Ekleme Kısıtlaması
  const addPlayer = async () => {
    if (isDemo && players.length >= 12) {
      return Swal.fire("Oyuncu Sınırı", "Deneme sürümünde maksimum 12 oyuncu ekleyebilirsiniz.", "info");
    }
    if (!playerName || !selectedT) return;
    await addDoc(collection(db, "players"), { name: playerName.toUpperCase(), tournamentId: selectedT.id, points: 0, warnings: 0 });
    setPlayerName("");
  };

  // 3. Excel ve Pano Kısıtlaması
  const handleBatchBlock = () => {
    if (isDemo) {
      Swal.fire("PRO Özellik", "Excel ve Toplu Yükleme özellikleri sadece lisanslı kullanıcılara açıktır.", "lock");
      return true;
    }
    return false;
  };

  // 4. Tur Eşleştirme Kısıtlaması
  const generatePairings = async () => {
    const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;
    if (isDemo && currentRound >= 2) {
      return Swal.fire("Tur Sınırı", "Deneme sürümünde sadece 2 tur eşleştirebilirsiniz.", "warning");
    }
    
    if (matches.filter(m => m.status === 'pending').length > 0) return Swal.fire("Hata", "Turu bitirin", "error");
    const nextRound = currentRound + 1;
    let list = [...players].sort((a, b) => b.points - a.points);
    const batch = writeBatch(db);
    let table = 1;
    if (list.length % 2 !== 0) {
      const bay = list.pop();
      batch.set(doc(collection(db, "matches")), { tournamentId: selectedT.id, p1: bay.name, p2: "BYE", round: nextRound, tableNumber: 99, result: "1-0", status: "completed" });
      batch.update(doc(db, "players", bay.id), { points: increment(1) });
    }
    while (list.length > 1) {
      const [p1, p2] = [list.shift(), list.shift()];
      batch.set(doc(collection(db, "matches")), { tournamentId: selectedT.id, p1: p1.name, p2: p2.name, round: nextRound, tableNumber: table++, result: null, status: "pending" });
    }
    await batch.commit();
  };

  // --- GENEL FONKSİYONLAR ---
  const handleLogoutWithLock = async () => {
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { systemActive: false });
      await signOut(auth);
      router.push("/login");
    }
  };

  const handleDeleteTournament = async (tId, tName) => {
    const confirm = await Swal.fire({ title: 'SİLİNSİN Mİ?', text: `"${tName}" kalıcı olarak silinecektir!`, icon: 'warning', showCancelButton: true });
    if (confirm.isConfirmed) {
      const batch = writeBatch(db);
      const pSnap = await getDocs(query(collection(db, "players"), where("tournamentId", "==", tId)));
      pSnap.forEach(d => batch.delete(d.ref));
      const mSnap = await getDocs(query(collection(db, "matches"), where("tournamentId", "==", tId)));
      mSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "tournaments", tId));
      await batch.commit();
    }
  };

  if (licenseStatus === "unverified") return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-10 text-center"><div><Mail size={48} className="mx-auto mb-4 text-indigo-500"/><h1 className="text-2xl font-black">MAIL ONAYI GEREKLİ</h1><p className="opacity-50">Lütfen mailinizi onaylayıp sayfayı yenileyin.</p><button onClick={()=>window.location.reload()} className="mt-6 bg-indigo-600 px-8 py-3 rounded-2xl font-bold">YENİLE</button></div></div>;
  if (licenseStatus === "expired") return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-10 text-center"><div><Clock size={48} className="mx-auto mb-4 text-red-500"/><h1 className="text-2xl font-black">LİSANS SÜRENİZ DOLDU</h1><p className="opacity-50">Ali Yahşi ile iletişime geçin.</p><button onClick={handleLogoutWithLock} className="mt-6 text-indigo-400 underline">ÇIKIŞ YAP</button></div></div>;
  if (licenseStatus === "checking") return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar user={user} activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogoutWithLock} />
      
      <main className="flex-1 ml-64 p-8">
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="max-w-5xl animate-in fade-in">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-black tracking-tighter uppercase">Turnuvalarım</h2>
                {isDemo && <span className="bg-amber-100 text-amber-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-amber-200 flex items-center gap-2"><Lock size={12}/> Deneme Sürümü</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tournaments.map(t => (
                <div key={t.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 group relative">
                  <button onClick={() => handleDeleteTournament(t.id, t.name)} className="absolute top-6 right-6 text-slate-200 hover:text-red-500"><Trash2 size={20}/></button>
                  <h3 className="text-2xl font-black text-slate-800 mb-6">{t.name}</h3>
                  <button onClick={() => { setSelectedT(t); setActiveTab('management'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold group-hover:bg-indigo-600 transition-all uppercase text-xs tracking-widest">Yönetime Git</button>
                </div>
              ))}
              {tournaments.length === 0 && <p className="col-span-2 text-center py-20 text-slate-300 font-bold italic border-2 border-dashed rounded-[3rem]">Bir turnuva oluşturun.</p>}
            </div>
          </div>
        )}

        {/* MANAGEMENT */}
        {activeTab === 'management' && selectedT && (
          <div className="max-w-7xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveTab('dashboard')} className="p-4 bg-white rounded-3xl shadow-sm border border-slate-100"><ChevronLeft/></button>
                <h2 className="text-4xl font-black text-slate-800">{selectedT.name}</h2>
              </div>
              <button onClick={generatePairings} className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-indigo-100 hover:scale-105 transition-all uppercase tracking-tighter">Yeni Tur Eşleştir</button>
            </div>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
                        <h4 className="font-black text-slate-400 text-[10px] uppercase mb-6 tracking-widest text-center">Oyuncu Ekle</h4>
                        <div className="space-y-6">
                            <div className="flex gap-2">
                                <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="İsim Soyisim" className="flex-1 p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none"/>
                                <button onClick={addPlayer} className="bg-slate-900 text-white p-3 rounded-xl"><Plus/></button>
                            </div>

                            {/* 🛑 EXCEL VE PANO KISITLAMASI 🛑 */}
                            <div className="space-y-3 opacity-100">
                                <label onClick={() => isDemo && handleBatchBlock()} className={`flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed rounded-2xl transition ${isDemo ? 'bg-slate-50 border-slate-200 cursor-not-allowed grayscale' : 'cursor-pointer hover:bg-slate-100 border-indigo-200 text-slate-500 font-bold text-xs uppercase'}`}>
                                    <FileSpreadsheet size={16}/> {isDemo ? 'EXCEL (KİLİTLİ)' : 'Excel Seç'}
                                    {!isDemo && <input type="file" className="hidden" onChange={(e) => {/* excel logic */}} />}
                                </label>
                                <button disabled={isDemo} onClick={() => isDemo ? handleBatchBlock() : {/* pano logic */}} className={`w-full py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 uppercase tracking-widest ${isDemo ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                    <Clipboard size={14}/> {isDemo ? 'PANO (KİLİTLİ)' : 'Panodan Ekle'}
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Oyuncu Sıralama Tablosu Buraya... */}
                </div>
                {/* Maç Listesi Buraya... */}
            </div>
          </div>
        )}

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <CreateTournament 
            user={user} 
            isDemo={isDemo} 
            tournamentCount={tournaments.length} 
            onSuccess={() => setActiveTab('dashboard')} 
            onLimitReached={() => Swal.fire("Demo Sınırı", "Sadece 1 turnuva açabilirsiniz.", "warning")}
          />
        )}
        
        {activeTab === 'players' && <RefereeManagement user={user} tournaments={tournaments} isDemo={isDemo} />}
        {activeTab === 'portal' && (/* Portal Ayarları Kodları */)}

      </main>
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { Trophy, ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

export default function CoordinatorPortal() {
  const { code } = useParams();
  const [coordinator, setCoordinator] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) return;

    const loadPortal = async () => {
      try {
        // 1. Önce bu spectatorCode kimin? Onu bulalım.
        const qUser = query(collection(db, "users"), where("spectatorCode", "==", code.toLowerCase()));
        const userSnap = await getDocs(qUser);
        
        if (!userSnap.empty) {
          const userData = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
          setCoordinator(userData);

          // 2. Bu koordinatöre (ownerUid) ait turnuvaları canlı dinle
          const qT = query(collection(db, "tournaments"), where("ownerUid", "==", userData.id));
          const unsubT = onSnapshot(qT, (snap) => {
            setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
          });
          return () => unsubT();
        } else {
          setError(true);
          setLoading(false);
        }
      } catch (e) {
        console.error("Portal hatası:", e);
        setError(true);
        setLoading(false);
      }
    };

    loadPortal();
  }, [code]);

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white gap-4 italic font-bold">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
    YÜKLENİYOR...
  </div>;

  if (error) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black uppercase tracking-widest">Portal Bulunamadı!</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6">
      <div className="max-w-md mx-auto py-10">
        <div className="text-center mb-12 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
            <div className="bg-indigo-600/10 w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto mb-4 border border-indigo-500/20">
                <LayoutGrid size={32} />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">{coordinator?.name}</h1>
            <p className="text-indigo-500 font-black text-[9px] uppercase tracking-[0.4em] mt-2 italic">Resmi İzleyici Portalı</p>
        </div>

        <div className="space-y-4">
          <p className="text-slate-600 font-black text-[10px] uppercase ml-6 tracking-widest mb-4">Aktif Turnuva Listesi</p>
          {tournaments.map(t => (
            <Link href={`/view/${t.id}?back=${code}`} key={t.id} className="block">
              <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 hover:border-indigo-500 transition-all flex justify-between items-center group shadow-xl active:scale-95">
                <div className="overflow-hidden">
                  <h2 className="text-lg font-bold text-white uppercase truncate pr-4">{t.name}</h2>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t.type || 'Branş Belirtilmedi'}</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-2xl text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 shadow-inner">
                  <ChevronRight size={20} />
                </div>
              </div>
            </Link>
          ))}
          {tournaments.length === 0 && (
            <div className="p-16 text-center text-slate-700 bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
               <p className="italic font-bold text-sm uppercase">Henüz yayında maç yok.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
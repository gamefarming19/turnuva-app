"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Trophy, ShieldQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function PublicPortal() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = code.toLowerCase().trim();
    if (!cleanCode) return;
    setLoading(true);

    try {
      // 🔍 users koleksiyonunda bu spectatorCode'a sahip bir koordinatör var mı?
      const q = query(collection(db, "users"), where("spectatorCode", "==", cleanCode));
      const snap = await getDocs(q);

      if (!snap.empty) {
        // Bulundu! Direkt o koordinatörün portalına gönder
        router.push(`/portal/${cleanCode}`);
      } else {
        Swal.fire({
          title: "Kod Geçersiz",
          text: "Girdiğiniz koda ait bir koordinatör portalı bulunamadı.",
          icon: "error",
          background: "#0f172a",
          color: "#fff"
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Hata", "Sorgulama sırasında bir sorun oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full text-center space-y-10">
        <div className="bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl animate-bounce">
            <Trophy size={48} />
        </div>
        <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">TURNUVA<br/>TAKİP MERKEZİ</h1>
            <p className="text-slate-500 font-bold mt-4 uppercase tracking-[0.2em] text-xs">Resmi Canlı Yayın Portalı</p>
        </div>
        <form onSubmit={handleJoin} className="bg-slate-900/50 p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl space-y-4">
            <input 
                value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="ERİŞİM KODUNU YAZIN"
                className="w-full bg-slate-800 p-6 rounded-3xl text-center text-2xl font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all placeholder:text-slate-700"
            />
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-3xl font-black tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50">
                {loading ? "ARANIYOR..." : "PORTALA GİRİŞ YAP"}
            </button>
        </form>
        <button onClick={() => router.push("/login")} className="text-slate-600 font-bold text-xs uppercase tracking-widest underline decoration-slate-800 underline-offset-8">Koordinatör Girişi</button>
       <br/> <button onClick={() => router.push("/referee-login")} className="text-slate-600 font-bold text-xs uppercase tracking-widest underline decoration-slate-800 underline-offset-8">Hakem Girişi</button>

      </div>
    </div>
  );
}
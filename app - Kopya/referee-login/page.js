"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  updatePassword 
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, Key, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import Swal from "sweetalert2";

export default function RefereeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempMode, setTempMode] = useState(false); 
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleRefereeLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();

        // 🛡️ HESAP DURUM KONTROLÜ
        if (userData.status === "suspended") {
          await Swal.fire({
            title: "Erişim Engellendi",
            text: "Hesabınız koordinatör tarafından askıya alınmıştır.",
            icon: "error",
            background: "#0f172a",
            color: "#fff"
          });
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (userData.role !== "referee") {
          await Swal.fire("Yetkisiz Giriş", "Bu kapı sadece Hakemler içindir.", "error");
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (userData.isTemporaryPassword === true) {
          setTempMode(true);
          setLoading(false);
          return;
        }

        router.push("/referee");
      }
    } catch (err) {
      Swal.fire("Hata", "E-posta veya şifre yanlış.", "error");
    } finally {
      if (!tempMode) setLoading(false);
    }
  };

  const handleUpdateTempPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return Swal.fire("Hata", "Min. 6 karakter yazın.", "error");

    setLoading(true);
    try {
      const user = auth.currentUser;
      await updatePassword(user, newPassword); 
      await updateDoc(doc(db, "users", user.uid), { 
        isTemporaryPassword: false,
        status: "active"
      });

      await Swal.fire("Başarılı", "Şifreniz güncellendi. Giriş yapılıyor...", "success");
      router.push("/referee");
    } catch (error) {
      await signOut(auth);
      setTempMode(false);
      Swal.fire("Hata", "Güvenlik süresi doldu. Tekrar giriş yapın.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white gap-4 italic font-bold">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <p className="tracking-widest uppercase text-xs">Sistem Doğrulanıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans text-left">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 w-20 h-20 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-4 shadow-2xl shadow-indigo-500/20">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">HAKEM GİRİŞİ</h1>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[3.5rem] border border-slate-800 shadow-2xl">
          {tempMode ? (
            <form onSubmit={handleUpdateTempPassword} className="space-y-5 animate-in slide-in-from-bottom-4">
              <div className="text-center mb-6">
                <Key className="mx-auto text-amber-500 mb-2" size={24} />
                <h2 className="text-white font-black uppercase text-sm italic">Yeni Şifreniz</h2>
                <p className="text-slate-500 text-[10px] font-bold">Lütfen kalıcı şifrenizi oluşturun.</p>
              </div>
              <input 
                type="password" placeholder="Yeni Şifreniz" 
                className="w-full p-4 bg-slate-800 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center"
                onChange={(e) => setNewPassword(e.target.value)} required
              />
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black transition-all shadow-lg uppercase tracking-widest text-[10px]">ŞİFREYİ KAYDET VE GİR</button>
            </form>
          ) : (
            <form onSubmit={handleRefereeLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-600" size={18}/>
                <input 
                  type="email" placeholder="E-posta" 
                  className="w-full p-4 pl-12 bg-slate-800 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner"
                  onChange={(e) => setEmail(e.target.value)} required 
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-600" size={18}/>
                <input 
                  type={showPass ? "text" : "password"} placeholder="Şifre" 
                  className="w-full p-4 pl-12 bg-slate-800 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner"
                  onChange={(e) => setPassword(e.target.value)} required 
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 text-slate-600">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-[2rem] font-black transition-all active:scale-95 shadow-xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 mt-4">
                SİSTEME BAĞLAN <ArrowRight size={16}/>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
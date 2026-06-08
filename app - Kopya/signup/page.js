"use client";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, UserPlus, ArrowLeft } from "lucide-react";
import Swal from "sweetalert2";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      return Swal.fire("Hata", "Şifre en az 6 karakter olmalıdır.", "error");
    }

    setLoading(true);
    try {
      // 1. Firebase Auth ile kullanıcıyı oluştur
      const res = await createUserWithEmailAndPassword(auth, form.email, form.password);
      
      // 2. Kullanıcının görünen ismini güncelle
      await updateProfile(res.user, { displayName: form.name });

      // 3. E-posta doğrulama linki gönder
      await sendEmailVerification(res.user);

      // 4. Firestore veritabanına "Lisanssız Koordinatör" olarak kaydet
      await setDoc(doc(db, "users", res.user.uid), {
        name: form.name,
        email: form.email,
        role: "admin",
        isLicensed: false, // 🛡️ İlk kayıt lisanssızdır
        createdAt: serverTimestamp()
      });

      await Swal.fire({
        title: "Kayıt Başarılı!",
        text: "E-posta adresinize bir doğrulama linki gönderildi. Lütfen onayladıktan sonra giriş yapın.",
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#4f46e5"
      });
      
      router.push("/login");
    } catch (err) {
      let message = "Bir hata oluştu.";
      if (err.code === "auth/email-already-in-use") message = "Bu e-posta adresi zaten kullanımda.";
      if (err.code === "auth/invalid-email") message = "Geçersiz e-posta adresi.";
      
      Swal.fire({
        title: "Hata",
        text: message,
        icon: "error",
        background: "#1e293b",
        color: "#fff"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-10 rounded-[3.5rem] shadow-2xl w-full max-w-md border border-slate-700 animate-in fade-in zoom-in duration-300">
        
        {/* ÜST BAŞLIK */}
        <div className="text-center mb-8">
            <div className="bg-indigo-600/20 w-16 h-16 rounded-3xl flex items-center justify-center text-indigo-500 mx-auto mb-4">
                <UserPlus size={32} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Yeni Koordinatör</h1>
            <p className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-widest">Turnuva Yönetim Sistemi</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* İSİM SOYİSİM */}
          <div className="relative">
            <User className="absolute left-4 top-4 text-slate-500" size={20}/>
            <input 
              type="text" 
              placeholder="Ad Soyad" 
              className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              required 
            />
          </div>

          {/* E-POSTA */}
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-500" size={20}/>
            <input 
              type="email" 
              placeholder="E-posta Adresi" 
              className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              required 
            />
          </div>

          {/* ŞİFRE */}
          <div className="relative">
            <Lock className="absolute left-4 top-4 text-slate-500" size={20}/>
            <input 
              type="password" 
              placeholder="Şifre (Min. 6 karakter)" 
              className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
            />
          </div>

          {/* KAYIT BUTONU */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-5 rounded-[2rem] font-black transition-all active:scale-95 shadow-xl shadow-indigo-500/10 uppercase tracking-widest mt-4"
          >
            {loading ? "İŞLENİYOR..." : "KAYIT OL VE BAŞLAT"}
          </button>
        </form>

        {/* ALT LİNKLER */}
        <div className="mt-8 flex flex-col items-center gap-4">
            <Link href="/login" className="flex items-center gap-2 text-slate-400 text-xs font-bold hover:text-white transition-all uppercase tracking-tighter">
               <ArrowLeft size={14}/> Zaten hesabım var
            </Link>
        </div>

      </div>
    </div>
  );
}
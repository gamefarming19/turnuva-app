"use client";
import { useState, useEffect, Suspense } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendPasswordResetEmail,
  signOut,
  applyActionCode // 👈 Onay işlemi için eklendi
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, LogIn, Chrome, CheckCircle2, Loader2 } from "lucide-react";
import Swal from "sweetalert2";

// useSearchParams kullandığımız için Suspense içine almalıyız
export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // 📧 OTOMATİK MAİL ONAYLAMA MANTIĞI
  useEffect(() => {
    const mode = searchParams.get("mode");
    const oobCode = searchParams.get("oobCode");

    if (mode === "verifyEmail" && oobCode) {
      handleVerifyEmail(oobCode);
    }
  }, [searchParams]);

  const handleVerifyEmail = async (oobCode) => {
    try {
      await applyActionCode(auth, oobCode);
      Swal.fire({
        title: "Mail Onaylandı!",
        text: "Artık giriş yapabilirsiniz.",
        icon: "success",
        background: "#1e293b",
        color: "#fff"
      });
    } catch (error) {
      console.error("Onay hatası:", error);
      Swal.fire("Hata", "Onay kodu geçersiz veya süresi dolmuş.", "error");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // Giriş anında tekrar kontrol et
      if (!user.emailVerified) {
        Swal.fire({
          title: "Mail Onaylanmamış",
          text: "Lütfen e-postanıza gelen linke tıklayın.",
          icon: "warning"
        });
        await signOut(auth);
        return;
      }
      checkUserRole(user.uid);
    } catch (err) {
      Swal.fire("Hata", "Bilgilerinizi kontrol edin.", "error");
    }
  };

  // ... (handleGoogleLogin, handleForgot ve checkUserRole fonksiyonları aynı kalacak) ...
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const { user } = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          role: "admin",
          isLicensed: false,
          status: "pending",
          createdAt: serverTimestamp()
        });
      }
      checkUserRole(user.uid);
    } catch (err) { Swal.fire("Hata", "Google girişi yapılamadı.", "error"); }
  };

  const handleForgot = async () => {
    const { value: emailInput } = await Swal.fire({ title: 'Şifre Sıfırlama', input: 'email', inputPlaceholder: 'E-posta adresinizi girin', showCancelButton: true });
    if (emailInput) {
      await sendPasswordResetEmail(auth, emailInput);
      Swal.fire("Başarılı", "Sıfırlama linki gönderildi.", "success");
    }
  };

  const checkUserRole = async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const role = snap.data().role;
      if (role === "superadmin") router.push("/superadmin");
      else if (role === "referee") router.push("/referee");
      else router.push("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-10 rounded-[3.5rem] shadow-2xl w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-black text-white text-center mb-8 uppercase tracking-tighter italic">Giriş Yap</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-500" size={20}/>
            <input type="email" placeholder="E-posta" className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-4 text-slate-500" size={20}/>
            <input type="password" placeholder="Şifre" className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl">OTURUM AÇ</button>
        </form>

        <div className="relative my-8 text-center">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-700"></div>
            <span className="bg-slate-800 px-4 text-slate-500 text-xs font-bold uppercase relative z-10">VEYA</span>
        </div>

        <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all mb-6">
          <Chrome size={20}/> Google ile Devam Et
        </button>

        <div className="text-center space-y-4 font-sans">
          <button onClick={handleForgot} className="text-slate-400 text-xs font-bold hover:text-white underline uppercase tracking-widest">Şifremi Unuttum</button>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Hesabınız yok mu? <a href="/signup" className="text-indigo-400 underline">Kayıt Ol</a></p>
        </div>
      </div>
    </div>
  );
}
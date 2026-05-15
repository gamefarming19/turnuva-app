"use client";
import { useState, useEffect, Suspense } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendPasswordResetEmail,
  signOut,
  applyActionCode,
  confirmPasswordReset // 👈 Yeni şifreyi onaylamak için eklendi
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, LogIn, CheckCircle2, Loader2, ArrowLeft } from "lucide-react"; // 👈 ArrowLeft eklendi
import Swal from "sweetalert2";

// useSearchParams kullandığımız için Suspense içine almalıyız
export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Yükleniyor...</div>}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState(""); // 👈 Yeni şifre için state
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false); // 👈 Şifre sıfırlama ekranı kontrolü
  const [oobCode, setOobCode] = useState(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // 📧 MOD KONTROLÜ (Mail Onayı veya Şifre Sıfırlama)
  useEffect(() => {
    const mode = searchParams.get("mode");
    const code = searchParams.get("oobCode");

    if (code) {
      setOobCode(code);
      if (mode === "verifyEmail") {
        handleVerifyEmail(code);
      } else if (mode === "resetPassword") {
        setResetMode(true); // 👈 Şifre sıfırlama modunu aktif et
      }
    }
  }, [searchParams]);

  // 1. Mail Doğrulama Fonksiyonu
  const handleVerifyEmail = async (oobCode) => {
    setLoading(true);
    try {
      await applyActionCode(auth, oobCode);
      await Swal.fire({
        title: "Mail Onaylandı!",
        text: "E-posta adresiniz başarıyla doğrulandı. Artık giriş yapabilirsiniz.",
        icon: "success",
        background: "#1e293b",
        color: "#fff",
        confirmButtonColor: "#4f46e5"
      });
      router.replace("/login");
    } catch (error) {
      Swal.fire({
        title: "Hata",
        text: "Onay kodu geçersiz veya süresi dolmuş.",
        icon: "error",
        background: "#1e293b",
        color: "#fff"
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Yeni Şifreyi Kaydetme Fonksiyonu
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return Swal.fire("Hata", "Şifre en az 6 karakter olmalıdır.", "error");

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      await Swal.fire({
        title: "Şifre Güncellendi!",
        text: "Yeni şifrenizle giriş yapabilirsiniz.",
        icon: "success",
        background: "#1e293b",
        color: "#fff"
      });
      setResetMode(false);
      router.replace("/login");
    } catch (error) {
      Swal.fire("Hata", "İşlem başarısız. Linkin süresi dolmuş olabilir.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Giriş Yapma Fonksiyonu
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        Swal.fire({
          title: "Mail Onaylanmamış",
          text: "Lütfen e-postanıza gelen linke tıklayın. Eğer tıkladıysanız sayfayı yenileyip tekrar deneyin.",
          icon: "warning",
          background: "#1e293b",
          color: "#fff"
        });
        await signOut(auth);
        return;
      }
      checkUserRole(user.uid);
    } catch (err) {
      Swal.fire({
        title: "Giriş Hatası",
        text: "E-posta veya şifre hatalı.",
        icon: "error",
        background: "#1e293b",
        color: "#fff"
      });
    }
  };

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
    } catch (err) {
      Swal.fire("Hata", "Google girişi başarısız.", "error");
    }
  };

  const handleForgot = async () => {
    const { value: emailInput } = await Swal.fire({
      title: 'Şifre Sıfırlama',
      input: 'email',
      inputPlaceholder: 'E-posta adresinizi girin',
      showCancelButton: true,
      confirmButtonText: 'Link Gönder',
      background: '#1e293b',
      color: '#fff'
    });
    if (emailInput) {
      await sendPasswordResetEmail(auth, emailInput);
      Swal.fire("Başarılı", "Sıfırlama linki e-postanıza gönderildi.", "success");
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

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <p className="font-bold tracking-widest uppercase text-xs">İşlem Yapılıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-10 rounded-[3.5rem] shadow-2xl w-full max-w-md border border-slate-700">
        
        {/* 🔐 ŞİFRE SIFIRLAMA EKRANI */}
        {resetMode ? (
          <div className="animate-in zoom-in duration-300">
            <h1 className="text-2xl font-black text-white text-center mb-2 uppercase italic tracking-tighter">Yeni Şifre</h1>
            <p className="text-slate-500 text-xs text-center mb-8 font-bold italic">Lütfen yeni parolanızı belirleyin.</p>
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-500" size={20}/>
                <input 
                  type="password" 
                  placeholder="Yeni Şifre" 
                  className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl uppercase">Şifreyi Güncelle</button>
              <button type="button" onClick={() => setResetMode(false)} className="w-full text-slate-500 text-[10px] font-black uppercase mt-4 flex items-center justify-center gap-2 hover:text-white transition-colors">
                <ArrowLeft size={12}/> Giriş Ekranına Dön
              </button>
            </form>
          </div>
        ) : (
          /* 🔑 NORMAL GİRİŞ EKRANI */
          <div className="animate-in fade-in duration-500">
            <h1 className="text-3xl font-black text-white text-center mb-8 uppercase tracking-tighter italic">Turnuva Giriş</h1>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-500" size={20}/>
                <input 
                  type="email" 
                  placeholder="E-posta" 
                  className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-500" size={20}/>
                <input 
                  type="password" 
                  placeholder="Şifre" 
                  className="w-full p-4 pl-12 bg-slate-900 border-none rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl">GİRİŞ YAP</button>
            </form>

            <div className="relative my-8 text-center">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-700"></div>
                <span className="bg-slate-800 px-4 text-slate-500 text-xs font-bold uppercase relative z-10">VEYA</span>
            </div>

            <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all mb-6 shadow-lg">
              <LogIn size={20}/> Google ile Devam Et
            </button>

            <div className="text-center space-y-4 font-sans">
              <button onClick={handleForgot} className="text-slate-400 text-xs font-bold hover:text-white underline uppercase tracking-widest">Şifremi Unuttum</button>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Hesabınız yok mu? <a href="/signup" className="text-indigo-400 underline">Kayıt Ol</a></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
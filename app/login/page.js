"use client";

import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 1. Firebase Auth ile giriş yap
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore'dan kullanıcının rolünü kontrol et
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        if (role === "admin") router.push("/admin");
        else if (role === "referee") router.push("/referee");
      } else {
        // Eğer veritabanında rolü yoksa varsayılan olarak admin paneline gönderelim (ilk kurulum için)
        router.push("/admin");
      }
    } catch (err) {
      setError("Giriş başarısız: " + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white shadow-lg rounded-lg w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">npm Turnuva Giriş</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="E-posta"
            className="w-full p-2 border rounded"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Şifre"
            className="w-full p-2 border rounded"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Giriş Yap
          </button>
        </form>
        {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}

        {/*
        <p className="text-center mt-6 text-sm text-slate-500">
  Hesabınız yok mu?{" "}
  <a href="/signup" className="text-indigo-600 font-bold hover:underline">
    Hemen Kayıt Olun
  </a>
</p>
*/}
      </div>
    </div>
  );
}
"use client";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function SignupPage() {
   redirect("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(res.user, { displayName: name });
      // Kullanıcıyı veritabanına "koordinatör" olarak kaydet
      await setDoc(doc(db, "users", res.user.uid), {
        name, email, role: "admin", createdAt: new Date()
      });
      router.push("/admin");
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleSignup} className="bg-white p-8 rounded-[2rem] shadow-xl w-96 space-y-4">
        <h1 className="text-2xl font-black text-center">YENİ HESAP AÇ</h1>
        <input type="text" placeholder="Adınız Soyadınız" className="w-full p-3 border rounded-xl" onChange={e => setName(e.target.value)} required />
        <input type="email" placeholder="E-posta" className="w-full p-3 border rounded-xl" onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Şifre" className="w-full p-3 border rounded-xl" onChange={e => setPassword(e.target.value)} required />
        <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Kayıt Ol ve Başla</button>
      </form>
    </div>
  );
}
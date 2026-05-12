"use client";
import { LayoutDashboard, PlusCircle, Users, LogOut, Settings, Trophy, ShieldCheck } from "lucide-react";

export default function Sidebar({ user, activeTab, setActiveTab, handleLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Turnuvalarım', icon: LayoutDashboard },
    { id: 'create', label: 'Turnuva Oluştur', icon: PlusCircle },
    { id: 'players', label: 'Hakem Listesi', icon: ShieldCheck }, 
  ];

  return (
    <div className="w-64 bg-white h-screen border-r flex flex-col p-6 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-2 mb-10 px-2">
        <div className="bg-indigo-600 p-2 rounded-xl text-white"><Trophy size={20}/></div>
        <h1 className="text-xl font-black tracking-tighter text-slate-800">TURNUVA.PRO</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
              activeTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <item.icon size={20} /> {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t pt-6">
        <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold uppercase">
            {user?.displayName?.[0] || user?.email?.[0] || 'A'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-black text-slate-800 truncate">{user?.displayName || 'Koordinatör'}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Çevrimiçi</p>
          </div>
        </div>
        
        {/* BURASI DEĞİŞTİ: handleLogout fonksiyonunu çağırıyoruz */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition"
        >
          <LogOut size={20} /> Çıkış Yap
        </button>
      </div>
    </div>
  );
}
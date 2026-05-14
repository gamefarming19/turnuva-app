"use client";
import { LayoutDashboard, PlusCircle, Users, LogOut, Settings, Trophy, ShieldCheck, Globe } from "lucide-react";

export default function Sidebar({ user, activeTab, setActiveTab, handleLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Turnuvalarım', icon: LayoutDashboard },
    { id: 'create', label: 'Turnuva Oluştur', icon: PlusCircle },
    { id: 'players', label: 'Hakem Listesi', icon: Users }, 
    { id: 'portal', label: 'Portal Ayarları', icon: Globe },
  ];

  return (
    <div className="w-64 bg-white h-screen border-r flex flex-col p-6 fixed left-0 top-0 z-50">
      {/* LOGO */}
      <div className="flex items-center gap-2 mb-10 px-2">
        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
          <Trophy size={20}/>
        </div>
        <h1 className="text-xl font-black tracking-tighter text-slate-800">TURNUVA.PRO</h1>
      </div>

      {/* MENÜ LİSTESİ */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${
              activeTab === item.id ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <item.icon size={20} /> {item.label}
          </button>
        ))}
      </nav>

      {/* ALT KULLANICI KARTI */}
      <div className="border-t pt-6 mt-auto">
        <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3 mb-4 border border-slate-100">
          {/* Avatar / Baş Harf */}
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black uppercase shadow-lg shadow-indigo-100 shrink-0">
            {user?.name?.[0] || user?.displayName?.[0] || 'A'}
          </div>
          
          <div className="overflow-hidden text-left">
            {/* Koordinatör Adı */}
            <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tighter">
              {user?.name || user?.displayName || 'Yükleniyor...'}
            </p>
            {/* Ünvan */}
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
              Koordinatör
            </p>
          </div>
        </div>
        
        {/* Çıkış Butonu */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-6 py-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all group"
        >
          <LogOut size={18} className="group-hover:translate-x-1 transition-transform" /> 
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
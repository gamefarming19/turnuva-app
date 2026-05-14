"use client";
import { LayoutDashboard, PlusCircle, Users, LogOut, Trophy, Globe, Clock, ShieldCheck } from "lucide-react";

export default function Sidebar({ user, activeTab, setActiveTab, handleLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Turnuvalarım', icon: LayoutDashboard },
    { id: 'create', label: 'Turnuva Oluştur', icon: PlusCircle },
    { id: 'players', label: 'Hakem Listesi', icon: Users }, 
    { id: 'portal', label: 'Portal Ayarları', icon: Globe },
  ];

  // 🗓️ Kalan Gün Hesaplama
  const getRemainingDays = () => {
    if (!user?.licenseExpires) return 0;
    const now = new Date();
    const expiry = user.licenseExpires.toDate();
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysLeft = getRemainingDays();

  return (
    <div className="w-64 bg-white h-screen border-r flex flex-col p-6 fixed left-0 top-0 z-50">
      {/* LOGO */}
      <div className="flex items-center gap-2 mb-10 px-2">
        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
          <Trophy size={20}/>
        </div>
        <h1 className="text-xl font-black tracking-tighter text-slate-800">TURNUVA.PRO</h1>
      </div>

      {/* MENÜ */}
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

      {/* 🛡️ LİSANS DURUM KARTI (YENİ) */}
      {!user?.isLicensed && (
  <div className="mb-4 p-4 rounded-3xl bg-amber-50 border border-amber-100">
    <div className="flex items-center gap-2 mb-1">
      <AlertCircle size={14} className="text-amber-600" />
      <span className="text-[10px] font-black uppercase text-amber-600">Deneme Sürümü</span>
    </div>
    <p className="text-[9px] text-amber-500 font-bold leading-tight">
      Bazı özellikler kısıtlanmıştır. Tam sürüm için iletişime geçin.
    </p>
  </div>
)}
      {user?.isLicensed && (
        <div className={`mb-4 p-4 rounded-3xl border ${daysLeft <= 3 ? 'bg-amber-50 border-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className={daysLeft <= 3 ? 'text-amber-600' : 'text-indigo-600'} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${daysLeft <= 3 ? 'text-amber-600' : 'text-indigo-600'}`}>
                    {user.licenseType} Lisans
                </span>
            </div>
            <div className="flex justify-between items-end">
                <div>
                    <p className="text-xl font-black text-slate-800 leading-none">{daysLeft}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Gün Kaldı</p>
                </div>
                <p className="text-[9px] font-bold text-slate-400 italic">Bitiş: {user.licenseExpires.toDate().toLocaleDateString('tr-TR')}</p>
            </div>
            {/* İlerleme Çubuğu */}
            <div className="w-full h-1 bg-white/50 rounded-full mt-3 overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ${daysLeft <= 3 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${Math.min((daysLeft / 30) * 100, 100)}%` }}
                ></div>
            </div>
        </div>
      )}

      {/* KULLANICI KARTI */}
      <div className="border-t pt-6 mt-auto">
        <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3 mb-4 border border-slate-100">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black uppercase shadow-lg shrink-0">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="overflow-hidden text-left">
            <p className="text-sm font-black text-slate-800 truncate uppercase tracking-tighter">
              {user?.name || 'Koordinatör'}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {user?.role === 'superadmin' ? 'Süper Admin' : 'Koordinatör'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all group">
          <LogOut size={18} className="group-hover:translate-x-1 transition-transform" /> 
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
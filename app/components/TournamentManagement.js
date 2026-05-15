"use client";
import { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, where, doc, 
  writeBatch, deleteDoc, updateDoc, increment, getDocs 
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { 
  Plus, X, ChevronLeft, Info, Trash2, Check, ListOrdered, 
  Swords, UserPlus, Edit2, RotateCcw, RefreshCw, Trophy, Eye, MapPin, School, Lock 
} from "lucide-react";
import PlayerRegistration from "./PlayerRegistration";
import TournamentPairings from "./TournamentPairings";
import SpectatorSettings from "./SpectatorSettings";
import { runSwissPairing } from "../lib/pairingLogic";
import Swal from "sweetalert2";

export default function TournamentManagement({ selectedT, setSelectedT, isDemo, onBack, user }) {
  const [activeSubTab, setActiveSubTab] = useState('standings'); 
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editNewField, setEditNewField] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);

  // 1. VERİLERİ DİNLE
  useEffect(() => {
    if (!selectedT) return;
    const unsubP = onSnapshot(query(collection(db, "players"), where("tournamentId", "==", selectedT.id)), (snap) => setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubM = onSnapshot(query(collection(db, "matches"), where("tournamentId", "==", selectedT.id)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(data.sort((a, b) => b.round - a.round || a.tableNumber - b.tableNumber));
    });
    return () => { unsubP(); unsubM(); };
  }, [selectedT]);

  // 2. SIRALAMA VE AVERAJ MOTORU
  const calculatedPlayers = useMemo(() => {
    const avgPoints = players.length > 0 ? players.reduce((sum, p) => sum + (p.points || 0), 0) / players.length : 0;
    const baseStats = players.map(player => {
        const myMatches = matches.filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed');
        const oppPoints = myMatches.map(m => {
            if (m.p2_id === "BYE") return avgPoints;
            const oppId = m.p1_id === player.id ? m.p2_id : m.p1_id;
            return players.find(p => p.id === oppId)?.points || 0;
        });
        const bh = oppPoints.reduce((a, b) => a + b, 0);
        const bh_c1 = oppPoints.length > 1 ? bh - Math.min(...oppPoints) : bh;
        let sb = 0;
        myMatches.forEach(m => {
            if (m.p2_id === "BYE") { sb += avgPoints; return; }
            const oppP = players.find(p => p.id === (m.p1_id === player.id ? m.p2_id : m.p1_id))?.points || 0;
            if ((m.p1_id === player.id && m.result === "1-0") || (m.p2_id === player.id && m.result === "0-1")) sb += oppP;
            else if (m.result === "0.5-0.5") sb += (oppP * 0.5);
        });
        return { ...player, bh, bh_c1, sb, winCount: player.win_count || 0 };
    });

    return baseStats.map(player => {
        const myMatches = matches.filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed');
        const bh_sum = myMatches.reduce((acc, m) => {
            if (m.p2_id === "BYE") return acc + avgPoints;
            const oppId = m.p1_id === player.id ? m.p2_id : m.p1_id;
            return acc + (baseStats.find(p => p.id === oppId)?.bh || 0);
        }, 0);
        return { ...player, bh_sum };
    }).sort((a, b) => b.points - a.points || b.bh_c1 - a.bh_c1 || b.sb - a.sb || b.bh_sum - a.bh_sum || b.winCount - a.winCount || a.bNo - b.bNo);
  }, [players, matches]);

  // AVERAJLARI VERİTABANINA YAZ (İzleyici tarafı sadece çeksin diye)
  useEffect(() => {
    if(activeSubTab === 'standings' && calculatedPlayers.length > 0) {
        const batch = writeBatch(db);
        calculatedPlayers.forEach(p => {
            batch.update(doc(db, "players", p.id), { bh_c1: p.bh_c1, sb: p.sb, bh_sum: p.bh_sum });
        });
        batch.commit();
    }
  }, [activeSubTab, matches]);

  // --- 🛠️ FONKSİYONLAR ---
    const handlePairingRequest = () => {
    const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;
    
    // 🛑 DEMO KISITLAMASI: Maksimum 2 Tur
    if (isDemo && currentRound >= 2) {
      return Swal.fire({
        title: "Tur Sınırı",
        text: "Deneme sürümünde sadece 2 tur eşleştirebilirsiniz. Devam etmek için PRO lisans almalısınız.",
        icon: "warning",
        confirmButtonText: "Tamam",
        confirmButtonColor: "#4f46e5"
      });
    }

    runSwissPairing(selectedT, players, calculatedPlayers, matches);
  };
  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "players", editingPlayer.id), {
        ...editingPlayer,
        name: editingPlayer.name.toUpperCase().trim()
    });
    matches.filter(m => m.p1_id === editingPlayer.id || m.p2_id === editingPlayer.id).forEach(m => {
        if(m.p1_id === editingPlayer.id) batch.update(doc(db, "matches", m.id), { p1: editingPlayer.name.toUpperCase() });
        if(m.p2_id === editingPlayer.id) batch.update(doc(db, "matches", m.id), { p2: editingPlayer.name.toUpperCase() });
    });
    await batch.commit();
    setEditingPlayer(null);
    Swal.fire({ title: "Güncellendi", icon: "success", timer: 1000, showConfirmButton: false });
  };

  const handleUpdateTournament = async () => {
    await updateDoc(doc(db,"tournaments",selectedT.id), { name: selectedT.name, customFields: selectedT.customFields });
    setIsEditing(false);
  };

  return (
    <div className="max-w-7xl animate-in slide-in-from-right duration-300">
      
      {/* 📝 OYUNCU DÜZENLEME MODAL (TAM LİSTE) 📝 */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[4rem] p-12 shadow-2xl animate-in zoom-in duration-200">
                <h3 className="text-xl font-black mb-8 border-l-4 border-indigo-600 pl-4 uppercase">Oyuncu Verilerini Güncelle</h3>
                <div className="space-y-4 text-left">
                    <input value={editingPlayer.name} onChange={e=>setEditingPlayer({...editingPlayer, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="İsim Soyisim" />
                    <div className="grid grid-cols-2 gap-4">
                        <input value={editingPlayer.tc || ""} onChange={e=>setEditingPlayer({...editingPlayer, tc: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="TC NO" />
                        <input value={editingPlayer.category || ""} onChange={e=>setEditingPlayer({...editingPlayer, category: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="KATEGORİ" />
                    </div>
                    <input value={editingPlayer.school || ""} onChange={e=>setEditingPlayer({...editingPlayer, school: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="OKUL" />
                    <div className="grid grid-cols-2 gap-4">
                        <input value={editingPlayer.city || ""} onChange={e=>setEditingPlayer({...editingPlayer, city: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="İL" />
                        <input value={editingPlayer.district || ""} onChange={e=>setEditingPlayer({...editingPlayer, district: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="İLÇE" />
                    </div>
                </div>
                <div className="flex gap-4 mt-10">
                    <button onClick={handleUpdatePlayer} className="flex-1 bg-indigo-600 text-white py-5 rounded-[2rem] font-black">KAYDET</button>
                    <button onClick={()=>setEditingPlayer(null)} className="px-8 bg-slate-100 text-slate-400 py-5 rounded-[2rem] font-bold">İPTAL</button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER VE DİNAMİK ALAN AYARLARI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-white p-8 rounded-[3rem] shadow-sm border text-left">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-4 bg-slate-50 rounded-3xl hover:bg-slate-100 transition"><ChevronLeft/></button>
          {isEditing ? (
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-3xl border border-indigo-200">
                <input className="text-xl font-black outline-none px-2 block border-b" value={selectedT.name} onChange={e => setSelectedT({...selectedT, name: e.target.value})} />
                <div className="flex items-center gap-2 border-l pl-4">
                    {selectedT.customFields?.map((f, i) => ( 
                        <span key={i} className="bg-slate-100 p-2 rounded-lg text-xs font-bold flex items-center gap-2">
                            {f.label} <X size={12} className="text-red-400 cursor-pointer" onClick={() => setSelectedT({...selectedT, customFields: selectedT.customFields.filter((_,idx)=>idx!==i)})}/>
                        </span> 
                    ))}
                    <div className="flex gap-1 items-center">
                        <input value={editNewField} onChange={e=>setEditNewField(e.target.value)} placeholder="Yeni..." className="w-20 bg-slate-50 p-2 rounded-lg text-xs outline-none"/>
                        <button onClick={()=>{if(editNewField){setSelectedT({...selectedT, customFields: [...(selectedT.customFields||[]), {label: editNewField}]}); setEditNewField("");}}} className="bg-indigo-600 text-white p-2 rounded-lg hover:scale-110 transition-transform"><Plus size={14}/></button>
                    </div>
                </div>
                <button onClick={handleUpdateTournament} className="bg-indigo-600 text-white px-6 rounded-2xl font-black text-xs">Kaydet</button>
            </div>
          ) : ( <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter cursor-pointer flex items-center gap-3" onClick={()=>setIsEditing(true)}>{selectedT.name} <Edit2 size={16} className="text-slate-300"/></h2> )}
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-[2rem] shadow-inner">
            {[ {id:'standings',label:'SIRALAMA',icon:ListOrdered}, {id:'pairings',label:'EŞLEŞTİRMELER',icon:Swords}, {id:'registration',label:'OYUNCU KAYDI',icon:UserPlus}, {id:'spectator',label:'İZLEYİCİ AYARI',icon:Eye} ].map(tab => (
                <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[11px] font-black transition-all ${activeSubTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}><tab.icon size={16}/> {tab.label}</button>
            ))}
        </div>
<button onClick={handlePairingRequest} className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black shadow-xl uppercase tracking-widest text-xs flex items-center gap-2">
    {isDemo && <Lock size={14}/>} Yeni Tur Eşleştir
</button>      </div>

      <div className="min-h-[600px]">
        {activeSubTab === 'standings' && (
            <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 animate-in fade-in">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-100 text-slate-500 uppercase font-black tracking-widest text-center border">
                            <th className="p-4 border">SIRA</th><th className="p-4 border">B.NO</th><th className="p-4 border text-left">AD SOYAD</th><th className="p-4 border text-left">KURUM</th><th className="p-4 border bg-indigo-50 text-indigo-600 text-lg">PUAN</th><th className="p-4 border text-blue-500 italic">BH:GP/C1</th><th className="p-4 border text-slate-400 font-medium">SB</th><th className="p-4 border text-slate-400 font-medium">BHs</th><th className="p-4 border">WIN/P</th><th className="p-4 border text-red-400">SİL</th>
                        </tr>
                    </thead>
                    <tbody className="font-bold text-slate-700 text-center uppercase">
                        {calculatedPlayers.map((p, i) => (
                            <tr key={p.id} className="hover:bg-slate-50 border-b last:border-0 transition-colors">
                                <td className="p-4 font-black text-lg">{i + 1}</td><td className="p-4 opacity-40">{p.bNo}</td><td className="p-4 text-left font-black text-sm truncate max-w-[200px]">{p.name}</td><td className="p-4 text-left text-[9px] text-slate-400">{p.school || '-'}</td><td className="p-4 text-indigo-600 bg-indigo-50/20 text-lg font-black">{p.points}</td><td className="p-4 text-blue-500">{p.bh_c1.toFixed(1)}</td><td className="p-4 opacity-60 font-medium">{p.sb.toFixed(1)}</td><td className="p-4 opacity-60 font-medium">{p.bh_sum.toFixed(1)}</td><td className="p-4 font-medium">{p.winCount}</td><td className="p-4 text-center"><button onClick={async()=> {if(confirm('Sil?')) await deleteDoc(doc(db,"players",p.id))}}><Trash2 size={18} className="text-red-200 hover:text-red-500 mx-auto"/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeSubTab === 'pairings' && (
            <TournamentPairings selectedT={selectedT} players={players} calculatedPlayers={calculatedPlayers} matches={matches} user={user} />
        )}

{activeSubTab === 'registration' && (
    <PlayerRegistration 
        selectedT={selectedT} 
        players={players} 
        setEditingPlayer={setEditingPlayer} 
        isDemo={isDemo} // 👈 Bunu ekle
        playersCount={players.length} // 👈 12 sınırını kontrol etmesi için bunu ekle
    />
)}

        {activeSubTab === 'spectator' && (
            <SpectatorSettings selectedT={selectedT} matches={matches} />
        )}
      </div>
    </div>
  );
}
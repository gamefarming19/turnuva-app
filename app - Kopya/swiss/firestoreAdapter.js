// firestoreAdapter.js
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Tüm verileri TEK seferde çek (performans için kritik!)
export const loadAllTournamentData = async (tournamentId) => {
  console.log("🚀 Tournament verileri yükleniyor...");
  
  // Paralel sorgular
  const [playersSnap, matchesSnap] = await Promise.all([
    getDocs(query(collection(db, "players"), where("tournamentId", "==", tournamentId))),
    getDocs(query(collection(db, "matches"), where("tournamentId", "==", tournamentId)))
  ]);
  
  const players = playersSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    colorHistory: doc.data().colorHistory || [],
    opponents: doc.data().opponents || [],
    whiteCount: doc.data().whiteCount || 0,
    blackCount: doc.data().blackCount || 0,
    points: doc.data().points || 0,
    win_count: doc.data().win_count || 0
  }));
  
  const matches = matchesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`✅ ${players.length} oyuncu, ${matches.length} maç yüklendi`);
  
  return { players, matches };
};

// Oyuncu modellerini RAM'de oluştur (Firestore sorgusu yok!)
// app/lib/firestoreAdapter.js

export const buildPlayerModels = (players, matches) => {
  const playerMap = new Map();
  
  players.forEach(player => {
    // 1. Oyuncunun geçmiş maçlarını bul (Görseldeki p1_id ve p2_id'ye göre)
    const playerMatches = matches
      .filter(m => (m.p1_id === player.id || m.p2_id === player.id) && m.status === 'completed')
      .sort((a, b) => a.round - b.round);
    
    let whiteCount = 0;
    let blackCount = 0;
    let opponents = [];

    const roundColorHistory = [];

    playerMatches.forEach(m => {
      if (m.p1_id === player.id) {
        roundColorHistory.push('W');
        whiteCount++;
        if (m.p2_id && m.p2_id !== "BYE") opponents.push(m.p2_id);
      } else {
        roundColorHistory.push('B');
        blackCount++;
        if (m.p1_id && m.p1_id !== "BYE") opponents.push(m.p1_id);
      }
    });

    const colorHistory = roundColorHistory.join("");
    const last2Colors = colorHistory.slice(-2).split("");

    playerMap.set(player.id, {
      ...player,
      points: Number(player.points || 0),
      bNo: Number(player.bNo || 999),
      colorHistory,
      last2Colors,
      whiteCount,
      blackCount,
      opponents
    });
  });
  
  return playerMap;
};
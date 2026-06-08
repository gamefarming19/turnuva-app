// pairingEngine.js - ANA PROFESYONEL MOTOR
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, increment,  serverTimestamp } from "firebase/firestore";
import Swal from "sweetalert2";

import { loadAllTournamentData, buildPlayerModels } from './firestoreAdapter.js';
import { PairingBacktracking } from './backtracking.js';
import { assignColor } from './colorRules.js';
import { createPointGroups } from './bracketSystem.js';
import { ByeManager } from './byeManager.js';
import { updateAllTiebreaks } from './tiebreaks.js';

export const runSwissPairing = async (selectedT, players, calculatedPlayers, matches) => {
  try {
    console.log("🎯 PROFESYONEL SWISS MOTOR BAŞLATILIYOR...");
    
    // 1. Validasyonlar
    if (players.length === 0) {
      return Swal.fire("Hata", "Turnuvada oyuncu bulunmuyor!", "error");
    }
    
    const pendingMatches = matches.filter(m => m.status === 'pending');
    if (pendingMatches.length > 0) {
      return Swal.fire("Hata", `Önce ${pendingMatches.length} bekleyen maçı tamamlayın!`, "error");
    }
    
    // 2. Tur hesaplama
    const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) + 1 : 1;
    const maxRounds = selectedT.maxRounds || 7;
    
    if (currentRound > maxRounds) {
      return Swal.fire("Turnuva Tamamlandı", `${maxRounds} tur tamamlandı!`, "info");
    }
    
    // 3. PERFORMANS OPTİMİZASYONU: Tüm verileri TEK seferde çek
    const { players: allPlayers, matches: allMatches } = await loadAllTournamentData(selectedT.id);
    
    // 4. Tiebreak hesaplamaları (RAM'de)
    await updateAllTiebreaks(allPlayers, allMatches);
    
    // 5. Oyuncu modellerini oluştur
    const playerModels = buildPlayerModels(allPlayers, allMatches);
    let playerList = calculatedPlayers.map(p => playerModels.get(p.id) || p);
    
    // 6. 1. Tur özel kurası (Dutch System)
    if (currentRound === 1) {
      const { value: method } = await Swal.fire({
        title: '1. Tur Kura Yöntemi',
        text: 'Dutch System - Üst yarı vs Alt yarı',
        input: 'select',
        inputOptions: {
          'dutch': '🇳🇱 Dutch System (Rating/ELO)',
          'bNo': '📊 B.NO Sıralı',
          'alpha': '🔤 Alfabetik (A-Z)',
          'random': '🎲 Random Kura'
        },
        showCancelButton: true
      });
      
      if (!method) return false;
      
      // Rating'e göre sırala (ELO veya başlangıç sırası)
      if (method === 'dutch') {
        playerList.sort((a, b) => (b.rating || b.elo || 0) - (a.rating || a.elo || 0));
        const half = Math.ceil(playerList.length / 2);
        const topHalf = playerList.slice(0, half);
        const bottomHalf = playerList.slice(half);
        
        // Dutch: 1 vs 9, 2 vs 10, 3 vs 11...
        playerList = [];
        for (let i = 0; i < topHalf.length; i++) {
          playerList.push(topHalf[i]);
          if (bottomHalf[i]) playerList.push(bottomHalf[i]);
        }
      } else if (method === 'alpha') {
        playerList.sort((a, b) => a.name.localeCompare(b.name));
      } else if (method === 'bNo') {
        playerList.sort((a, b) => (a.bNo || 999) - (b.bNo || 999));
      } else if (method === 'random') {
        playerList.sort(() => Math.random() - 0.5);
      }
    } else {
      // Sonraki turlar: puana göre sırala ve tiebreak'e göre sabitle
      playerList.sort((a, b) => {
        const pointDiff = (b.points || 0) - (a.points || 0);
        if (pointDiff !== 0) return pointDiff;

        const buchDiff = (b.buchholz || 0) - (a.buchholz || 0);
        if (buchDiff !== 0) return buchDiff;

        const ratingDiff = (b.rating || b.elo || 0) - (a.rating || a.elo || 0);
        if (ratingDiff !== 0) return ratingDiff;

        return (a.bNo || 999) - (b.bNo || 999);
      });
    }
    
    // 7. Match history oluştur
    const matchHistory = new Set();
    allMatches.forEach(m => {
      if (m.p1_id && m.p2_id && m.p2_id !== "BYE") {
        matchHistory.add([m.p1_id, m.p2_id].sort().join("-"));
      }
    });
    
    const batch = writeBatch(db);
    
    // 8. BYE Yönetimi
    const byeManager = new ByeManager(playerList, allMatches, currentRound, maxRounds);
    const byePlayer = byeManager.selectByePlayer();
    
    if (byePlayer && playerList.length % 2 !== 0) {
      const index = playerList.findIndex(p => p.id === byePlayer.id);
      if (index !== -1) {
        playerList.splice(index, 1);
        byeManager.createByeMatch(byePlayer, batch, selectedT.id, currentRound);
      }
    }
    
    // 9. Puan gruplarına ayır ve eşleştir
    const { groups, sortedGroups } = createPointGroups(playerList);
    let allPairings = [];
    let remainingPlayers = [];
    
    for (const points of sortedGroups) {
      let groupPlayers = [...groups[points]];
      
      // Önceki turdan kalanları ekle
      groupPlayers = [...remainingPlayers, ...groupPlayers];
      remainingPlayers = [];
      
      // Backtracking ile eşleştir
      const backtracking = new PairingBacktracking(
        groupPlayers,
        matchHistory,
        currentRound,
        maxRounds,
        5000,
        100000
      );
      
      const pairings = backtracking.generatePairings();
      
      // Eşleşmeyenleri bir sonraki gruba aktar
      const pairedIds = new Set();
      pairings.forEach(p => {
        pairedIds.add(p.p1.id);
        pairedIds.add(p.p2.id);
      });
      
      const unpaired = groupPlayers.filter(p => !pairedIds.has(p.id));
      remainingPlayers.push(...unpaired);
      
      allPairings.push(...pairings);
    }
    
    // 10. Renk ataması yap
  
let tableNumber = 1;
  for (const pair of allPairings) {
      // 1. Turda masaları çaprazla, diğer turlarda kurala bak
      let colorAssignment;
      if (currentRound === 1) {
        colorAssignment = (tableNumber % 2 !== 0) ? 'WB' : 'BW';
      } else {
        // colorRules.js içindeki o gelişmiş mantığı kullan
        colorAssignment = assignColor(pair.p1, pair.p2);
      }
      
      const whiteSide = colorAssignment === 'WB' ? pair.p1 : pair.p2;
      const blackSide = colorAssignment === 'WB' ? pair.p2 : pair.p1;

      const matchRef = doc(collection(db, "matches"));
      batch.set(matchRef, {
        tournamentId: selectedT.id,
        round: currentRound,
        tableNumber: tableNumber++,
        status: "pending",
        result: null,
        p1: whiteSide.name,
        p1_id: whiteSide.id,
        p1_bNo: Number(whiteSide.bNo || 0),
        p1_colorHistory: String(whiteSide.colorHistory || ""), // matchActions için sakla
        p2: blackSide.name,
        p2_id: blackSide.id,
        p2_bNo: Number(blackSide.bNo || 0),
        p2_colorHistory: String(blackSide.colorHistory || ""), // matchActions için sakla
        createdAt: serverTimestamp()
      });
    }
    
    await batch.commit();
    
    await Swal.fire({
      title: "✅ Başarılı!",
      html: `${allPairings.length} maç oluşturuldu.<br>${currentRound}. Tur hazır!<br><small>Profesyonel Swiss Motor Aktif</small>`,
      icon: "success",
      timer: 2000
    });
    
    return true;
    
  } catch (error) {
    console.error("❌ Eşleştirme hatası:", error);
    await Swal.fire("Hata", `Eşleştirme başarısız: ${error.message}`, "error");
    return false;
  }
};
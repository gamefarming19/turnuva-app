// app/lib/swiss/pairingEngine.js
import { loadFideData } from './firestoreAdapter.js';
import { FideDutchEngine } from './backtracking.js';
import { FideByeManager } from './byeManager.js';
import { assignColor } from './colorRules.js';
import { generateRoundOne } from './roundOnePairing.js';
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import Swal from "sweetalert2";

export const runProfessionalSwiss = async (selectedT) => {
  try {
    const { players, matches } = await loadFideData(selectedT.id);
    const round = matches.length > 0 ? Math.max(...matches.map(m => m.round)) + 1 : 1;
    const maxRounds = Number(selectedT.maxRounds || 7);
    const matchHistory = new Set(matches.map(m => [m.p1_id, m.p2_id].sort().join("-")));
    const batch = writeBatch(db);

    if (round === 1) {
      const { value: method } = await Swal.fire({
        title: '1. Tur Kura Yöntemi',
        input: 'select',
        inputOptions: { 'dutch': 'Dutch', 'alpha': 'Alfabetik', 'random': 'Random' },
        showCancelButton: true
      });
      if (!method) return;
      const r1 = generateRoundOne(players, method, selectedT.id);
      if (r1.bye) FideByeManager.createByeMatch(batch, selectedT.id, 1, r1.bye);
      r1.matches.forEach(m => batch.set(doc(collection(db, "matches")), { ...m, createdAt: serverTimestamp() }));
      await batch.commit();
      return Swal.fire("Başarılı", "1. Tur Hazır", "success");
    }

    // --- GENEL EŞLEŞTİRME VE TAM KONTROL DÖNGÜSÜ ---
    let pool = [...players].sort((a, b) => b.points - a.points || b.rating - a.rating || a.bNo - b.bNo);
    const totalRequiredMatches = Math.floor(players.length / 2);
    
    let byeP = null;
    if (pool.length % 2 !== 0) {
      byeP = FideByeManager.selectByePlayer(pool);
      pool = pool.filter(p => p.id !== byeP?.id);
    }

    const engine = new FideDutchEngine(matchHistory, round, maxRounds);
    const pointGroups = [...new Set(pool.map(p => p.points))].sort((a, b) => b - a);
    
    let finalPairings = [];
    let floaterDown = [];

    // PDF C.13/C.14 Uyumlu Döngü
    for (let i = 0; i < pointGroups.length; i++) {
      const groupPlayers = [...floaterDown, ...pool.filter(p => p.points === pointGroups[i])];
      const { pairings, unpaired } = engine.generateGroupPairings(groupPlayers, floaterDown.length);
      finalPairings.push(...pairings);
      floaterDown = unpaired;

      // EĞER SON GRUPTA KİLİTLENME VARSA (PDF C.13)
      if (i === pointGroups.length - 1 && floaterDown.length >= 2) {
        // En son kalanları ne olursa olsun eşleştir (xLimit zorlaması backtracking.js'de var)
        const residual = engine.generateGroupPairings(floaterDown, 0);
        finalPairings.push(...residual.pairings);
      }
    }

    // --- TAM EŞLEŞME KONTROLÜ (KRİTİK BÖLÜM) ---
    if (finalPairings.length < totalRequiredMatches) {
        console.error("Eşleşme Tamamlanamadı! Kilitlenme Çözülüyor...");
        // Burada basitçe kalanları en yakın ratinge göre bağlayan acil durum eşleştirmesi
        const pairedIds = new Set([...finalPairings.flatMap(p => [p.p1.id, p.p2.id])]);
        const leftovers = pool.filter(p => !pairedIds.has(p.id));
        
        while (leftovers.length >= 2) {
            const p1 = leftovers.shift();
            const p2 = leftovers.shift();
            finalPairings.push({ p1, p2 });
        }
    }

    // Kayıt işlemleri
    if (byeP) FideByeManager.createByeMatch(batch, selectedT.id, round, byeP);
    let table = 1;
    for (const pair of finalPairings) {
      const colors = assignColor(pair.p1, pair.p2, round);
      const white = colors === "WB" ? pair.p1 : pair.p2;
      const black = colors === "WB" ? pair.p2 : pair.p1;
      batch.set(doc(collection(db, "matches")), {
        tournamentId: selectedT.id, round, tableNumber: table++, status: "pending",
        p1: white.name, p1_id: white.id, p1_bNo: white.bNo, p1_colorHistory: white.colorHistory,
        p2: black.name, p2_id: black.id, p2_bNo: black.bNo, p2_colorHistory: black.colorHistory,
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
    Swal.fire("Başarılı", `${round}. Tur Eşleştirildi`, "success");
  } catch (e) {
    Swal.fire("Hata", e.message, "error");
  }
};
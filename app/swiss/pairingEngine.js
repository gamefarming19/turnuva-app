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
  let report = [];
  const log = (msg) => report.push(msg);

  try {
    const { players, matches } = await loadFideData(selectedT.id);
    // 🛑 KRİTİK ENGEL: SONUÇLANMAMIŞ MAÇ VAR MI KONTROLÜ (Geri Geldi ✅)
    const pendingMatches = matches.filter(m => m.status === 'pending');
    if (pendingMatches.length > 0) {
      return Swal.fire({
        title: "Eşleştirme Yapılamaz!",
        text: `Henüz sonuç girişi yapılmamış ${pendingMatches.length} maç var. Lütfen tüm maçları tamamlayın.`,
        icon: "warning",
        confirmButtonColor: "#4f46e5"
      });
    }
    const round = matches.length > 0 ? Math.max(...matches.map(m => m.round)) + 1 : 1;
    const maxRounds = Number(selectedT.maxRounds || 7);
    const matchHistory = new Set(matches.map(m => [m.p1_id, m.p2_id].sort().join("-")));
    const batch = writeBatch(db);

    log(`🚀 <b>${round}. TUR EŞLEŞTİRME PROTOKOLÜ</b>`);

    if (round === 1) {
      const { value: method } = await Swal.fire({
        title: '1. Tur Kura Yöntemi',
        input: 'select',
        inputOptions: { 'dutch': 'Dutch', 'alpha': 'Alfabetik', 'random': 'Random' },
        showCancelButton: true
      });
      if (!method) return;
      const r1 = generateRoundOne(players, method, selectedT.id);
      if (r1.bye) {
          log(`💤 BYE: ${r1.bye.name} (B.No: ${r1.bye.bNo})`);
          FideByeManager.createByeMatch(batch, selectedT.id, 1, r1.bye);
      }
      r1.matches.forEach(m => batch.set(doc(collection(db, "matches")), { ...m, createdAt: serverTimestamp() }));
      await batch.commit();
      return Swal.fire("Başarılı", "1. Tur Hazır", "success");
    }

    let pool = [...players].sort((a, b) => b.points - a.points || b.rating - a.rating || a.bNo - b.bNo);
    const totalRequiredMatches = Math.floor(players.length / 2);
    
    let byeP = null;
    if (pool.length % 2 !== 0) {
      byeP = FideByeManager.selectByePlayer(pool);
      log(`💤 <b>BYE (Tur Atlatma):</b> ${byeP.name} (B.No: ${byeP.bNo}) - [Alt gruptan, BYE almamış aday]`);
      pool = pool.filter(p => p.id !== byeP?.id);
    }

    const engine = new FideDutchEngine(matchHistory, round, maxRounds);
    const pointGroups = [...new Set(pool.map(p => p.points))].sort((a, b) => b - a);
    
    let finalPairings = [];
    let floaterDown = [];

    for (const pts of pointGroups) {
      log(`-------------------------------------------`);
      log(`📂 <b>PUAN GRUBU: ${pts}</b>`);

      const members = pool.filter(p => p.points === pts);
      const groupPlayers = [...floaterDown, ...members];
      
      const { pairings, unpaired } = engine.generateGroupPairings(groupPlayers, floaterDown);
      
      engine.logs.forEach(l => log(l));
      engine.logs = []; 

      finalPairings.push(...pairings);
      floaterDown = unpaired;

      if (floaterDown.length > 0) {
          log(`   📤 <b>Aşağı Kaydırılanlar:</b> [${floaterDown.map(f => f.name).join(', ')}]`);
      }
    }

    if (floaterDown.length >= 2) {
        log(`-------------------------------------------`);
        log(`🛠️ <b>KALINTI KONTROLÜ (C.13):</b> Eşleşmeyen oyuncular bağlanıyor.`);
        const residual = engine.generateGroupPairings(floaterDown, []);
        finalPairings.push(...residual.pairings);
        floaterDown = residual.unpaired;
    }

    if (finalPairings.length < totalRequiredMatches) {
        log(`🆘 <b>KRİTİK:</b> PDF kuralları kilitlendi! Kalan ${floaterDown.length} kişi rating sırasına göre eşleşti.`);
        const pairedIds = new Set([...finalPairings.flatMap(p => [p.p1.id, p.p2.id])]);
        const leftovers = pool.filter(p => !pairedIds.has(p.id));
        while (leftovers.length >= 2) {
            const p1 = leftovers.shift(); const p2 = leftovers.shift();
            finalPairings.push({ p1, p2 });
            log(`   🔗 <b>Zorunlu Bağlantı:</b> ${p1.name} ⚡ ${p2.name}`);
        }
    }

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

    await Swal.fire({
      title: 'Eşleştirme Analiz Raporu',
      html: `<div style="text-align:left; font-family: 'Segoe UI', sans-serif; font-size:10px; background:#111827; color:#f3f4f6; padding:20px; border-radius:15px; max-height:400px; overflow-y:auto; line-height:1.6; border: 1px solid #374151;">
              ${report.join('<br>')}
             </div>`,
      confirmButtonText: 'Protokolü Onayla',
      confirmButtonColor: '#4f46e5',
      width: '600px'
    });

  } catch (e) {
    Swal.fire("Hata", e.message, "error");
  }
};
// app/swiss/matchActions.js
import { db } from "@/lib/firebase";
import { doc, writeBatch, increment } from "firebase/firestore";

export const submitMatchResult = async ({ match, score, refereeName, refereeId, details = {} }) => {
  const batch = writeBatch(db);
  const matchRef = doc(db, "matches", match.id);
  const p1Ref = doc(db, "players", match.p1_id);
  
  const isByeMatch = match.isBye || match.p2_id === "BYE";
  const p2Ref = !isByeMatch ? doc(db, "players", match.p2_id) : null;

  // 🛑 KRİTİK: Bu bir düzeltme mi yoksa ilk giriş mi?
  const isUpdating = match.status === 'completed';

  // 1. Maç Belgesini Güncelle
  batch.update(matchRef, {
    result: score,
    status: "completed",
    refereeId: refereeId,
    details: {
      ...details,
      refereeName: refereeName,
      finishTime: new Date().toLocaleTimeString('tr-TR')
    }
  });

  // 2. RENK VE BYE KORUMASI: Sadece İLK GİRİŞTE (isUpdating false ise) saydır! ✅
  if (!isUpdating) {
    if (isByeMatch) {
      batch.update(p1Ref, { 
        receivedBye: true,
        colorHistory: ("N" + (match.p1_colorHistory || "")).substring(0, 10)
      });
    } else {
      batch.update(p1Ref, { 
        whiteCount: increment(1), 
        colorHistory: ("W" + (match.p1_colorHistory || "")).substring(0, 10) 
      });
      if (p2Ref) {
        batch.update(p2Ref, { 
          blackCount: increment(1), 
          colorHistory: ("B" + (match.p2_colorHistory || "")).substring(0, 10) 
        });
      }
    }
  }

  // 3. PUAN GÜNCELLEME: Eğer düzeltme yapılıyorsa eski puanları geri al
  if (isUpdating) {
    // Eski sonucu geri çek (Eski sonuç 1-0 ise P1'den 1 puan düş gibi)
    if (match.result === "1-0") {
      batch.update(p1Ref, { points: increment(-1), win_count: increment(-1) });
    } else if (match.result === "0-1" && p2Ref) {
      batch.update(p2Ref, { points: increment(-1), win_count: increment(-1) });
    } else if (match.result === "0.5-0.5") {
      batch.update(p1Ref, { points: increment(-0.5) });
      if (p2Ref) batch.update(p2Ref, { points: increment(-0.5) });
    }
  }

  // Yeni sonucu ekle
  if (score === "1-0") {
    batch.update(p1Ref, { points: increment(1), win_count: increment(1) });
  } else if (score === "0-1" && p2Ref) {
    batch.update(p2Ref, { points: increment(1), win_count: increment(1) });
  } else if (score === "0.5-0.5") {
    batch.update(p1Ref, { points: increment(0.5) }); 
    if (p2Ref) batch.update(p2Ref, { points: increment(0.5) });
  }

  await batch.commit();
  return true;
};
// app/lib/matchActions.js
import { db } from "@/lib/firebase";
import { doc, writeBatch, increment } from "firebase/firestore";

export const submitMatchResult = async ({ match, score, refereeName, refereeId, details = {} }) => {
  const batch = writeBatch(db);
  const matchRef = doc(db, "matches", match.id);
  const p1Ref = doc(db, "players", match.p1_id);
  const p2Ref = doc(db, "players", match.p2_id);

  // 1. Önceki turlardan gelen renk geçmişini al (pairingEngine'den gelen veri)
  const p1OldHistory = match.p1_colorHistory || "";
  const p2OldHistory = match.p2_colorHistory || "";

  // 2. Maç Sonucunu Kaydet
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

  // 3. Renk Dengesi ve Geçmişini Güncelle
  // P1 her zaman BEYAZ (W), P2 her zaman SİYAH (B) koltuğundadır
  batch.update(p1Ref, {
    whiteCount: increment(1),
    colorHistory: ("W" + p1OldHistory).slice(0, 10), // Yeni 'W' harfini başa koy
    lastColor: "W"
  });

  batch.update(p2Ref, {
    blackCount: increment(1),
    colorHistory: ("B" + p2OldHistory).slice(0, 10), // Yeni 'B' harfini başa koy
    lastColor: "B"
  });

  // 4. Puanları ve Galibiyet Sayılarını Güncelle
  if (score === "1-0") {
    batch.update(p1Ref, { points: increment(1), win_count: increment(1) });
  } else if (score === "0-1") {
    batch.update(p2Ref, { points: increment(1), win_count: increment(1) });
  } else if (score === "0.5-0.5") {
    batch.update(p1Ref, { points: increment(0.5) });
    batch.update(p2Ref, { points: increment(0.5) });
  }

  // 5. İşlemleri Toplu Gönder
  await batch.commit();
  return true;
};
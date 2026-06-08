// app/lib/swiss/byeManager.js
import { doc, collection } from "firebase/firestore"; 
import { db } from "@/lib/firebase";

export class FideByeManager {
  static selectByePlayer(playerPool) {
    // PDF Kuralı: En alt puan grubu -> En alt rating -> BYE almamış olan
    const candidates = [...playerPool].reverse();
    return candidates.find(p => !p.receivedBye) || null;
  }

  static createByeMatch(batch, tournamentId, round, byePlayer) {
    const matchRef = doc(collection(db, "matches"));
    
    // ARTIK PENDING (BEKLEMEDE) OLARAK OLUŞTURUYORUZ
    batch.set(matchRef, {
      tournamentId,
      round,
      tableNumber: 999,
      p1: byePlayer.name,
      p1_id: byePlayer.id,
      p1_bNo: byePlayer.bNo,
      p1_colorHistory: byePlayer.colorHistory || "",
      p2: "BYE",
      p2_id: "BYE",
      result: null,        // Otomatik 1-0 değil
      status: "pending",   // Otomatik completed değil
      isBye: true          // matchActions'ın tanıması için bu flag önemli
    });

    // Puan artırma işlemini buradan sildik. Hakem girince artacak.
  }
}
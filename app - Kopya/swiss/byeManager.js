// byeManager.js
import { doc, collection, increment } from "firebase/firestore"; 
import { db } from "@/lib/firebase";
export class ByeManager {
  constructor(players, matches, round, totalRounds) {
    this.players = [...players];
    this.matches = matches;
    this.round = round;
    this.totalRounds = totalRounds;
  }
  
selectByePlayer() {
  if (this.round === this.totalRounds) {
    return null;
  }

  let candidates = [...this.players].filter(player => this.canGiveBye(player));
  if (candidates.length === 0) {
    return null;
  }

  const byeHistory = new Map();
  this.matches.forEach(m => {
    if (m.p2_id === "BYE") {
      byeHistory.set(m.p1_id, (byeHistory.get(m.p1_id) || 0) + 1);
    }
  });

  const noByePlayers = candidates.filter(p => !byeHistory.has(p.id));
  candidates = noByePlayers.length > 0 ? noByePlayers : candidates;

  candidates.sort((a, b) => {
    const pointsA = a.points || 0;
    const pointsB = b.points || 0;
    const buchA = a.buchholz || 0;
    const buchB = b.buchholz || 0;
    const byeA = byeHistory.get(a.id) || 0;
    const byeB = byeHistory.get(b.id) || 0;

    if (pointsA !== pointsB) return pointsA - pointsB;
    if (buchA !== buchB) return buchA - buchB;
    if (byeA !== byeB) return byeA - byeB;

    const ratingA = a.rating || a.elo || 0;
    const ratingB = b.rating || b.elo || 0;
    if (ratingA !== ratingB) return ratingA - ratingB;

    return (b.bNo || 999) - (a.bNo || 999);
  });

  return candidates[0];
}
  
  canGiveBye(player) {
    // Son turda BYE yasak
    if (this.round === this.totalRounds) return false;
    
    // Aynı oyuncuya 2 kez BYE verilemez
    const byeCount = this.matches.filter(m => 
      m.p2_id === "BYE" && m.p1_id === player.id
    ).length;
    
    if (byeCount >= 1) return false;
    
    return true;
  }
  
  createByeMatch(byePlayer, batch, tournamentId, currentRound) {
    const matchRef = doc(collection(db, "matches"));
    batch.set(matchRef, {
      tournamentId: tournamentId,
      p1: byePlayer.name,
      p1_id: byePlayer.id,
      p1_bNo: byePlayer.bNo || "-",
      p2: "BYE",
      p2_id: "BYE",
      p2_bNo: "-",
      round: currentRound,
      tableNumber: 999,
      result: "1-0",
      status: "completed",
      details: { 
        refereeName: "System", 
        finishTime: new Date().toLocaleTimeString('tr-TR'),
        isBye: true
      }
    });
    
    batch.update(doc(db, "players", byePlayer.id), {
      points: increment(1),
      win_count: increment(1)
    });
    
    return matchRef;
  }
}
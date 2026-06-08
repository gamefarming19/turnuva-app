// backtracking.js
import { isValidPairing } from './validators.js';
import { calculatePairingScore } from './scoring.js';

export class PairingBacktracking {
  constructor(players, matchHistory, round, totalRounds, maxRetry = 5000, maxBacktrack = 100000) {
    this.players = [...players];
    this.matchHistory = matchHistory;
    this.round = round;
    this.totalRounds = totalRounds;
    this.pairings = [];
    this.used = new Set();
    this.maxRetry = maxRetry;
    this.maxBacktrack = maxBacktrack;
    this.backtrackCount = 0;
  }
  
  // Ana eşleştirme fonksiyonu
  generatePairings() {
    this.backtrackCount = 0;
    const success = this.tryPair(0);
    
    if (!success) {
      console.error("Backtracking başarısız, fallback mode");
      return this.fallbackPairing();
    }
    
    return this.pairings;
  }
  
  tryPair(index) {
    this.backtrackCount++;
    
    // Max backtrack limit kontrolü
    if (this.backtrackCount > this.maxBacktrack) {
      console.warn("Max backtrack limit aşıldı");
      return false;
    }
    
    // Tüm oyuncular eşleşti mi?
    if (this.used.size === this.players.length) {
      return true;
    }
    
    // Sıradaki eşleşmemiş oyuncuyu bul
    const p1 = this.players.find(p => !this.used.has(p.id));
    if (!p1) return true;
    
    // Kalan oyuncuları bul
    const remaining = this.players.filter(p => !this.used.has(p.id) && p.id !== p1.id);
    
    // Kalan oyuncu yoksa BYE kontrolü
    if (remaining.length === 0) {
      // BYE verilebilir mi?
      return true;
    }
    
    // En iyi adayları bul (skor tabanlı sıralama)
    const candidates = this.buildCandidates(p1, remaining);
    
    // Her adayı dene (backtracking)
    for (const candidate of candidates) {
      const isValid = isValidPairing(p1, candidate, this.matchHistory, this.round, this.pairings, this.totalRounds);
      
      if (isValid) {
        // Eşleşmeyi yap
        this.makePair(p1, candidate);
        
        // Recursive olarak devam et
        if (this.tryPair(index + 1)) {
          return true;
        }
        
        // Backtrack: eşleşmeyi geri al
        this.undoPair(p1, candidate);
      }
    }
    
    return false;
  }
  
  buildCandidates(p1, remaining) {
    const scored = remaining.map(p2 => ({
      player: p2,
      score: calculatePairingScore(p1, p2, this.round, this.matchHistory, this.pairings)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.player);
  }
  
  makePair(p1, p2) {
    this.pairings.push({ p1, p2 });
    this.used.add(p1.id);
    this.used.add(p2.id);
  }
  
  undoPair(p1, p2) {
    const index = this.pairings.findIndex(p => 
      (p.p1.id === p1.id && p.p2.id === p2.id) ||
      (p.p1.id === p2.id && p.p2.id === p1.id)
    );
    if (index !== -1) {
      this.pairings.splice(index, 1);
    }
    this.used.delete(p1.id);
    this.used.delete(p2.id);
  }
  
  fallbackPairing() {
    // Basit greedy algoritma ile eşleştir
    const simplePairings = [];
    const used = new Set();
    const players = [...this.players];
    
    for (let i = 0; i < players.length; i++) {
      if (used.has(players[i].id)) continue;
      
      for (let j = i + 1; j < players.length; j++) {
        if (used.has(players[j].id)) continue;
        
        if (isValidPairing(players[i], players[j], this.matchHistory, this.round, simplePairings)) {
          simplePairings.push({ p1: players[i], p2: players[j] });
          used.add(players[i].id);
          used.add(players[j].id);
          break;
        }
      }
    }
    
    return simplePairings;
  }
}
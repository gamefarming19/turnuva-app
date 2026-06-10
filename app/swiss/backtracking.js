// app/lib/swiss/backtracking.js
import { isValidPairing } from './validators.js';
import { calculateColorPreference } from './colorRules.js';

export class FideDutchEngine {
  constructor(matchHistory, round, maxRounds) {
    this.matchHistory = matchHistory;
    this.round = round;
    this.maxRounds = maxRounds;
    this.logs = [];
  }

  addLog(msg) { this.logs.push(msg); }

  calculateX(players) {
    const w = players.filter(p => calculateColorPreference(p, this.round).pref === "W").length;
    const b = players.filter(p => calculateColorPreference(p, this.round).pref === "B").length;
    const q = Math.ceil(players.length / 2);
    return Math.max(w - q, b - q, 0);
  }

  generateGroupPairings(players, floaters = []) {
    if (players.length < 2) {
      const names = players.map(p => `${p.name} (${p.points}P)`).join(', ');
      this.addLog(`⚠️ <b>Grup Yetersiz:</b> [${names}] bir alt gruba kaydırıldı.`);
      return { pairings: [], unpaired: players };
    }

    const xLimit = this.calculateX(players);
    const pGoal = Math.floor(players.length / 2);
    
    if (floaters.length > 0) {
      this.addLog(`   📥 <b>Gelen Floaters (S1):</b> [${floaters.map(f => f.name).join(', ')}]`);
    }
    this.addLog(`   📊 <b>Analiz:</b> ${players.length} oyuncu, ${pGoal} maç hedefi, ideal x: ${xLimit}`);

    for (let currentX = xLimit; currentX <= pGoal; currentX++) {
      if (currentX > xLimit) this.addLog(`   🔄 <b>Limit Esnetiliyor:</b> x=${currentX} (Renk alternasyonu ihlaline izin verildi)`);
      
      const s1 = players.slice(0, floaters.length > 0 ? floaters.length : pGoal);
      const s2 = players.slice(floaters.length > 0 ? floaters.length : pGoal);

      let result = this.transposition(s1, s2, [], 0, currentX);
      if (!result) result = this.exchange(s1, s2, players, currentX);

      if (result) {
        const pairedIds = new Set(result.flatMap(pr => [pr.p1.id, pr.p2.id]));
        const unpaired = players.filter(pl => !pairedIds.has(pl.id));
        this.addLog(`   ✅ <b>Eşleşme Tamam:</b> ${result.length} masa kuruldu.`);
        return { pairings: result, unpaired };
      }
      this.addLog(`   ❌ <b>Başarısız:</b> x=${currentX} limitinde kurala uygun kombinasyon bulunamadı.`);
    }
    return { pairings: [], unpaired: players };
  }

  transposition(s1, s2, pairings, s1Idx, xLimit) {
    if (s1Idx === s1.length) {
      const violations = pairings.filter(p => 
        calculateColorPreference(p.p1, this.round).pref === calculateColorPreference(p.p2, this.round).pref
      ).length;
      return violations <= xLimit ? pairings : null;
    }

    const p1 = s1[s1Idx];
    for (let i = 0; i < s2.length; i++) {
      const p2 = s2[i];
      if (pairings.some(p => p.p2.id === p2.id)) continue;

      const matchKey = [p1.id, p2.id].sort().join("-");
      if (this.matchHistory.has(matchKey)) {
          if (xLimit === 0) this.addLog(`      🚫 <i>Engel:</i> ${p1.bNo}-${p2.bNo} daha önce oynamış.`);
          continue;
      }

      const pref1 = calculateColorPreference(p1, this.round);
      const pref2 = calculateColorPreference(p2, this.round);
      if (this.round < this.maxRounds && pref1.isAbsolute && pref2.isAbsolute && pref1.pref === pref2.pref) {
          if (xLimit === 0) this.addLog(`      🚫 <i>Engel:</i> ${p1.bNo}-${p2.bNo} her ikisi de mutlak ${pref1.pref === 'W' ? 'Beyaz' : 'Siyah'} istiyor.`);
          continue;
      }

      pairings.push({ p1, p2 });
      const res = this.transposition(s1, s2, pairings, s1Idx + 1, xLimit);
      if (res) return res;
      pairings.pop();
    }
    return null;
  }

  exchange(s1, s2, originalPlayers, xLimit) {
    const s1Len = s1.length;
    const patterns = [
      { sIdx1: [s1Len-1], sIdx2: [0] }, { sIdx1: [s1Len-1], sIdx2: [1] },
      { sIdx1: [s1Len-2], sIdx2: [0] }, { sIdx1: [s1Len-1, s1Len-2], sIdx2: [0, 1] }
    ];

    for (const p of patterns) {
      let nS1 = [...s1], nS2 = [...s2];
      p.sIdx1.forEach((idx, i) => {
        if(nS1[idx] && nS2[p.sIdx2[i]]) [nS1[idx], nS2[p.sIdx2[i]]] = [nS2[p.sIdx2[i]], nS1[idx]];
      });
      const sortFn = (a, b) => (b.points - a.points) || (b.rating - a.rating) || (a.bNo - b.bNo);
      nS1.sort(sortFn); nS2.sort(sortFn);
      const res = this.transposition(nS1, nS2, [], 0, xLimit);
      if (res) {
          this.addLog(`   🔃 <b>D.2 Takası:</b> S1/S2 arası oyuncu değişimi ile kilit açıldı.`);
          return res;
      }
    }
    return null;
  }
}
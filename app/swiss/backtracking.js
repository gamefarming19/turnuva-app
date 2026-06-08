// app/lib/swiss/backtracking.js
import { isValidPairing } from './validators.js';
import { calculateColorPreference } from './colorRules.js';

export class FideDutchEngine {
  constructor(matchHistory, round, maxRounds) {
    this.matchHistory = matchHistory;
    this.round = round;
    this.maxRounds = maxRounds;
  }

  calculateX(players) {
    const w = players.filter(p => calculateColorPreference(p, this.round).pref === "W").length;
    const b = players.filter(p => calculateColorPreference(p, this.round).pref === "B").length;
    return Math.max(w - Math.ceil(players.length / 2), b - Math.ceil(players.length / 2), 0);
  }

  generateGroupPairings(players, floaterCount = 0) {
    if (players.length < 2) return { pairings: [], unpaired: players };

    const initialX = this.calculateX(players);
    const pGoal = Math.floor(players.length / 2);
    
    // PDF C.11: x limitini artırarak dene
    for (let xLimit = initialX; xLimit <= pGoal; xLimit++) {
      const p = floaterCount > 0 ? floaterCount : pGoal;
      const s1 = players.slice(0, p);
      const s2 = players.slice(p);

      let result = this.transposition(s1, s2, [], 0, xLimit);
      if (!result) result = this.exchange(s1, s2, players, xLimit);

      if (result) {
        const pairedIds = new Set();
        result.forEach(pr => { pairedIds.add(pr.p1.id); pairedIds.add(pr.p2.id); });
        return { pairings: result, unpaired: players.filter(pl => !pairedIds.has(pl.id)) };
      }
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

      if (isValidPairing(p1, p2, this.matchHistory, this.round, this.maxRounds)) {
        pairings.push({ p1, p2 });
        const res = this.transposition(s1, s2, pairings, s1Idx + 1, xLimit);
        if (res) return res;
        pairings.pop();
      }
    }
    return null;
  }

  exchange(s1, s2, originalPlayers, xLimit) {
    const s1Len = s1.length;
    // PDF Sayfa 10 Matrisi genişletilmiş hali
    const patterns = [
      { s1: [s1Len-1], s2: [0] }, { s1: [s1Len-1], s2: [1] },
      { s1: [s1Len-2], s2: [0] }, { s1: [s1Len-1, s1Len-2], s2: [0, 1] }
    ];
    for (const pat of patterns) {
      let nS1 = [...s1], nS2 = [...s2];
      pat.s1.forEach((idx, i) => {
        if (nS1[idx] && nS2[pat.s2[i]]) [nS1[idx], nS2[pat.s2[i]]] = [nS2[pat.s2[i]], nS1[idx]];
      });
      nS1.sort((a,b) => b.rating - a.rating); nS2.sort((a,b) => b.rating - a.rating);
      const res = this.transposition(nS1, nS2, [], 0, xLimit);
      if (res) return res;
    }
    return null;
  }
}
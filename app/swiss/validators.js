// app/lib/swiss/validators.js
import { calculateColorPreference } from './colorRules.js';

export const isValidPairing = (p1, p2, matchHistory, round, maxRounds) => {
  if (!p1 || !p2 || p1.id === p2.id) return false;
  
  // PDF Sayfa 7 - B.1.a: Tekrar Maç Yasağı
  const matchKey = [p1.id, p2.id].sort().join("-");
  if (matchHistory.has(matchKey)) return false;

  const pref1 = calculateColorPreference(p1, round);
  const pref2 = calculateColorPreference(p2, round);

  // PDF Sayfa 20 - Madde 7: Son tur istisnası
  if (round < maxRounds) {
    // İkisi de Mutlak olarak aynı rengi istiyorsa eşleşemezler
    if (pref1.isAbsolute && pref2.isAbsolute && pref1.pref === pref2.pref) {
      return false;
    }
  }

  return true;
};
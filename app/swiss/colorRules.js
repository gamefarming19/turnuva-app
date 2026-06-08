// app/lib/swiss/colorRules.js

export const calculateColorPreference = (player, round) => {
  const diff = (player.whiteCount || 0) - (player.blackCount || 0);
  const history = String(player.colorHistory || "");
  const lastColor = history[0];
  const last2 = history.substring(0, 2);

  // PDF Sayfa 6 - 7.a: Mutlak Tercih (WWW-BBB engeli veya fark 2)
  if (last2 === "WW" || diff >= 2) return { pref: "B", weight: 1000, isAbsolute: true };
  if (last2 === "BB" || diff <= -2) return { pref: "W", weight: 1000, isAbsolute: true };

  // PDF Sayfa 6 - 7.b & 7.d: Kuvvetli Tercih (Tek turlar öncelikli)
  const isOddRound = round % 2 !== 0;
  if (diff !== 0) {
    return { 
      pref: diff > 0 ? "B" : "W", 
      weight: isOddRound ? 100 : 50, 
      isAbsolute: false 
    };
  }

  // PDF Sayfa 6 - 7.c: Zayıf Tercih
  return { 
    pref: lastColor === "W" ? "B" : "W", 
    weight: 10, 
    isAbsolute: false 
  };
};

export const assignColor = (p1, p2, round) => {
  const pref1 = calculateColorPreference(p1, round);
  const pref2 = calculateColorPreference(p2, round);

  if (pref1.pref !== pref2.pref) {
    return pref1.pref === "W" ? "WB" : "BW";
  }

  if (pref1.weight !== pref2.weight) {
    return pref1.weight > pref2.weight 
      ? (pref1.pref === "W" ? "WB" : "BW")
      : (pref2.pref === "W" ? "BW" : "WB");
  }

  // PDF E.5: Eşitlikte bNo'su küçük olana sırası gelen renk verilir
  return p1.bNo < p2.bNo ? (pref1.pref === "W" ? "WB" : "BW") : "BW";
};
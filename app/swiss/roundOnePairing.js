// app/lib/swiss/roundOnePairing.js

export const generateRoundOne = (players, method, tournamentId) => {
  let pool = [...players];

  // 1. SEÇENEĞE GÖRE SIRALAMA
  if (method === 'dutch') {
    // Dutch: Rating -> bNo
    pool.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.bNo - b.bNo);
  } else if (method === 'alpha') {
    // Alfabetik: İsim A-Z
    pool.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  } else if (method === 'random') {
    // Random: Tamamen karışık kura
    pool.sort(() => Math.random() - 0.5);
  }

  const batchData = { matches: [], bye: null };

  // 2. BYE KONTROLÜ (PDF Sayfa 20, 1.1)
  if (pool.length % 2 !== 0) {
    const byePlayer = pool.pop(); // En alttaki oyuncu tur atlar
    batchData.bye = byePlayer;
  }

  // 3. LİSTEYİ İKİYE BÖLME (S1 ve S2)
  const half = pool.length / 2;
  const s1 = pool.slice(0, half);
  const s2 = pool.slice(half);

  // 4. EŞLEŞTİRME VE RENK KURASI (PDF Sayfa 20, 1.2)
  // Örnek: 1-21 (WB), 22-2 (BW), 3-23 (WB)...
  for (let i = 0; i < s1.length; i++) {
    const tableNumber = i + 1;
    const isOddTable = tableNumber % 2 !== 0;

    // Tek numaralı masalarda S1 beyaz, çiftlerde S2 beyaz (Masaları çaprazlar)
    const white = isOddTable ? s1[i] : s2[i];
    const black = isOddTable ? s2[i] : s1[i];

    batchData.matches.push({
      tournamentId,
      round: 1,
      tableNumber: tableNumber,
      status: "pending",
      p1: white.name, p1_id: white.id, p1_bNo: white.bNo, p1_colorHistory: "",
      p2: black.name, p2_id: black.id, p2_bNo: black.bNo, p2_colorHistory: ""
    });
  }

  return batchData;
};
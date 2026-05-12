import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, increment } from "firebase/firestore";
import Swal from "sweetalert2";

// 1. Renk Dengesi Hesaplama (Kimin başlayacağını belirler)
const getColorBalance = (playerId, matches) => {
  const playerMatches = matches.filter(m => 
    (m.p1_id === playerId || m.p2_id === playerId) && m.status === 'completed'
  );
  const whiteCount = playerMatches.filter(m => m.p1_id === playerId).length; // P1 başlayan
  const blackCount = playerMatches.filter(m => m.p2_id === playerId).length; // P2 bekleyen
  return { diff: whiteCount - blackCount };
};

// 2. Eşleştirme Validasyonu
const validatePairing = (p1, p2, matchHistory) => {
  // Aynı kişiyle tekrar maç kontrolü
  if (matchHistory.has([p1.id, p2.id].sort().join("-"))) return false;
  return true;
};

// 3. Kayan Pencere (Sliding Window) Algoritması
const slidingPairing = (players, matchHistory, matches) => {
  const pairings = [];
  const used = new Set();
  const list = [...players];

  while (list.length > 1) {
    const p1 = list.shift();
    if (used.has(p1.id)) continue;

    let partnerIdx = -1;
    for (let i = 0; i < list.length; i++) {
      const p2 = list[i];
      if (!used.has(p2.id) && validatePairing(p1, p2, matchHistory)) {
        partnerIdx = i;
        break;
      }
    }

    if (partnerIdx !== -1) {
      const p2 = list.splice(partnerIdx, 1)[0];
      
      // Renk Dengesi: Kim daha az "Başlayan (P1)" olduysa o P1 olur
      const p1Bal = getColorBalance(p1.id, matches);
      const p2Bal = getColorBalance(p2.id, matches);
      
      if (p1Bal.diff <= p2Bal.diff) {
        pairings.push({ p1, p2 });
      } else {
        pairings.push({ p1: p2, p2: p1 });
      }
      
      used.add(p1.id);
      used.add(p2.id);
    } else {
      // Eşleşemeyen olursa mecburen sıradakiyle (Kısıt ihlali)
      const p2 = list.shift();
      pairings.push({ p1, p2 });
      used.add(p1.id);
      used.add(p2?.id);
    }
  }
  return pairings;
};

export const runSwissPairing = async (selectedT, players, calculatedPlayers, matches) => {
  if (players.length === 0) return Swal.fire("Hata", "Oyuncu yok!", "error");
  if (matches.filter(m => m.status === 'pending').length > 0) return Swal.fire("Hata", "Turu bitirin!", "error");

  const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) + 1 : 1;
  let list = [...calculatedPlayers];

  // --- 1. TUR ÖZEL KURASI ---
  if (currentRound === 1) {
    const { value: method } = await Swal.fire({
      title: '1. Tur Kura Yöntemi',
      input: 'select',
      inputOptions: { 'bNo': 'B.NO Sıralı', 'alpha': 'A-Z Alfabetik', 'random': 'Random' },
      showCancelButton: true
    });
    if (!method) return false;
    if (method === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (method === 'bNo') list.sort((a, b) => (a.bNo || 0) - (b.bNo || 0));
    else if (method === 'random') list.sort(() => Math.random() - 0.5);
  }

  const matchHistory = new Set(matches.map(m => [m.p1_id, m.p2_id].sort().join("-")));
  const playersWhoHadBye = new Set(matches.filter(m => m.p2_id === "BYE").map(m => m.p1_id));
  const batch = writeBatch(db);
  let table = 1;

  // --- BYE YÖNETİMİ ---
  if (list.length % 2 !== 0) {
    let byeIdx = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (!playersWhoHadBye.has(list[i].id)) { byeIdx = i; break; }
    }
    if (byeIdx === -1) byeIdx = list.length - 1;
    const bay = list.splice(byeIdx, 1)[0];
    batch.set(doc(collection(db, "matches")), {
      tournamentId: selectedT.id, p1: bay.name, p1_id: bay.id, p1_bNo: bay.bNo, p2: "BYE", p2_id: "BYE", p2_bNo: "-", round: currentRound, tableNumber: 99, result: "1-0", status: "completed"
    });
    batch.update(doc(db, "players", bay.id), { points: increment(1), win_count: increment(1) });
  }

  // --- EŞLEŞTİRME ÇALIŞTIR ---
  const pairings = slidingPairing(list, matchHistory, matches);

  pairings.forEach(p => {
    batch.set(doc(collection(db, "matches")), {
      tournamentId: selectedT.id,
      p1: p.p1.name, p1_id: p.p1.id, p1_bNo: p.p1.bNo,
      p2: p.p2.name, p2_id: p.p2.id, p2_bNo: p.p2.bNo,
      round: currentRound, tableNumber: table++,
      result: null, status: "pending"
    });
  });

  await batch.commit();
  Swal.fire("Başarılı", `Tur ${currentRound} hazır!`, "success");
  return true;
};
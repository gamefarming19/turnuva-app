import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, increment, getDocs, query, where } from "firebase/firestore";
import Swal from "sweetalert2";

// 1. GELİŞMİŞ RENK DENGESİ HESAPLAMA
const getAdvancedColorBalance = async (playerId, tournamentId) => {
  try {
    const matchesQuery = query(
      collection(db, "matches"), 
      where("tournamentId", "==", tournamentId),
      where("status", "==", "completed")
    );
    const matchesSnap = await getDocs(matchesQuery);
    
    let whiteCount = 0;
    let blackCount = 0;
    let lastColor = null;
    
    matchesSnap.docs.forEach(doc => {
      const m = doc.data();
      if (m.p1_id === playerId) {
        whiteCount++;
        lastColor = 'white';
      } else if (m.p2_id === playerId) {
        blackCount++;
        lastColor = 'black';
      }
    });
    
    const diff = whiteCount - blackCount;
    const preferredColor = diff > 0 ? 'black' : (diff < 0 ? 'white' : 'auto');
    
    return { diff, whiteCount, blackCount, lastColor, preferredColor };
  } catch (error) {
    console.error("Renk dengesi hatası:", error);
    return { diff: 0, whiteCount: 0, blackCount: 0, lastColor: null, preferredColor: 'auto' };
  }
};

// 2. PUAN GRUPLARINA AYIR (DÜZELTİLDİ)
const groupByPoints = (players) => {
  const groups = {};
  players.forEach(p => {
    const points = p.points || 0;
    if (!groups[points]) groups[points] = [];
    groups[points].push(p);
  });
  return groups;
};

// 3. EŞLEŞTİRME VALİDASYONU
const validateAdvancedPairing = async (p1, p2, tournamentId, currentRound, matchHistory) => {
  if (!p1 || !p2) return false;
  if (p1.id === p2.id) return false;
  if (p2.id === "BYE") return true;
  
  const matchKey = [p1.id, p2.id].sort().join("-");
  if (matchHistory.has(matchKey)) return false;
  
  // 3. kez aynı renk kontrolü
  if (currentRound > 2) {
    const p1Balance = await getAdvancedColorBalance(p1.id, tournamentId);
    const p2Balance = await getAdvancedColorBalance(p2.id, tournamentId);
    if (p1Balance.lastColor === 'white' && p2Balance.lastColor === 'white') return false;
    if (p1Balance.lastColor === 'black' && p2Balance.lastColor === 'black') return false;
  }
  
  return true;
};

// 4. RENK ATAMA
const assignOptimalColors = async (p1, p2, tournamentId) => {
  const p1Balance = await getAdvancedColorBalance(p1.id, tournamentId);
  const p2Balance = await getAdvancedColorBalance(p2.id, tournamentId);
  
  // Daha fazla beyaz oynayan siyah alsın
  if (p1Balance.whiteCount !== p2Balance.whiteCount) {
    return p1Balance.whiteCount > p2Balance.whiteCount ? { p1, p2 } : { p1: p2, p2: p1 };
  }
  
  // Daha fazla siyah oynayan beyaz alsın
  if (p1Balance.blackCount !== p2Balance.blackCount) {
    return p1Balance.blackCount > p2Balance.blackCount ? { p1: p2, p2: p1 } : { p1, p2 };
  }
  
  // Eşitse rastgele
  return Math.random() < 0.5 ? { p1, p2 } : { p1: p2, p2: p1 };
};

// 5. ANA EŞLEŞTİRME ALGORİTMASI (DÜZELTİLDİ)
const advancedSwissPairing = async (players, tournamentId, currentRound, matchHistory) => {
  const pairings = [];
  const used = new Set();
  const groups = groupByPoints(players);
  
  // Puanları yüksekten düşüğe sırala
  const sortedPoints = Object.keys(groups).sort((a, b) => b - a);
  
  let unpairedPlayers = [];
  
  for (const points of sortedPoints) {
    let groupPlayers = [...groups[points]];
    
    // Önceki turdan kalan eşleşmemiş oyuncuları ekle
    groupPlayers = [...unpairedPlayers, ...groupPlayers];
    unpairedPlayers = [];
    
    const groupPairings = [];
    const groupUsed = new Set();
    
    for (let i = 0; i < groupPlayers.length; i++) {
      const p1 = groupPlayers[i];
      if (groupUsed.has(p1.id) || used.has(p1.id)) continue;
      
      let bestMatch = null;
      let bestIndex = -1;
      
      // En uygun eşleşmeyi bul
      for (let j = i + 1; j < groupPlayers.length; j++) {
        const p2 = groupPlayers[j];
        if (groupUsed.has(p2.id) || used.has(p2.id)) continue;
        
        const isValid = await validateAdvancedPairing(p1, p2, tournamentId, currentRound, matchHistory);
        if (isValid) {
          bestMatch = p2;
          bestIndex = j;
          break; // İlk uygun eşleşmeyi al
        }
      }
      
      if (bestMatch) {
        const colors = await assignOptimalColors(p1, bestMatch, tournamentId);
        groupPairings.push(colors);
        groupUsed.add(p1.id);
        groupUsed.add(bestMatch.id);
        used.add(p1.id);
        used.add(bestMatch.id);
        
        // Eşleşen oyuncuyu diziden çıkar
        groupPlayers.splice(bestIndex, 1);
        i--; // İndeksi güncelle
      } else {
        // Eşleşemeyenleri bir sonraki tura bırak
        unpairedPlayers.push(p1);
        groupUsed.add(p1.id);
      }
    }
    
    pairings.push(...groupPairings);
  }
  
  // Hala eşleşmeyen varsa, herhangi biriyle eşleştir
  if (unpairedPlayers.length > 0) {
    for (let i = 0; i < unpairedPlayers.length; i += 2) {
      if (i + 1 < unpairedPlayers.length) {
        const colors = await assignOptimalColors(unpairedPlayers[i], unpairedPlayers[i + 1], tournamentId);
        pairings.push(colors);
      }
    }
  }
  
  return pairings;
};

// 6. BYE YÖNETİMİ
const handleByeAdvanced = async (players, tournamentId, currentRound, batch) => {
  if (players.length % 2 === 0) return null;
  
  // BYE geçmişi kontrol et
  const playersWithByeHistory = new Set();
  const matchesQuery = query(
    collection(db, "matches"),
    where("tournamentId", "==", tournamentId),
    where("p2_id", "==", "BYE")
  );
  const byeMatches = await getDocs(matchesQuery);
  byeMatches.forEach(doc => playersWithByeHistory.add(doc.data().p1_id));
  
  // BYE almamış en düşük puanlı oyuncuyu bul
  const sortedPlayers = [...players].sort((a, b) => {
    const aHadBye = playersWithByeHistory.has(a.id);
    const bHadBye = playersWithByeHistory.has(b.id);
    if (aHadBye !== bHadBye) return aHadBye ? 1 : -1;
    return (a.points || 0) - (b.points || 0);
  });
  
  const byePlayer = sortedPlayers[0];
  const playerIndex = players.findIndex(p => p.id === byePlayer.id);
  players.splice(playerIndex, 1);
  
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
    details: { refereeName: "System", finishTime: new Date().toLocaleTimeString('tr-TR') }
  });
  
  batch.update(doc(db, "players", byePlayer.id), {
    points: increment(1),
    win_count: increment(1)
  });
  
  return byePlayer;
};

// 7. 1. TUR KURASI
const handleFirstRound = async (players) => {
  const { value: method } = await Swal.fire({
    title: '1. Tur Kura Yöntemi',
    text: 'Eşleştirme yöntemini seçin',
    input: 'select',
    inputOptions: {
      'bNo': '📊 B.NO Sıralı',
      'alpha': '🔤 Alfabetik (A-Z)',
      'random': '🎲 Random Kura'
    },
    showCancelButton: true,
    confirmButtonText: 'Başlat',
    cancelButtonText: 'İptal'
  });
  
  if (!method) return null;
  
  const sortedPlayers = [...players];
  if (method === 'alpha') {
    sortedPlayers.sort((a, b) => a.name.localeCompare(b.name));
  } else if (method === 'bNo') {
    sortedPlayers.sort((a, b) => (a.bNo || 999) - (b.bNo || 999));
  } else if (method === 'random') {
    sortedPlayers.sort(() => Math.random() - 0.5);
  }
  
  return sortedPlayers;
};

// 8. ANA EŞLEŞTİRME FONKSİYONU
export const runSwissPairing = async (selectedT, players, calculatedPlayers, matches) => {
  try {
    console.log("Eşleştirme başlıyor...", { playersCount: players.length });
    
    if (players.length === 0) {
      return Swal.fire("Hata", "Turnuvada oyuncu bulunmuyor!", "error");
    }
    
    const pendingMatches = matches.filter(m => m.status === 'pending');
    if (pendingMatches.length > 0) {
      return Swal.fire("Hata", `Önce ${pendingMatches.length} bekleyen maçı tamamlayın!`, "error");
    }
    
    const currentRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) + 1 : 1;
    const maxRounds = selectedT.maxRounds || 7;
    
    if (currentRound > maxRounds) {
      return Swal.fire("Turnuva Tamamlandı", `${maxRounds} tur tamamlandı!`, "info");
    }
    
    let playerList = [...calculatedPlayers];
    playerList = playerList.filter(p => p && p.id);
    
    console.log(`Tur ${currentRound} başlıyor, ${playerList.length} oyuncu`);
    
    // 1. Tur özel işlemleri
    if (currentRound === 1) {
      const sorted = await handleFirstRound(playerList);
      if (!sorted) return false;
      playerList = sorted;
    } else {
      playerList.sort((a, b) => (b.points || 0) - (a.points || 0));
    }
    
    // Match history oluştur
    const matchHistory = new Set();
    matches.forEach(m => {
      if (m.p1_id && m.p2_id && m.p2_id !== "BYE") {
        matchHistory.add([m.p1_id, m.p2_id].sort().join("-"));
      }
    });
    
    const batch = writeBatch(db);
    
    // BYE yönetimi
    await handleByeAdvanced(playerList, selectedT.id, currentRound, batch);
    
    // Eşleştirmeleri yap
    const pairings = await advancedSwissPairing(playerList, selectedT.id, currentRound, matchHistory);
    
    console.log(`${pairings.length} eşleştirme yapıldı`);
    
    if (pairings.length === 0 && playerList.length > 1) {
      throw new Error("Eşleştirme yapılamadı!");
    }
    
    // Maçları oluştur
    let tableNumber = 1;
    for (const pair of pairings) {
      if (!pair.p1 || !pair.p2) continue;
      
      const matchRef = doc(collection(db, "matches"));
      batch.set(matchRef, {
        tournamentId: selectedT.id,
        p1: pair.p1.name,
        p1_id: pair.p1.id,
        p1_bNo: pair.p1.bNo || "-",
        p2: pair.p2.name,
        p2_id: pair.p2.id,
        p2_bNo: pair.p2.bNo || "-",
        round: currentRound,
        tableNumber: tableNumber++,
        result: null,
        status: "pending",
        createdAt: new Date()
      });
    }
    
    await batch.commit();
    
    await Swal.fire({
      title: "Başarılı!",
      html: `${pairings.length} maç oluşturuldu.<br>${currentRound}. Tur hazır!`,
      icon: "success",
      timer: 2000
    });
    
    return true;
    
  } catch (error) {
    console.error("Eşleştirme hatası:", error);
    await Swal.fire("Hata", `Eşleştirme başarısız: ${error.message}`, "error");
    return false;
  }
};
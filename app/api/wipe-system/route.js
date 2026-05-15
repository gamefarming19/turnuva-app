import { NextResponse } from "next/server";
import admin from "firebase-admin";

export const runtime = "nodejs";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export async function POST(req) {
    try {
        const { myUid } = await req.json(); // Kendi UID kodun

        // 1. Tüm kullanıcıları Auth listesinden çek
        const listUsers = await admin.auth().listUsers();
        const deletePromises = listUsers.users
            .filter(user => user.uid !== myUid) // Kendini ayıkla
            .map(user => admin.auth().deleteUser(user.uid)); // Silme listesine ekle

        // 2. Auth temizliğini başlat
        await Promise.all(deletePromises);

        // 3. Firestore koleksiyonlarını temizle
        const db = admin.firestore();
        const collections = ["tournaments", "players", "matches"];
        
        for (const coll of collections) {
            const snap = await db.collection(coll).get();
            const batch = db.batch();
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }

        // 4. Users koleksiyonunda kendin hariç herkesi sil
        const usersSnap = await db.collection("users").get();
        const uBatch = db.batch();
        usersSnap.forEach(d => {
            if (d.id !== myUid) uBatch.delete(d.ref);
        });
        await uBatch.commit();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
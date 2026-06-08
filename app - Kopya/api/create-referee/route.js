import { NextResponse } from "next/server";
import admin from "firebase-admin";

export const runtime = "nodejs";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Gizli anahtardaki satır başlarını düzgün okuması için replace kullanıyoruz
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error("Firebase Admin başlatma hatası:", error);
  }
}

const auth = admin.auth();
const db = admin.firestore();

export async function POST(req) {
  try {
const { email, password, name, ownerUid, phone } = await req.json(); // 👈 phone buraya eklendi
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

await db.collection("users").doc(userRecord.uid).set({
  name: name,
  email: email,
  role: "referee",
  ownerUid: ownerUid,
  assignedTournaments: [],
  tournamentTables: {},
  phone: phone || "",
  status: "active",
  isTemporaryPassword: true, // 👈 BU SATIR MUTLAKA OLMALI
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
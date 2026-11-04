import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const targetId = 'd0cc44c5-f3fe-4c47-8f9e-398488aa1b86';

async function check() {
  console.log('Searching for ID:', targetId);
  const collections = ['global_medicines', 'import_batches', 'admin_activities', 'medicines', 'patients', 'users'];
  
  for (const col of collections) {
    try {
      const snap = await getDoc(doc(db, col, targetId));
      if (snap.exists()) {
        console.log(`FOUND in collection '${col}':`, snap.data());
      } else {
        console.log(`Not found by doc ID in '${col}'`);
      }
    } catch (e: any) {
      console.log(`Error reading doc in '${col}':`, e.message);
    }
  }

  // Also query global_medicines to see what records exist right now
  try {
    const gmSnap = await getDocs(collection(db, 'global_medicines'));
    console.log(`Total records in global_medicines: ${gmSnap.docs.length}`);
    gmSnap.docs.forEach((d) => {
      const data = d.data();
      console.log(`- docId: ${d.id}, brand: ${data.brandName}, status: ${data.status}, importBatchId: ${data.importBatchId}`);
      if (data.importBatchId === targetId || d.id === targetId) {
        console.log('MATCHED RECORD:', data);
      }
    });
  } catch (e: any) {
    console.log('Error listing global_medicines:', e.message);
  }
}

check().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

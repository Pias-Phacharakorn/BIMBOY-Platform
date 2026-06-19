import * as admin from "firebase-admin";

/**
 * Node.js Firebase Admin SDK initialization options.
 * Assumes GOOGLE_APPLICATION_CREDENTIALS environment variable is set
 * or running inside a Firebase environment.
 */
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://learnthatopen.firebaseio.com"
  });
}

const db = admin.firestore();

/**
 * Recursively deletes all documents in a collection, including its subcollections.
 * Utilizes the Firebase Admin SDK's recursiveDelete helper.
 * 
 * @param collectionPath - The path of the collection to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
export async function deleteCollectionRecursively(collectionPath: string): Promise<void> {
  const collectionRef = db.collection(collectionPath);
  console.log(`Starting recursive deletion of collection: ${collectionPath}...`);
  try {
    await db.recursiveDelete(collectionRef);
    console.log(`Successfully deleted collection: ${collectionPath}`);
  } catch (error) {
    console.error(`Error deleting collection ${collectionPath}:`, error);
    throw error;
  }
}

/**
 * Resets the entire Firestore database for PIAS BimWebApp.
 * WARNING: This will permanently delete all projects and users documents.
 * 
 * @returns A promise that resolves when the database has been reset.
 */
export async function resetDatabase(): Promise<void> {
  console.log("-----------------------------------------------------");
  console.log("WARNING: Resetting database. This will wipe all data.");
  console.log("-----------------------------------------------------");
  
  // Delete main collections
  await deleteCollectionRecursively("projects");
  await deleteCollectionRecursively("users");
  
  console.log("Database reset complete.");
}

/**
 * Seeds and initializes default Hub Admins in the newly restructured database.
 * Looks up users by email in Firebase Authentication and creates their profiles.
 * 
 * @param adminEmails - List of emails to assign the 'hub_admin' role.
 * @returns A promise that resolves when default admins have been initialized.
 */
export async function initializeDefaultHubAdmins(adminEmails: string[]): Promise<void> {
  console.log("Initializing default Hub Admins...");
  
  for (const email of adminEmails) {
    const cleanEmail = email.trim().toLowerCase();
    try {
      // Look up user in Firebase Auth
      const userRecord = await admin.auth().getUserByEmail(cleanEmail);
      const uid = userRecord.uid;
      const displayName = userRecord.displayName || cleanEmail.split("@")[0];

      // Create or update the users/{uid} document
      const userRef = db.collection("users").doc(uid);
      await userRef.set({
        uid: uid,
        email: cleanEmail,
        hubRole: "hub_admin",
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Initialized Hub Admin user: ${cleanEmail} (UID: ${uid})`);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        console.warn(`[WARNING] Auth user not found for email: ${cleanEmail}. Make sure they register first.`);
      } else {
        console.error(`Error initializing Hub Admin for ${cleanEmail}:`, error);
      }
    }
  }
}

/**
 * Main execution handler to perform a clean database reset and seed default admins.
 */
async function run(): Promise<void> {
  const defaultAdmins = [
    "pias.phacharakorn@gmail.com",
    "pias.phacharakorn@gmal.com"
  ];
  
  try {
    await resetDatabase();
    await initializeDefaultHubAdmins(defaultAdmins);
    console.log("Clean restart database setup finished successfully.");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  }
}

// Execute if run directly from node
if (require.main === module) {
  run();
}

/* ============================================================================
   CLOUD FUNCTION TRIGGER (FOR DELIVERY REFERENCE)
   ============================================================================ */

/**
 * Cloud Function to synchronize user profile email in Firestore when updated in Auth.
 * 
 * To deploy this Cloud Function, add it to your functions/src/index.ts file:
 * 
 * ```typescript
 * import * as functions from 'firebase-functions';
 * import * as admin from 'firebase-admin';
 * 
 * export const syncEmailChange = functions.auth.user().onUpdate(async (change) => {
 *   const { uid, email } = change.after;
 *   const oldEmail = change.before.email;
 * 
 *   if (email !== oldEmail && email) {
 *     const db = admin.firestore();
 *     const userRef = db.collection('users').doc(uid);
 *     
 *     try {
 *       await db.runTransaction(async (transaction) => {
 *         const snapshot = await transaction.get(userRef);
 *         if (snapshot.exists) {
 *           transaction.update(userRef, {
 *             email: email.trim().toLowerCase(),
 *             updatedAt: admin.firestore.FieldValue.serverTimestamp()
 *           });
 *         }
 *       });
 *       console.log(`Successfully synced email change to Firestore for UID: ${uid}`);
 *     } catch (error) {
 *       console.error(`Error syncing email change for UID ${uid}:`, error);
 *     }
 *   }
 * });
 * ```
 */

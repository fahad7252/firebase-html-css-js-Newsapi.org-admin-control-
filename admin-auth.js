// Place this in a script on your admin pages
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const auth = getAuth();
const db = getFirestore();

// Check if user is admin
async function checkAdminStatus(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    return userDoc.exists() && userDoc.data().isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Protect admin page
function protectAdminPage() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAdmin = await checkAdminStatus(user.uid);
      if (!isAdmin) {
        // Not an admin, redirect
        window.location.href = '/index.html';
      } else {
        // Is admin, show admin content
        document.getElementById('admin-content').style.display = 'block';
      }
    } else {
      // Not logged in, redirect
      window.location.href = '/login.html';
    }
  });
}

// Call this when the page loads
protectAdminPage();
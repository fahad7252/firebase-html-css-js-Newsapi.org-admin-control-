// js/auth-service.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { auth, db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Create a new user account with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Result object with success flag and user or error
 */
export const registerUser = async (email, password, displayName) => {
  try {
    // Create the user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with display name
    if (displayName) {
      await updateProfile(user, { displayName });
    }
    
    // Send email verification
    await sendEmailVerification(user);
    
    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName || '',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    return { success: true, user };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Update the user's profile information
 * @param {string} displayName - User's display name
 * @param {string} photoURL - URL to user's profile photo
 * @returns {Promise<Object>} - Result object with success flag and error if any
 */
export const updateUserProfile = async (displayName, photoURL = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in");
    
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (photoURL) updateData.photoURL = photoURL;
    
    await updateProfile(user, updateData);
    
    // Also update the user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      displayName: displayName || user.displayName,
      photoURL: photoURL || user.photoURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error("Profile update error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Sign in with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Result object with success flag and user or error
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Update last login timestamp in Firestore
    await setDoc(doc(db, "users", userCredential.user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true });
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Sign in with Google
 * @returns {Promise<Object>} - Result object with success flag and user or error
 */
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if this is a new user or existing user
    const isNewUser = result._tokenResponse.isNewUser;
    
    // Update Firestore with user information
    if (isNewUser) {
      // New user - create document
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        authProvider: "google"
      });
    } else {
      // Existing user - update last login
      await setDoc(doc(db, "users", user.uid), {
        lastLogin: serverTimestamp()
      }, { merge: true });
    }
    
    return { success: true, user };
  } catch (error) {
    console.error("Google sign-in error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @returns {Promise<Object>} - Result object with success flag and error if any
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Log out current user
 * @returns {Promise<Object>} - Result object with success flag and error if any
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the current authenticated user
 * @returns {Object|null} - The current user or null if not authenticated
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Listen for authentication state changes
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} - Unsubscribe function
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Check if user's email is verified
 * @returns {boolean} - Whether the user's email is verified
 */
export const isEmailVerified = () => {
  const user = auth.currentUser;
  return user ? user.emailVerified : false;
};

/**
 * Resend verification email to current user
 * @returns {Promise<Object>} - Result object with success flag and error if any
 */
export const resendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in");
    
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    console.error("Verification email error:", error);
    return { success: false, error: error.message };
  }
};
// Import authentication functions
import { 
  registerUser, 
  loginUser, 
  signInWithGoogle, 
  logoutUser, 
  resetPassword, 
  onAuthStateChanged, 
  getCurrentUser 
} from './auth.js';

import { db } from './firebase-config.js';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize authentication UI
export function initAuthUI() {
  const currentPage = document.body.dataset.page;
  
  if (currentPage === 'signup') {
    initializeSignupPage();
  } else if (currentPage === 'login') {
    initializeLoginPage();
  }
  
  // Check auth state for all pages
  setupAuthStateListener();
  
  // Add logout functionality
  setupLogoutButtons();
}

// Initialize signup page functionality
function initializeSignupPage() {
  const signupForm = document.querySelector('.signup-form');
  if (!signupForm) return;
  
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form inputs
    const usernameInput = signupForm.querySelector('#username');
    const emailInput = signupForm.querySelector('#email');
    const passwordInput = signupForm.querySelector('#password');
    const confirmPasswordInput = signupForm.querySelector('#confirm-password');
    const termsCheckbox = signupForm.querySelector('#terms');
    
    // Get values
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    
    // Reset error display
    clearAllErrors(signupForm);
    const authError = signupForm.querySelector('.auth-error');
    if (authError) authError.style.display = 'none';
    
    // Form validation
    let isValid = true;
    
    if (username === '') {
      showError(usernameInput, 'Please choose a username');
      isValid = false;
    } else if (username.length < 3) {
      showError(usernameInput, 'Username must be at least 3 characters');
      isValid = false;
    }
    
    if (email === '') {
      showError(emailInput, 'Please enter your email address');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError(emailInput, 'Please enter a valid email address');
      isValid = false;
    }
    
    if (password === '') {
      showError(passwordInput, 'Please enter a password');
      isValid = false;
    } else if (password.length < 8) {
      showError(passwordInput, 'Password must be at least 8 characters');
      isValid = false;
    }
    
    if (confirmPassword === '') {
      showError(confirmPasswordInput, 'Please confirm your password');
      isValid = false;
    } else if (confirmPassword !== password) {
      showError(confirmPasswordInput, 'Passwords do not match');
      isValid = false;
    }
    
    if (!termsCheckbox.checked) {
      showFormError(termsCheckbox.parentElement, 'You must agree to the Terms and Conditions');
      isValid = false;
    }
    
    if (isValid) {
      // Show loading state
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Creating Account...';
      submitBtn.disabled = true;
      
      try {
        // Register user with Firebase
        const result = await registerUser(email, password);
        
        if (result.success) {
          // Save additional user data to Firestore
          await saveUserData(result.user.uid, {
            username,
            email,
            displayName: username,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          });
          
          // Show success message
          const formContainer = signupForm.closest('.auth-container');
          
          // Hide form
          signupForm.style.display = 'none';
          
          // Show success message
          const successMessage = document.createElement('div');
          successMessage.className = 'auth-success';
          successMessage.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <h3>Account Created Successfully!</h3>
            <p>Welcome to Trends Virals, ${username}! You will be redirected to the home page shortly.</p>
          `;
          
          formContainer.appendChild(successMessage);
          
          // Redirect to home page after a delay
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 3000);
        } else {
          // Show error message
          showAuthError(signupForm, result.error);
          
          // Reset button
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        // Show error message
        showAuthError(signupForm, error.message || 'An unexpected error occurred');
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });
  
  // Google sign in button
  const googleBtn = signupForm.querySelector('.google-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }
}

// Initialize login page functionality
function initializeLoginPage() {
  const loginForm = document.querySelector('.login-form');
  if (!loginForm) return;
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form inputs
    const emailInput = loginForm.querySelector('#email');
    const passwordInput = loginForm.querySelector('#password');
    
    // Get values
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Reset error display
    clearAllErrors(loginForm);
    const authError = loginForm.querySelector('.auth-error');
    if (authError) authError.style.display = 'none';
    
    // Form validation
    let isValid = true;
    
    if (email === '') {
      showError(emailInput, 'Please enter your email address');
      isValid = false;
    }
    
    if (password === '') {
      showError(passwordInput, 'Please enter your password');
      isValid = false;
    }
    
    if (isValid) {
      // Show loading state
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Signing In...';
      submitBtn.disabled = true;
      
      try {
        // Login user with Firebase
        const result = await loginUser(email, password);
        
        if (result.success) {
          // Update last login timestamp
          await updateUserLoginTime(result.user.uid);
          
          // Redirect to home page
          window.location.href = 'index.html';
        } else {
          // Show error message
          showAuthError(loginForm, result.error);
          
          // Reset button
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      } catch (error) {
        // Show error message
        showAuthError(loginForm, error.message || 'An unexpected error occurred');
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }
  });
  
  // Google sign in button
  const googleBtn = loginForm.querySelector('.google-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }
  
  // Forgot password link
  const forgotPasswordLink = loginForm.querySelector('.forgot-password');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Get email input
      const emailInput = loginForm.querySelector('#email');
      const email = emailInput.value.trim();
      
      // Create modal for password reset
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Reset Password</h3>
            <button class="close-modal">&times;</button>
          </div>
          <div class="modal-body">
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            <div class="form-group">
              <label for="reset-email">Email Address</label>
              <div class="input-icon-wrapper">
                <i class="fas fa-envelope"></i>
                <input type="email" id="reset-email" value="${email}" placeholder="Enter your email">
              </div>
              <div class="field-error" style="display: none;"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn cancel-btn">Cancel</button>
            <button class="btn reset-btn">Send Reset Link</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Show modal with animation
      setTimeout(() => {
        modal.classList.add('show');
      }, 10);
      
      // Close button
      const closeBtn = modal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => closeModal(modal));
      
      // Cancel button
      const cancelBtn = modal.querySelector('.cancel-btn');
      cancelBtn.addEventListener('click', () => closeModal(modal));
      
      // Close when clicking outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
      
      // Reset button
      const resetBtn = modal.querySelector('.reset-btn');
      resetBtn.addEventListener('click', async () => {
        const resetEmail = modal.querySelector('#reset-email').value.trim();
        const errorElement = modal.querySelector('.field-error');
        
        // Validate email
        if (resetEmail === '') {
          errorElement.textContent = 'Please enter your email address';
          errorElement.style.display = 'block';
          return;
        } else if (!isValidEmail(resetEmail)) {
          errorElement.textContent = 'Please enter a valid email address';
          errorElement.style.display = 'block';
          return;
        }
        
        // Show loading state
        resetBtn.textContent = 'Sending...';
        resetBtn.disabled = true;
        
        try {
          // Send password reset email
          const result = await resetPassword(resetEmail);
          
          if (result.success) {
            // Update modal content to show success message
            const modalBody = modal.querySelector('.modal-body');
            modalBody.innerHTML = `
              <div class="reset-success">
                <i class="fas fa-check-circle"></i>
                <p>Password reset link has been sent to your email address.</p>
                <p>Please check your inbox and follow the instructions to reset your password.</p>
              </div>
            `;
            
            // Update footer buttons
            const modalFooter = modal.querySelector('.modal-footer');
            modalFooter.innerHTML = `
              <button class="btn close-btn">Close</button>
            `;
            
            // Add event listener to close button
            modal.querySelector('.close-btn').addEventListener('click', () => closeModal(modal));
          } else {
            // Show error message
            errorElement.textContent = result.error;
            errorElement.style.display = 'block';
            
            // Reset button
            resetBtn.textContent = 'Send Reset Link';
            resetBtn.disabled = false;
          }
        } catch (error) {
          // Show error message
          errorElement.textContent = error.message || 'An unexpected error occurred';
          errorElement.style.display = 'block';
          
          // Reset button
          resetBtn.textContent = 'Send Reset Link';
          resetBtn.disabled = false;
        }
      });
    });
  }
}

// Handle Google Sign-in
async function handleGoogleSignIn() {
  try {
    const result = await signInWithGoogle();
    
    if (result.success) {
      // Check if this is a new user
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      
      if (!userDoc.exists()) {
        // Save user data for new users
        await saveUserData(result.user.uid, {
          username: result.user.displayName || result.user.email.split('@')[0],
          email: result.user.email,
          displayName: result.user.displayName || result.user.email.split('@')[0],
          photoURL: result.user.photoURL,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      } else {
        // Update last login timestamp
        await updateUserLoginTime(result.user.uid);
      }
      
      // Redirect to home page
      window.location.href = 'index.html';
    } else {
      // Show error in alert (can be improved)
      alert('Google sign-in failed: ' + result.error);
    }
  } catch (error) {
    // Show error in alert (can be improved)
    alert('Google sign-in error: ' + (error.message || 'An unexpected error occurred'));
  }
}

// Setup authentication state listener
function setupAuthStateListener() {
  onAuthStateChanged(async (user) => {
    // Update UI based on authentication state
    updateUIForAuthState(user);
    
    // If user is logged in, check and update user data
    if (user) {
      console.log('User is signed in:', user.email);
      
      try {
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          // Create user document if it doesn't exist
          await saveUserData(user.uid, {
            username: user.displayName || user.email.split('@')[0],
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error checking user data:', error);
      }
    }
  });
}

// Update UI based on authentication state
function updateUIForAuthState(user) {
  // Update header user section
  updateHeaderUserSection(user);
  
  // Handle page-specific redirects
  const currentPage = document.body.dataset.page;
  
  if (user) {
    // User is signed in
    
    // If on login or signup page, redirect to home
    if (currentPage === 'login' || currentPage === 'signup') {
      window.location.href = 'index.html';
    }
    
    // Show user-only content
    document.querySelectorAll('.logged-in-only').forEach(el => {
      el.style.display = 'block';
    });
    
    // Hide guest-only content
    document.querySelectorAll('.logged-out-only').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    // User is signed out
    
    // If on protected pages, redirect to login
    if (currentPage === 'profile') {
      window.location.href = 'login.html';
    }
    
    // Hide user-only content
    document.querySelectorAll('.logged-in-only').forEach(el => {
      el.style.display = 'none';
    });
    
    // Show guest-only content
    document.querySelectorAll('.logged-out-only').forEach(el => {
      el.style.display = 'block';
    });
  }
}

// Update header user section based on auth state
function updateHeaderUserSection(user) {
  const userSection = document.querySelector('.user-section');
  if (!userSection) return;
  
  if (user) {
    // User is logged in
    userSection.innerHTML = `
      <a href="profile.html" class="user-profile">
        <span>${user.displayName || user.email.split('@')[0]}</span>
        <img src="${user.photoURL || 'images/default-avatar.png'}" alt="Profile" class="avatar">
      </a>
      <button class="btn logout-btn">Log Out</button>
    `;
    
    // Add logout functionality to new button
    const logoutBtn = userSection.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  } else {
    // User is logged out, use default markup from HTML
    userSection.innerHTML = `
      <a href="login.html" class="btn login-btn">Log In</a>
      <a href="signup.html" class="btn signup-btn">Sign Up</a>
      <button class="search-toggle"><i class="fas fa-search"></i></button>
    `;
  }
}

// Setup logout buttons
function setupLogoutButtons() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.logout-btn')) {
      handleLogout(e);
    }
  });
}

// Handle logout
async function handleLogout(e) {
  if (e) e.preventDefault();
  
  try {
    // Log out the user
    const result = await logoutUser();
    
    if (result.success) {
      // Redirect to home page or refresh
      window.location.href = 'index.html';
    } else {
      // Show error
      alert('Logout failed: ' + result.error);
    }
  } catch (error) {
    // Show error
    alert('Logout error: ' + (error.message || 'An unexpected error occurred'));
  }
}

// Save user data to Firestore
async function saveUserData(userId, userData) {
  try {
    await setDoc(doc(db, "users", userId), userData);
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
}

// Update user last login timestamp
async function updateUserLoginTime(userId) {
  try {
    await updateDoc(doc(db, "users", userId), {
      lastLogin: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating last login time:', error);
    return false;
  }
}

// Close modal helper function
function closeModal(modal) {
  modal.classList.remove('show');
  
  // Remove from DOM after animation
  setTimeout(() => {
    modal.remove();
  }, 300);
}

// Show auth error helper function
function showAuthError(form, message) {
  let errorElement = form.querySelector('.auth-error');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'auth-error';
    
    // Find insert point (usually before submit button)
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.before(errorElement);
    } else {
      form.appendChild(errorElement);
    }
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

// Form validation helper functions
function showError(inputElement, message) {
  // Get or create field error element
  let fieldError = inputElement.closest('.form-group').querySelector('.field-error');
  
  if (!fieldError) {
    fieldError = document.createElement('div');
    fieldError.className = 'field-error';
    inputElement.closest('.form-group').appendChild(fieldError);
  }
  
  // Add error class to input
  inputElement.classList.add('error');
  
  // Set error message
  fieldError.textContent = message;
  fieldError.style.display = 'block';
}

function showFormError(element, message) {
  // Clear existing error
  clearFormError(element);
  
  // Create error message element
  const errorElement = document.createElement('div');
  errorElement.className = 'form-error';
  errorElement.textContent = message;
  
  // Insert error message after element
  element.after(errorElement);
}

function clearFormError(element) {
  // Find next sibling if it's an error message
  const next = element.nextElementSibling;
  if (next && next.classList.contains('form-error')) {
    next.remove();
  }
}

function clearAllErrors(form) {
  // Remove all field errors
  form.querySelectorAll('.field-error').forEach(error => {
    error.textContent = '';
    error.style.display = 'none';
  });
  
  // Remove error class from inputs
  form.querySelectorAll('input.error').forEach(input => {
    input.classList.remove('error');
  });
  
  // Remove form errors
  form.querySelectorAll('.form-error').forEach(error => {
    error.remove();
  });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
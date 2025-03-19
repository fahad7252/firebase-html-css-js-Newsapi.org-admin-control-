// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase - use direct script imports instead of ES modules
// The auth module will be registered properly this way
let app, auth, db;

document.addEventListener('DOMContentLoaded', async function() {
  // Wait for Firebase to load
  await loadFirebase();
  
  // Initialize Firebase services
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  // Check current page
  const currentPage = document.body.getAttribute('data-page');
  
  // Initialize UI interactions
  initUIInteractions();
  
  // Handle authentication state
  initAuthStateListener();
  
  // Load page-specific content
  loadPageContent(currentPage);
});

// UI Interactions
function initUIInteractions() {
  // Toggle search bar
  const searchToggle = document.querySelector('.search-toggle');
  const searchContainer = document.querySelector('.search-container');
  
  if (searchToggle && searchContainer) {
    searchToggle.addEventListener('click', () => {
      searchContainer.classList.toggle('active');
      if (searchContainer.classList.contains('active')) {
        searchContainer.querySelector('input').focus();
      }
    });
  }
  
  // User dropdown
  const userDropdown = document.querySelector('.user-info');
  if (userDropdown) {
    userDropdown.addEventListener('click', () => {
      document.querySelector('.dropdown-menu').classList.toggle('active');
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (event) => {
    // Close search if click is outside search container
    if (searchContainer && searchContainer.classList.contains('active')) {
      if (!event.target.closest('.search-container') && !event.target.closest('.search-toggle')) {
        searchContainer.classList.remove('active');
      }
    }
    
    // Close user dropdown if click is outside dropdown
    const dropdownMenu = document.querySelector('.dropdown-menu');
    if (dropdownMenu && dropdownMenu.classList.contains('active')) {
      if (!event.target.closest('.user-dropdown')) {
        dropdownMenu.classList.remove('active');
      }
    }
  });
  
  // Handle login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Handle signup form submission
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  
  // Handle logout
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Newsletter subscription
  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', handleNewsletterSubscription);
  }
  
  // Like, comment, and share buttons
  setupCommunityInteractions();
}

// Load Firebase dependencies
function loadFirebase() {
  return new Promise((resolve, reject) => {
    // Check if Firebase is already loaded
    if (typeof firebase !== 'undefined') {
      resolve();
      return;
    }

    // Load Firebase scripts
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.15.0/firebase-app-compat.js',
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.15.0/firebase-auth-compat.js',
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/9.15.0/firebase-firestore-compat.js'
    ];

    let loaded = 0;
    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          resolve();
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  });
}

// Auth state listener
function initAuthStateListener() {
  auth.onAuthStateChanged((user) => {
    const userSection = document.querySelector('.user-section');
    const loggedInOnly = document.querySelector('.logged-in-only');
    
    if (user) {
      // User is signed in
      if (userSection) userSection.style.display = 'none';
      if (loggedInOnly) {
        loggedInOnly.style.display = 'block';
        const userDisplayName = document.querySelector('.user-display-name');
        if (userDisplayName) {
          userDisplayName.textContent = user.displayName || user.email.split('@')[0];
        }
        
        const userAvatar = document.querySelector('.user-avatar-img');
        if (userAvatar) {
          userAvatar.src = user.photoURL || '/img/default-avatar.png';
        }
      }
    } else {
      // User is signed out
      if (userSection) userSection.style.display = 'flex';
      if (loggedInOnly) loggedInOnly.style.display = 'none';
    }
  });
}

// Handle login
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorMessage = document.getElementById('login-error');
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Redirect to home page after successful login
    window.location.href = 'index.html';
  } catch (error) {
    if (errorMessage) {
      errorMessage.textContent = error.message;
      errorMessage.style.display = 'block';
    }
    console.error('Login error:', error);
  }
}

// Handle signup
async function handleSignup(event) {
  event.preventDefault();
  
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;
  const errorMessage = document.getElementById('signup-error');
  
  if (password !== confirmPassword) {
    if (errorMessage) {
      errorMessage.textContent = 'Passwords do not match';
      errorMessage.style.display = 'block';
    }
    return;
  }
  
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    // Redirect to home page after successful signup
    window.location.href = 'index.html';
  } catch (error) {
    if (errorMessage) {
      errorMessage.textContent = error.message;
      errorMessage.style.display = 'block';
    }
    console.error('Signup error:', error);
  }
}

// Handle logout
async function handleLogout(event) {
  event.preventDefault();
  
  try {
    await signOut(auth);
    // Reload page after logout
    window.location.reload();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Handle newsletter subscription
async function handleNewsletterSubscription(event) {
  event.preventDefault();
  
  const emailInput = event.target.querySelector('input[type="email"]');
  const email = emailInput.value;
  
  try {
    await db.collection("newsletter_subscribers").add({
      email: email,
      subscribed_at: new Date()
    });
    
    // Show success message
    const form = event.target;
    form.innerHTML = '<p class="success-message">Thanks for subscribing!</p>';
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    // Show error message
    const form = event.target;
    form.innerHTML += '<p class="error-message">There was an error. Please try again later.</p>';
  }
}

// Setup community interactions (like, comment, share)
function setupCommunityInteractions() {
  // Like buttons
  const likeButtons = document.querySelectorAll('.like-btn');
  likeButtons.forEach(button => {
    button.addEventListener('click', async () => {
      if (!auth.currentUser) {
        // Redirect to login if not signed in
        window.location.href = 'login.html';
        return;
      }
      
      const postElement = button.closest('.community-post');
      if (!postElement) return;
      
      const postId = postElement.dataset.postId;
      if (!postId) return;
      
      try {
        // Check if user already liked this post
        const querySnapshot = await db.collection("likes")
          .where("user_id", "==", auth.currentUser.uid)
          .where("post_id", "==", postId)
          .get();
        
        if (querySnapshot.empty) {
          // User hasn't liked yet, add a like
          await db.collection("likes").add({
            user_id: auth.currentUser.uid,
            post_id: postId,
            created_at: new Date()
          });
          
          // Update UI
          const likeCount = button.textContent.trim().split(' ')[1];
          button.innerHTML = `<i class="fas fa-heart"></i> ${parseInt(likeCount) + 1}`;
          button.classList.add('liked');
        } else {
          // Already liked, could implement unlike functionality here
          console.log("Post already liked");
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    });
  });
  
  // Comment buttons
  const commentButtons = document.querySelectorAll('.comment-btn');
  commentButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (!auth.currentUser) {
        // Redirect to login if not signed in
        window.location.href = 'login.html';
        return;
      }
      
      const postElement = button.closest('.community-post');
      if (!postElement) return;
      
      const postId = postElement.dataset.postId;
      if (!postId) return;
      
      // Redirect to post detail page with comment section
      window.location.href = `post.html?id=${postId}#comments`;
    });
  });
  
  // Share buttons
  const shareButtons = document.querySelectorAll('.share-btn');
  shareButtons.forEach(button => {
    button.addEventListener('click', () => {
      const postElement = button.closest('.community-post');
      if (!postElement) return;
      
      const postId = postElement.dataset.postId;
      if (!postId) return;
      
      // Create share URL
      const shareUrl = `${window.location.origin}/post.html?id=${postId}`;
      
      // Use Web Share API if available
      if (navigator.share) {
        navigator.share({
          title: 'Check out this post on Trends Virals',
          url: shareUrl
        }).catch(err => {
          console.error('Share error:', err);
        });
      } else {
        // Fallback - copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          alert('Link copied to clipboard!');
        }).catch(err => {
          console.error('Copy error:', err);
        });
      }
    });
  });
}

// Load page-specific content from Firebase
async function loadPageContent(currentPage) {
  switch (currentPage) {
    case 'home':
      await loadFeaturedContent();
      await loadCommunityHighlights();
      break;
    case 'news':
      await loadNewsPosts();
      break;
    case 'community':
      await loadCommunityPosts();
      break;
    case 'profile':
      await loadUserProfile();
      break;
    // Add other pages as needed
  }
}

// Load featured content from Firebase
async function loadFeaturedContent() {
  try {
    const querySnapshot = await db.collection("featured_articles")
      .orderBy("date", "desc")
      .limit(3)
      .get();
    
    // Only proceed if we have a content grid
    const contentGrid = document.querySelector('.content-grid');
    if (!contentGrid) return;
    
    // If we have fetched articles, replace the content
    if (!querySnapshot.empty) {
      // Clear existing articles first
      contentGrid.innerHTML = '';
      
      querySnapshot.forEach((doc) => {
        const article = doc.data();
        
        // Create article element and add to content grid
        const articleElement = createArticleElement(article, doc.id);
        contentGrid.appendChild(articleElement);
      });
    }
  } catch (error) {
    console.error('Error loading featured content:', error);
  }
}

// Load community highlights from Firebase
async function loadCommunityHighlights() {
  try {
    const querySnapshot = await db.collection("community_posts")
      .orderBy("created_at", "desc")
      .limit(2)
      .get();
    
    // Only proceed if we have a community posts container
    const communityPosts = document.querySelector('.community-posts');
    if (!communityPosts) return;
    
    // If we have fetched posts, replace the content
    if (!querySnapshot.empty) {
      // Clear existing posts first
      communityPosts.innerHTML = '';
      
      querySnapshot.forEach((doc) => {
        const post = doc.data();
        
        // Create post element and add to community posts
        const postElement = createCommunityPostElement(post, doc.id);
        communityPosts.appendChild(postElement);
      });
      
      // Re-setup community interactions for new elements
      setupCommunityInteractions();
    }
  } catch (error) {
    console.error('Error loading community highlights:', error);
  }
}

// Create article element
function createArticleElement(article, articleId) {
  const articleElement = document.createElement('article');
  articleElement.className = 'featured-card';
  articleElement.dataset.articleId = articleId;
  
  articleElement.innerHTML = `
    <div class="card-image">
      <img src="${article.image_url || '/api/placeholder/600/400'}" alt="${article.title}">
      <span class="category-tag ${article.category.toLowerCase()}">${article.category}</span>
    </div>
    <div class="card-content">
      <h3>${article.title}</h3>
      <p class="excerpt">${article.excerpt}</p>
      <div class="card-meta">
        <span class="author">By ${article.author}</span>
        <span class="date">${formatDate(article.date)}</span>
        <span class="views"><i class="fas fa-eye"></i> ${formatViewCount(article.views)}</span>
      </div>
    </div>
  `;
  
  // Add click event to navigate to article page
  articleElement.addEventListener('click', () => {
    window.location.href = `article.html?id=${articleId}`;
  });
  
  return articleElement;
}

// Create community post element
function createCommunityPostElement(post, postId) {
  const postElement = document.createElement('div');
  postElement.className = 'community-post';
  postElement.dataset.postId = postId;
  
  const timeAgo = formatTimeAgo(post.created_at);
  
  postElement.innerHTML = `
    <div class="post-header">
      <img src="${post.user_avatar || '/api/placeholder/50/50'}" alt="User Avatar" class="user-avatar">
      <div class="post-info">
        <h3 class="username">@${post.username}</h3>
        <span class="post-time">${timeAgo}</span>
      </div>
    </div>
    <div class="post-content">
      <p>${post.content}</p>
      ${post.image_url ? `<img src="${post.image_url}" alt="Post Image" class="post-image">` : ''}
    </div>
    <div class="post-actions">
      <button class="like-btn"><i class="fas fa-heart"></i> ${post.likes || 0}</button>
      <button class="comment-btn"><i class="fas fa-comment"></i> ${post.comments || 0}</button>
      <button class="share-btn"><i class="fas fa-share"></i> Share</button>
    </div>
  `;
  
  return postElement;
}

// Load news posts
async function loadNewsPosts() {
  // Similar to loadFeaturedContent, but for news
  console.log('Loading news posts...');
}

// Load community posts
async function loadCommunityPosts() {
  // Similar to loadCommunityHighlights, but for the community page
  console.log('Loading community posts...');
}

// Load user profile
async function loadUserProfile() {
  if (!auth.currentUser) {
    window.location.href = 'login.html';
    return;
  }
  
  // Load user data from Firestore
  try {
    const userDoc = await db.collection("users").doc(auth.currentUser.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Update UI with user data
      const profileName = document.getElementById('profile-name');
      if (profileName) profileName.textContent = userData.displayName || auth.currentUser.email.split('@')[0];
      
      const profileBio = document.getElementById('profile-bio');
      if (profileBio) profileBio.textContent = userData.bio || 'No bio yet.';
      
      // Load user's posts, saved articles, etc.
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

// Utility: Format date
function formatDate(date) {
  const dateObj = date instanceof Date ? date : date.toDate();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  return `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
}

// Utility: Format view count
function formatViewCount(count) {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Utility: Format time ago
function formatTimeAgo(timestamp) {
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
  const now = new Date();
  const diffMs = now - date;
  
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  
  if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  
  return 'Just now';
}

import { checkAdminStatus } from './js/admin-setup.js';

async function checkIfUserIsAdmin(userId) {
  const isAdmin = await checkAdminStatus(userId);
  
  if (isAdmin) {
    // Show admin controls
    document.getElementById('admin-controls').style.display = 'block';
  } else {
    // Hide admin controls
    document.getElementById('admin-controls').style.display = 'none';
  }
}

// Call this when a user logs in
auth.onAuthStateChanged(user => {
  if (user) {
    checkIfUserIsAdmin(user.uid);
  } else {
    // User is logged out
    document.getElementById('admin-controls').style.display = 'none';
  }
});
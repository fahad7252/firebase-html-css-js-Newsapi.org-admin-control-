// admin.js - Firebase Admin Dashboard Functionality
import { db, auth, storage } from './firebase-config.js';
import { onAuthStateChanged, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Global state
let currentUser = null;
let isAdmin = false;
let currentPage = {
    featuredPosts: 1,
    newsPosts: 1,
    community: 1,
    users: 1,
    media: 1
};
let lastVisible = {
    featuredPosts: null,
    newsPosts: null,
    community: null,
    users: null
};
let itemsPerPage = 10;

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    onAuthStateChanged(auth, handleAuthStateChange);
    
    // Set up navigation
    setupNavigation();
    
    // Set up modal events
    setupModals();
});

// Handle authentication state changes
async function handleAuthStateChange(user) {
    if (user) {
        console.log('User is signed in:', user.email);
        currentUser = user;
        
        // Check if user is admin
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            isAdmin = userDoc.exists() && userDoc.data().isAdmin === true;
            
            if (!isAdmin) {
                // Redirect non-admin users to home page
                window.location.href = "index.html";
                return;
            }
            
            // Update UI for logged in admin
            updateUserUI(user);
            
            // Load initial data
            loadDashboardData();
        } catch (error) {
            console.error("Error checking admin status:", error);
            // Redirect on error
            window.location.href = "index.html";
        }
    } else {
        console.log('User is signed out');
        // Redirect to login page
        window.location.href = "login.html?redirect=admin.html";
    }
}

// Update user UI
function updateUserUI(user) {
    const userDisplayName = document.querySelector('.user-display-name');
    const userAvatar = document.querySelector('.user-avatar-img');
    
    if (userDisplayName) {
        userDisplayName.textContent = user.displayName || user.email.split('@')[0];
    }
    
    if (userAvatar) {
        userAvatar.src = user.photoURL || '/img/default-avatar.jpg';
        userAvatar.onerror = () => {
            userAvatar.src = '/img/default-avatar.jpg';
        };
    }
    
    // Setup logout button
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                window.location.href = "login.html";
            } catch (error) {
                console.error("Logout error:", error);
                showToast("Error logging out. Please try again.", "error");
            }
        });
    }
}

// Setup navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav a');
    const sections = document.querySelectorAll('.admin-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get the section ID
            const sectionId = link.getAttribute('data-section');
            
            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked link and corresponding section
            link.classList.add('active');
            document.getElementById(sectionId).classList.add('active');
            
            // Load section data if needed
            loadSectionData(sectionId);
        });
    });
    
    // Setup tab navigation for newsletter section
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Load tab data if needed
            loadTabData(tabId);
        });
    });
    
    // Quick action buttons
    document.getElementById('create-featured-post-btn').addEventListener('click', () => {
        // Navigate to featured posts section and open modal
        const featuredLink = document.querySelector('a[data-section="featured-posts"]');
        featuredLink.click();
        document.getElementById('add-new-featured-post').click();
    });
    
    document.getElementById('create-news-post-btn').addEventListener('click', () => {
        // Navigate to news posts section and open modal
        const newsLink = document.querySelector('a[data-section="news-posts"]');
        newsLink.click();
        document.getElementById('add-new-news-post').click();
    });
    
    document.getElementById('manage-users-btn').addEventListener('click', () => {
        // Navigate to users section
        const usersLink = document.querySelector('a[data-section="users"]');
        usersLink.click();
    });
    
    document.getElementById('manage-media-btn').addEventListener('click', () => {
        // Navigate to media section
        const mediaLink = document.querySelector('a[data-section="media"]');
        mediaLink.click();
    });
}

// Setup modals
function setupModals() {
    // Post modals (reuse from main site)
    document.getElementById('add-new-featured-post').addEventListener('click', () => {
        showAddPostModal('featured');
    });
    
    document.getElementById('add-new-news-post').addEventListener('click', () => {
        showAddPostModal('news');
    });
    
    // User modal
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const addUserBtn = document.getElementById('add-new-user');
    const closeUserModalBtns = userModal.querySelectorAll('.close-modal, .cancel-btn');
    
    addUserBtn.addEventListener('click', () => {
        userModal.style.display = 'block';
        userForm.reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-modal-title').textContent = 'Add New User';
        document.getElementById('password-group').style.display = 'block';
    });
    
    closeUserModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    });
    
    userForm.addEventListener('submit', handleUserFormSubmission);
    
    // Media modal
    const mediaModal = document.getElementById('media-modal');
    const mediaForm = document.getElementById('media-upload-form');
    const uploadMediaBtn = document.getElementById('upload-media-btn');
    const closeMediaModalBtns = mediaModal.querySelectorAll('.close-modal, .cancel-btn');
    
    uploadMediaBtn.addEventListener('click', () => {
        mediaModal.style.display = 'block';
        mediaForm.reset();
        document.querySelector('.upload-preview-grid').innerHTML = '';
    });
    
    closeMediaModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mediaModal.style.display = 'none';
        });
    });
    
    // Set up media preview
    const mediaUploadInput = document.getElementById('media-upload');
    const previewContainer = document.querySelector('.upload-preview-grid');
    
    mediaUploadInput.addEventListener('change', (e) => {
        previewContainer.innerHTML = '';
        const files = e.target.files;
        
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="remove-btn" data-index="${i}">&times;</button>
                    `;
                    previewContainer.appendChild(previewItem);
                    
                    // Add remove button functionality
                    previewItem.querySelector('.remove-btn').addEventListener('click', function() {
                        previewItem.remove();
                        // Note: This doesn't actually remove the file from the input
                        // For that, you'd need to create a new FileList, which isn't directly possible
                        // A workaround is to reset the entire form if needed
                    });
                };
                
                reader.readAsDataURL(file);
            }
        }
    });
    
    mediaForm.addEventListener('submit', handleMediaUpload);
    
    // Campaign modal
    const campaignModal = document.getElementById('campaign-modal');
    const campaignForm = document.getElementById('campaign-form');
    const createCampaignBtn = document.getElementById('create-newsletter-btn');
    const closeCampaignModalBtns = campaignModal.querySelectorAll('.close-modal, .cancel-btn');
    
    createCampaignBtn.addEventListener('click', () => {
        campaignModal.style.display = 'block';
        campaignForm.reset();
    });
    
    closeCampaignModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            campaignModal.style.display = 'none';
        });
    });
    
    campaignForm.addEventListener('submit', handleCampaignSubmission);
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === userModal) {
            userModal.style.display = 'none';
        } else if (e.target === mediaModal) {
            mediaModal.style.display = 'none';
        } else if (e.target === campaignModal) {
            campaignModal.style.display = 'none';
        }
    });
    
    // Settings form
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    saveSettingsBtn.addEventListener('click', saveSettings);
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load all required data for the dashboard
        const promises = [
            loadUserStats(),
            loadPostStats(),
            loadViewStats(),
            loadSubscriberStats(),
            loadRecentActivity()
        ];
        
        await Promise.all(promises);
        
        // Load data for the active section
        const activeSection = document.querySelector('.admin-section.active');
        if (activeSection) {
            loadSectionData(activeSection.id);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading dashboard data. Please try again.', 'error');
    }
}

// Load user statistics
async function loadUserStats() {
    try {
        const userStatsElement = document.getElementById('total-users');
        
        // Get total user count
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        
        userStatsElement.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading user stats:', error);
        const userStatsElement = document.getElementById('total-users');
        userStatsElement.textContent = 'Error';
    }
}

// Load post statistics
async function loadPostStats() {
    try {
        const postStatsElement = document.getElementById('total-posts');
        
        // Get count of both featured and news posts
        const featuredQuery = query(collection(db, "featured_posts"));
        const newsQuery = query(collection(db, "news_posts"));
        
        const [featuredSnapshot, newsSnapshot] = await Promise.all([
            getDocs(featuredQuery),
            getDocs(newsQuery)
        ]);
        
        const totalPosts = featuredSnapshot.size + newsSnapshot.size;
        postStatsElement.textContent = totalPosts;
    } catch (error) {
        console.error('Error loading post stats:', error);
        const postStatsElement = document.getElementById('total-posts');
        postStatsElement.textContent = 'Error';
    }
}

// Load view statistics
async function loadViewStats() {
    try {
        const viewStatsElement = document.getElementById('total-views');
        
        // Get sum of views from both featured and news posts
        const featuredQuery = query(collection(db, "featured_posts"));
        const newsQuery = query(collection(db, "news_posts"));
        
        const [featuredSnapshot, newsSnapshot] = await Promise.all([
            getDocs(featuredQuery),
            getDocs(newsQuery)
        ]);
        
        let totalViews = 0;
        
        // Sum views from featured posts
        featuredSnapshot.forEach(doc => {
            totalViews += doc.data().views || 0;
        });
        
        // Sum views from news posts
        newsSnapshot.forEach(doc => {
            totalViews += doc.data().views || 0;
        });
        
        viewStatsElement.textContent = totalViews.toLocaleString();
    } catch (error) {
        console.error('Error loading view stats:', error);
        const viewStatsElement = document.getElementById('total-views');
        viewStatsElement.textContent = 'Error';
    }
}

// Load subscriber statistics
async function loadSubscriberStats() {
    try {
        const subscriberStatsElement = document.getElementById('total-subscribers');
        
        // Get count of newsletter subscribers
        const subscribersQuery = query(collection(db, "newsletter_subscribers"));
        const snapshot = await getDocs(subscribersQuery);
        
        subscriberStatsElement.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading subscriber stats:', error);
        const subscriberStatsElement = document.getElementById('total-subscribers');
        subscriberStatsElement.textContent = 'Error';
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const recentActivityElement = document.getElementById('recent-activity');
        
        // Create a combined query for recent activity
        // This is a simplified version - in reality, you might have an activity log collection
        
        // Get recent posts (both featured and news)
        const featuredQuery = query(
            collection(db, "featured_posts"),
            orderBy("createdAt", "desc"),
            limit(3)
        );
        
        const newsQuery = query(
            collection(db, "news_posts"),
            orderBy("createdAt", "desc"),
            limit(3)
        );
        
        const [featuredSnapshot, newsSnapshot] = await Promise.all([
            getDocs(featuredQuery),
            getDocs(newsQuery)
        ]);
        
        // Combine and sort the results
        let activities = [];
        
        featuredSnapshot.forEach(doc => {
            const data = doc.data();
            activities.push({
                id: doc.id,
                type: 'featured_post',
                title: data.title,
                author: data.author || 'Admin',
                timestamp: data.createdAt
            });
        });
        
        newsSnapshot.forEach(doc => {
            const data = doc.data();
            activities.push({
                id: doc.id,
                type: 'news_post',
                title: data.title,
                author: data.author || 'Admin',
                timestamp: data.createdAt
            });
        });
        
        // Sort by timestamp
        activities.sort((a, b) => {
            const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });
        
        // Take only the most recent 5
        activities = activities.slice(0, 5);
        
        // Clear the container
        recentActivityElement.innerHTML = '';
        
        if (activities.length === 0) {
            recentActivityElement.innerHTML = '<p class="empty-message">No recent activity.</p>';
            return;
        }
        
        // Add activity items to the UI
        activities.forEach(activity => {
            const formattedDate = formatDate(activity.timestamp);
            const activityType = activity.type === 'featured_post' ? 'Featured Post' : 'News Post';
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            activityItem.innerHTML = `
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.type === 'featured_post' ? 'fa-star' : 'fa-newspaper'}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-text">
                        <strong>${activity.author}</strong> published a new ${activityType}: 
                        <a href="#" class="activity-link">${activity.title}</a>
                    </p>
                    <span class="activity-time">${formattedDate}</span>
                </div>
            `;
            
            recentActivityElement.appendChild(activityItem);
        });
    } catch (error) {
        console.error('Error loading recent activity:', error);
        const recentActivityElement = document.getElementById('recent-activity');
        recentActivityElement.innerHTML = '<p class="error-message">Error loading recent activity.</p>';
    }
}

// Load section data
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'featured-posts':
            loadFeaturedPosts();
            break;
        case 'news-posts':
            loadNewsPosts();
            break;
        case 'community':
            loadCommunityPosts();
            break;
        case 'users':
            loadUsers();
            break;
        case 'media':
            loadMedia();
            break;
        case 'newsletter':
            // Default tab is subscribers
            loadNewsletterSubscribers();
            break;
        case 'settings':
            loadSettings();
            break;
        default:
            // Dashboard is loaded by default
            break;
    }
}

// Load tab data
function loadTabData(tabId) {
    switch (tabId) {
        case 'subscribers':
            loadNewsletterSubscribers();
            break;
        case 'campaigns':
            loadNewsletterCampaigns();
            break;
        case 'templates':
            loadNewsletterTemplates();
            break;
        default:
            break;
    }
}

// Load featured posts
async function loadFeaturedPosts() {
    try {
        const tableBody = document.querySelector('#featured-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading posts...</div></td></tr>';
        
        // Create query
        const featuredQuery = query(
            collection(db, "featured_posts"),
            orderBy("createdAt", "desc"),
            limit(itemsPerPage)
        );
        
        // Execute query
        const querySnapshot = await getDocs(featuredQuery);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have posts
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6"><p class="empty-message">No featured posts found.</p></td></tr>';
            return;
        }
        
        // Store the last visible document for pagination
        lastVisible.featuredPosts = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Process posts
        querySnapshot.forEach((doc) => {
            const post = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add post to UI
            const row = createFeaturedPostRow(post);
            tableBody.appendChild(row);
        });
        
        // Update pagination
        updatePagination('featured');
    } catch (error) {
        console.error('Error loading featured posts:', error);
        const tableBody = document.querySelector('#featured-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><p class="error-message">Error loading posts. Please try again.</p></td></tr>';
    }
}

// Create featured post row
function createFeaturedPostRow(post) {
    const row = document.createElement('tr');
    row.dataset.id = post.id;
    
    // Format date
    const formattedDate = formatDate(post.createdAt);
    
    // Default image if none
    const imageUrl = post.imageUrl || '/img/featured-placeholder.jpg';
    
    // Create row HTML
    row.innerHTML = `
        <td><img src="${imageUrl}" alt="${post.title}" class="table-thumbnail" onerror="this.src='/img/featured-placeholder.jpg'"></td>
        <td>${post.title}</td>
        <td><span class="category-tag ${post.category || 'general'}">${capitalizeFirstLetter(post.category || 'General')}</span></td>
        <td>${post.views || 0}</td>
        <td>${formattedDate}</td>
        <td>
            <div class="table-actions">
                <button class="btn action-btn view-btn" data-id="${post.id}" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn action-btn edit-btn" data-id="${post.id}" data-type="featured" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn action-btn delete-btn" data-id="${post.id}" data-type="featured" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    
    // Add event listeners
    const viewBtn = row.querySelector('.view-btn');
    const editBtn = row.querySelector('.edit-btn');
    const deleteBtn = row.querySelector('.delete-btn');
    
    viewBtn.addEventListener('click', () => {
        window.open(`article.html?id=${post.id}`, '_blank');
    });
    
    editBtn.addEventListener('click', () => {
        showAddPostModal('featured', post.id);
    });
    
    deleteBtn.addEventListener('click', () => {
        confirmDeletePost('featured', post.id);
    });
    
    return row;
}

// Update pagination
function updatePagination(type) {
    const prevBtn = document.getElementById(`prev-${type}-page`);
    const nextBtn = document.getElementById(`next-${type}-page`);
    const pageInfo = document.getElementById(`${type}-page-info`);
    
    // Update page info
    pageInfo.textContent = `Page ${currentPage[type]} of ?`;
    
    // Update prev button state
    prevBtn.disabled = currentPage[type] === 1;
    
    // Update next button state based on whether there are more items
    nextBtn.disabled = !lastVisible[type];
    
    // Add event listeners
    prevBtn.onclick = () => {
        if (currentPage[type] > 1) {
            // This is a simplification - for a real prev button, 
            // you'd need to store previous page starting points
            currentPage[type]--;
            loadPreviousPage(type);
        }
    };
    
    nextBtn.onclick = () => {
        if (lastVisible[type]) {
            currentPage[type]++;
            loadNextPage(type);
        }
    };
}

// Load next page
// Load next page
async function loadNextPage(type) {
    try {
        let collectionName, tableId;
        
        switch (type) {
            case 'featured':
                collectionName = "featured_posts";
                tableId = "featured-posts-table";
                break;
            case 'news-posts':
                collectionName = "news_posts";
                tableId = "news-posts-table";
                break;
            case 'community':
                collectionName = "community_posts";
                tableId = "community-posts-table";
                break;
            case 'users':
                collectionName = "users";
                tableId = "users-table";
                break;
            default:
                console.error('Invalid type for pagination:', type);
                return;
        }
        
        // Show loading indicator
        const tableBody = document.querySelector(`#${tableId} tbody`);
        tableBody.innerHTML = '<tr><td colspan="6"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading...</div></td></tr>';
        
        // Create query for next page
        const q = query(
            collection(db, collectionName),
            orderBy("createdAt", "desc"),
            startAfter(lastVisible[type]),
            limit(itemsPerPage)
        );
        
        // Execute query
        const querySnapshot = await getDocs(q);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have results
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6"><p class="empty-message">No more items to display.</p></td></tr>';
            lastVisible[type] = null; // No more pages
            updatePagination(type);
            return;
        }
        
        // Update last visible document
        lastVisible[type] = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Process results
        querySnapshot.forEach((doc) => {
            const item = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add item to UI based on type
            let row;
            switch (type) {
                case 'featured':
                    row = createFeaturedPostRow(item);
                    break;
                case 'news-posts':
                    row = createNewsPostRow(item);
                    break;
                case 'community':
                    row = createCommunityPostRow(item);
                    break;
                case 'users':
                    row = createUserRow(item);
                    break;
            }
            
            tableBody.appendChild(row);
        });
        
        // Update pagination
        updatePagination(type);
    } catch (error) {
        console.error(`Error loading next page for ${type}:`, error);
        showToast(`Error loading more items. Please try again.`, 'error');
    }
}

// Load previous page - simplified version
// In a real app, you'd need to store page start points
async function loadPreviousPage(type) {
    // Reset to page 1 and reload
    currentPage[type] = 1;
    lastVisible[type] = null;
    
    // Load appropriate section based on type
    switch (type) {
        case 'featured':
            loadFeaturedPosts();
            break;
        case 'news-posts':
            loadNewsPosts();
            break;
        case 'community':
            loadCommunityPosts();
            break;
        case 'users':
            loadUsers();
            break;
    }
}

// Load news posts
async function loadNewsPosts() {
    try {
        const tableBody = document.querySelector('#news-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading posts...</div></td></tr>';
        
        // Create query
        const newsQuery = query(
            collection(db, "news_posts"),
            orderBy("createdAt", "desc"),
            limit(itemsPerPage)
        );
        
        // Execute query
        const querySnapshot = await getDocs(newsQuery);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have posts
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6"><p class="empty-message">No news posts found.</p></td></tr>';
            return;
        }
        
        // Store the last visible document for pagination
        lastVisible.newsPosts = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Process posts
        querySnapshot.forEach((doc) => {
            const post = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add post to UI
            const row = createNewsPostRow(post);
            tableBody.appendChild(row);
        });
        
        // Update pagination
        updatePagination('news-posts');
    } catch (error) {
        console.error('Error loading news posts:', error);
        const tableBody = document.querySelector('#news-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><p class="error-message">Error loading posts. Please try again.</p></td></tr>';
    }
}

// Create news post row
function createNewsPostRow(post) {
    const row = document.createElement('tr');
    row.dataset.id = post.id;
    
    // Format date
    const formattedDate = formatDate(post.createdAt);
    
    // Default image if none
    const imageUrl = post.imageUrl || '/img/news-placeholder.jpg';
    
    // Create row HTML
    row.innerHTML = `
        <td><img src="${imageUrl}" alt="${post.title}" class="table-thumbnail" onerror="this.src='/img/news-placeholder.jpg'"></td>
        <td>${post.title}</td>
        <td><span class="category-tag ${post.category || 'news'}">${capitalizeFirstLetter(post.category || 'News')}</span></td>
        <td>${post.views || 0}</td>
        <td>${formattedDate}</td>
        <td>
            <div class="table-actions">
                <button class="btn action-btn view-btn" data-id="${post.id}" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn action-btn edit-btn" data-id="${post.id}" data-type="news" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn action-btn delete-btn" data-id="${post.id}" data-type="news" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    
    // Add event listeners
    const viewBtn = row.querySelector('.view-btn');
    const editBtn = row.querySelector('.edit-btn');
    const deleteBtn = row.querySelector('.delete-btn');
    
    viewBtn.addEventListener('click', () => {
        window.open(`news.html?id=${post.id}`, '_blank');
    });
    
    editBtn.addEventListener('click', () => {
        showAddPostModal('news', post.id);
    });
    
    deleteBtn.addEventListener('click', () => {
        confirmDeletePost('news', post.id);
    });
    
    return row;
}

// Load community posts
async function loadCommunityPosts() {
    try {
        const tableBody = document.querySelector('#community-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading community posts...</div></td></tr>';
        
        // Create query
        const communityQuery = query(
            collection(db, "community_posts"),
            orderBy("createdAt", "desc"),
            limit(itemsPerPage)
        );
        
        // Execute query
        const querySnapshot = await getDocs(communityQuery);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have posts
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6"><p class="empty-message">No community posts found.</p></td></tr>';
            return;
        }
        
        // Store the last visible document for pagination
        lastVisible.community = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Process posts
        querySnapshot.forEach((doc) => {
            const post = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add post to UI
            const row = createCommunityPostRow(post);
            tableBody.appendChild(row);
        });
        
        // Update pagination
        updatePagination('community');
    } catch (error) {
        console.error('Error loading community posts:', error);
        const tableBody = document.querySelector('#community-posts-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6"><p class="error-message">Error loading posts. Please try again.</p></td></tr>';
    }
}

// Create community post row
function createCommunityPostRow(post) {
    const row = document.createElement('tr');
    row.dataset.id = post.id;
    
    // Format date
    const formattedDate = formatDate(post.createdAt);
    
    // Default avatar if none
    const avatarUrl = post.userPhoto || '/img/default-avatar.jpg';
    
    // Truncate content if too long
    const truncatedContent = post.content.length > 100 
        ? post.content.substring(0, 100) + '...' 
        : post.content;
    
    // Create row HTML
    row.innerHTML = `
        <td>
            <div class="user-cell">
                <img src="${avatarUrl}" alt="${post.displayName || 'User'}" class="user-avatar-small" onerror="this.src='/img/default-avatar.jpg'">
                <div class="user-info">
                    <div class="username">@${post.username || 'user'}</div>
                    <div class="user-email">${post.displayName || ''}</div>
                </div>
            </div>
        </td>
        <td class="post-content-cell">${truncatedContent}</td>
        <td>${post.likes || 0}</td>
        <td>${post.comments || 0}</td>
        <td>${formattedDate}</td>
        <td>
            <div class="table-actions">
                <button class="btn action-btn view-btn" data-id="${post.id}" title="View"><i class="fas fa-eye"></i></button>
                <button class="btn action-btn flag-btn" data-id="${post.id}" title="Flag"><i class="fas fa-flag"></i></button>
                <button class="btn action-btn delete-btn" data-id="${post.id}" data-type="community" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    
    // Add event listeners
    const viewBtn = row.querySelector('.view-btn');
    const flagBtn = row.querySelector('.flag-btn');
    const deleteBtn = row.querySelector('.delete-btn');
    
    viewBtn.addEventListener('click', () => {
        window.open(`community.html?post=${post.id}`, '_blank');
    });
    
    flagBtn.addEventListener('click', () => {
        toggleFlaggedStatus(post.id);
    });
    
    deleteBtn.addEventListener('click', () => {
        confirmDeleteCommunityPost(post.id);
    });
    
    return row;
}

// Toggle flagged status for community post
async function toggleFlaggedStatus(postId) {
    try {
        const postRef = doc(db, "community_posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
            const currentStatus = postSnap.data().flagged || false;
            
            await updateDoc(postRef, {
                flagged: !currentStatus,
                flaggedBy: currentUser.uid,
                flaggedAt: serverTimestamp()
            });
            
            showToast(`Post ${!currentStatus ? 'flagged' : 'unflagged'} successfully`);
            
            // Reload community posts
            loadCommunityPosts();
        }
    } catch (error) {
        console.error('Error toggling flag status:', error);
        showToast('Error updating post status. Please try again.', 'error');
    }
}

// Confirm delete community post
function confirmDeleteCommunityPost(postId) {
    if (confirm('Are you sure you want to delete this community post? This action cannot be undone.')) {
        deleteCommunityPost(postId);
    }
}

// Delete community post
async function deleteCommunityPost(postId) {
    try {
        await deleteDoc(doc(db, "community_posts", postId));
        
        showToast('Community post deleted successfully');
        
        // Reload community posts
        loadCommunityPosts();
    } catch (error) {
        console.error('Error deleting community post:', error);
        showToast('Error deleting post. Please try again.', 'error');
    }
}

// Load users
async function loadUsers() {
    try {
        const tableBody = document.querySelector('#users-table tbody');
        tableBody.innerHTML = '<tr><td colspan="7"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading users...</div></td></tr>';
        
        // Create query
        const usersQuery = query(
            collection(db, "users"),
            orderBy("createdAt", "desc"),
            limit(itemsPerPage)
        );
        
        // Execute query
        const querySnapshot = await getDocs(usersQuery);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have users
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="7"><p class="empty-message">No users found.</p></td></tr>';
            return;
        }
        
        // Store the last visible document for pagination
        lastVisible.users = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Process users
        querySnapshot.forEach((doc) => {
            const user = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add user to UI
            const row = createUserRow(user);
            tableBody.appendChild(row);
        });
        
        // Update pagination
        updatePagination('users');
    } catch (error) {
        console.error('Error loading users:', error);
        const tableBody = document.querySelector('#users-table tbody');
        tableBody.innerHTML = '<tr><td colspan="7"><p class="error-message">Error loading users. Please try again.</p></td></tr>';
    }
}

// Create user row
function createUserRow(user) {
    const row = document.createElement('tr');
    row.dataset.id = user.id;
    
    // Format date
    const formattedDate = formatDate(user.createdAt);
    
    // Default avatar if none
    const avatarUrl = user.photoURL || '/img/default-avatar.jpg';
    
    // Determine role and status
    const role = user.isAdmin ? 'Admin' : 'User';
    const status = user.disabled ? 'Inactive' : 'Active';
    const statusClass = user.disabled ? 'inactive' : 'active';
    
    // Create row HTML
    row.innerHTML = `
        <td><img src="${avatarUrl}" alt="${user.displayName || 'User'}" class="user-avatar-small" onerror="this.src='/img/default-avatar.jpg'"></td>
        <td>${user.displayName || 'N/A'}</td>
        <td>${user.email || 'N/A'}</td>
        <td><span class="role-badge ${role.toLowerCase()}">${role}</span></td>
        <td>${formattedDate}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>
            <div class="table-actions">
                <button class="btn action-btn edit-user-btn" data-id="${user.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn action-btn toggle-status-btn" data-id="${user.id}" data-status="${status}" title="${user.disabled ? 'Activate' : 'Deactivate'}">
                    <i class="fas ${user.disabled ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                </button>
                <button class="btn action-btn delete-user-btn" data-id="${user.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    
    // Add event listeners
    const editBtn = row.querySelector('.edit-user-btn');
    const toggleBtn = row.querySelector('.toggle-status-btn');
    const deleteBtn = row.querySelector('.delete-user-btn');
    
    editBtn.addEventListener('click', () => {
        showEditUserModal(user.id);
    });
    
    toggleBtn.addEventListener('click', () => {
        toggleUserStatus(user.id, user.disabled);
    });
    
    deleteBtn.addEventListener('click', () => {
        confirmDeleteUser(user.id);
    });
    
    return row;
}

// Show edit user modal
async function showEditUserModal(userId) {
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const passwordGroup = document.getElementById('password-group');
    
    // Reset form
    userForm.reset();
    
    try {
        // Get user data
        const userDoc = await getDoc(doc(db, "users", userId));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Set form fields
            document.getElementById('user-id').value = userId;
            document.getElementById('user-email').value = userData.email || '';
            document.getElementById('user-display-name').value = userData.displayName || '';
            document.getElementById('user-role').value = userData.isAdmin ? 'admin' : 'user';
            
            // Hide password field for editing
            passwordGroup.style.display = 'none';
            
            // Update modal title
            document.getElementById('user-modal-title').textContent = 'Edit User';
            
            // Show modal
            userModal.style.display = 'block';
        } else {
            showToast('User not found', 'error');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data. Please try again.', 'error');
    }
}

// Toggle user status
async function toggleUserStatus(userId, currentStatus) {
    try {
        await updateDoc(doc(db, "users", userId), {
            disabled: !currentStatus
        });
        
        showToast(`User ${currentStatus ? 'activated' : 'deactivated'} successfully`);
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast('Error updating user status. Please try again.', 'error');
    }
}

// Confirm delete user
function confirmDeleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        deleteUser(userId);
    }
}

// Delete user
async function deleteUser(userId) {
    try {
        // In a real app, you would use Firebase Admin SDK to delete the auth user
        // Here we'll just delete the Firestore user document
        await deleteDoc(doc(db, "users", userId));
        
        showToast('User deleted successfully');
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error deleting user. Please try again.', 'error');
    }
}

// Handle user form submission
async function handleUserFormSubmission(e) {
    e.preventDefault();
    
    // Get form data
    const userId = document.getElementById('user-id').value;
    const email = document.getElementById('user-email').value;
    const displayName = document.getElementById('user-display-name').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    
    try {
        if (userId) {
            // Update existing user
            await updateDoc(doc(db, "users", userId), {
                displayName,
                isAdmin: role === 'admin',
                updatedAt: serverTimestamp()
            });
            
            showToast('User updated successfully');
        } else {
            // Create new user
            // In a real app, you would use Firebase Admin SDK to create users
            // Here we'll use client SDK with limitations
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update user profile
            await updateProfile(user, {
                displayName: displayName
            });
            
            // Create user document in Firestore
            await setDoc(doc(db, "users", user.uid), {
                email,
                displayName,
                isAdmin: role === 'admin',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            showToast('User created successfully');
        }
        
        // Hide modal
        document.getElementById('user-modal').style.display = 'none';
        
        // Reload users
        loadUsers();
    } catch (error) {
        console.error('Error saving user:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Load media
async function loadMedia() {
    try {
        const mediaGrid = document.getElementById('media-grid');
        mediaGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading media...</div>';
        
        // List all files from storage
        // Note: In Firebase Storage, there's no built-in pagination
        // For a real app with many files, you'd store metadata in Firestore
        
        // Get references to media folders
        const featuredRef = storageRef(storage, 'featured_images');
        const newsRef = storageRef(storage, 'news_images');
        const placeholdersRef = storageRef(storage, 'placeholders');
        
        // List all items in each folder
        const [featuredList, newsList, placeholdersList] = await Promise.all([
            listAll(featuredRef),
            listAll(newsRef),
            listAll(placeholdersRef)
        ]);
        
        // Combine all items
        const allItems = [];
        
        // Process featured images
        for (const item of featuredList.items) {
            try {
                const url = await getDownloadURL(item);
                allItems.push({
                    name: item.name,
                    url,
                    fullPath: item.fullPath,
                    type: 'featured'
                });
            } catch (error) {
                console.error('Error getting download URL:', error);
            }
        }
        
        // Process news images
        for (const item of newsList.items) {
            try {
                const url = await getDownloadURL(item);
                allItems.push({
                    name: item.name,
                    url,
                    fullPath: item.fullPath,
                    type: 'news'
                });
            } catch (error) {
                console.error('Error getting download URL:', error);
            }
        }
        
        // Process placeholder images
        for (const item of placeholdersList.items) {
            try {
                const url = await getDownloadURL(item);
                allItems.push({
                    name: item.name,
                    url,
                    fullPath: item.fullPath,
                    type: 'placeholder'
                });
            } catch (error) {
                console.error('Error getting download URL:', error);
            }
        }
        
        // Clear loading indicator
        mediaGrid.innerHTML = '';
        
        // Check if we have media
        if (allItems.length === 0) {
            mediaGrid.innerHTML = '<p class="empty-message">No media found. Use the upload button to add media.</p>';
            return;
        }
        
        // Display media items
        allItems.forEach(item => {
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            mediaItem.dataset.path = item.fullPath;
            
            mediaItem.innerHTML = `
                <div class="media-preview">
                    <img src="${item.url}" alt="${item.name}" onerror="this.src='/img/placeholder-error.jpg'">
                    <div class="media-overlay">
                        <button class="btn media-btn copy-btn" data-url="${item.url}" title="Copy URL"><i class="fas fa-copy"></i></button>
                        <button class="btn media-btn delete-media-btn" data-path="${item.fullPath}" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="media-info">
                    <div class="media-name">${item.name}</div>
                    <div class="media-type">${capitalizeFirstLetter(item.type)}</div>
                </div>
            `;
            
            mediaGrid.appendChild(mediaItem);
            
            // Add event listeners
            const copyBtn = mediaItem.querySelector('.copy-btn');
            const deleteBtn = mediaItem.querySelector('.delete-media-btn');
            
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(item.url)
                    .then(() => {
                        showToast('URL copied to clipboard!');
                    })
                    .catch(err => {
                        console.error('Error copying URL:', err);
                        showToast('Error copying URL', 'error');
                    });
            });
            
            deleteBtn.addEventListener('click', () => {
                confirmDeleteMedia(item.fullPath);
            });
        });
    } catch (error) {
        console.error('Error loading media:', error);
        const mediaGrid = document.getElementById('media-grid');
        mediaGrid.innerHTML = '<p class="error-message">Error loading media. Please try again.</p>';
    }
}

// Confirm delete media
function confirmDeleteMedia(path) {
    if (confirm('Are you sure you want to delete this media? This may break posts that use it.')) {
        deleteMedia(path);
    }
}

// Delete media
async function deleteMedia(path) {
    try {
        const fileRef = storageRef(storage, path);
        await deleteObject(fileRef);
        
        showToast('Media deleted successfully');
        
        // Reload media
        loadMedia();
    } catch (error) {
        console.error('Error deleting media:', error);
        showToast('Error deleting media. Please try again.', 'error');
    }
}

// Handle media upload
async function handleMediaUpload(e) {
    e.preventDefault();
    
    // Get files
    const files = document.getElementById('media-upload').files;
    const category = document.getElementById('media-category').value;
    
    if (files.length === 0) {
        showToast('Please select at least one file to upload', 'error');
        return;
    }
    
    // Determine folder based on category
    let folder = category === 'featured' ? 'featured_images' :
                category === 'news' ? 'news_images' :
                category === 'placeholder' ? 'placeholders' : 'general';
    
    // Upload button
    const uploadBtn = e.target.querySelector('.upload-btn');
    const originalBtnText = uploadBtn.textContent;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    
    // Create a container for upload progress
    const modalBody = document.querySelector('#media-modal .modal-body');
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress-container';
    modalBody.appendChild(progressContainer);
    
    try {
        // Upload each file
        const uploadPromises = Array.from(files).map(file => {
            return uploadMediaFile(file, folder, progressContainer);
        });
        
        await Promise.all(uploadPromises);
        
        showToast('Files uploaded successfully');
        
        // Hide modal
        document.getElementById('media-modal').style.display = 'none';
        
        // Reload media
        loadMedia();
    } catch (error) {
        console.error('Error uploading files:', error);
        showToast('Error uploading files. Please try again.', 'error');
    } finally {
        // Reset button state
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalBtnText;
        
        // Remove progress container after a delay
        setTimeout(() => {
            progressContainer.remove();
        }, 2000);
    }
}

// Upload a single media file with progress
async function uploadMediaFile(file, folder, progressContainer) {
    return new Promise((resolve, reject) => {
        try {
            // Create a unique filename
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const path = `${folder}/${fileName}`;
            const fileRef = storageRef(storage, path);
            
            // Create progress item
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            progressItem.innerHTML = `
                <div class="progress-info">
                    <span class="filename">${file.name}</span>
                    <span class="progress-percent">0%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
            `;
            progressContainer.appendChild(progressItem);
            
            const progressBar = progressItem.querySelector('.progress-bar');
            const progressPercent = progressItem.querySelector('.progress-percent');
            
            // Start upload with progress tracking
            const uploadTask = uploadBytesResumable(fileRef, file);
            
            // Listen for state changes and progress
            uploadTask.on('state_changed', 
                // Progress observer
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressPercent.textContent = `${Math.round(progress)}%`;
                }, 
                // Error observer
                (error) => {
                    console.error('Upload error:', error);
                    progressItem.classList.add('error');
                    progressPercent.textContent = 'Error';
                    reject(error);
                }, 
                // Completion observer
                async () => {
                    progressItem.classList.add('complete');
                    progressBar.style.backgroundColor = '#4caf50';
                    progressPercent.textContent = 'Done';
                    
                    try {
                        // Get download URL
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    } catch (error) {
                        console.error('Error getting download URL:', error);
                        reject(error);
                    }
                }
            );
        } catch (error) {
            console.error('Upload error:', error);
            reject(error);
        }
    });
}

// Load newsletter subscribers
async function loadNewsletterSubscribers() {
    try {
        const tableBody = document.querySelector('#subscribers-table tbody');
        tableBody.innerHTML = '<tr><td colspan="5"><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading subscribers...</div></td></tr>';
        
        // Create query
        const subscribersQuery = query(
            collection(db, "newsletter_subscribers"),
            orderBy("subscribedAt", "desc")
        );
        
        // Execute query
        const querySnapshot = await getDocs(subscribersQuery);
        
        // Clear loading indicator
        tableBody.innerHTML = '';
        
        // Check if we have subscribers
        if (querySnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5"><p class="empty-message">No subscribers found.</p></td></tr>';
            return;
        }
        
        // Process subscribers
        querySnapshot.forEach((doc) => {
            const subscriber = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add subscriber to UI
            const row = createSubscriberRow(subscriber);
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading subscribers:', error);
        const tableBody = document.querySelector('#subscribers-table tbody');
        tableBody.innerHTML = '<tr><td colspan="5"><p class="error-message">Error loading subscribers. Please try again.</p></td></tr>';
    }
}

// Create subscriber row
function createSubscriberRow(subscriber) {
    const row = document.createElement('tr');
    row.dataset.id = subscriber.id;
    
    // Format date
    const formattedDate = formatDate(subscriber.subscribedAt);
    
    // Status
    const status = subscriber.unsubscribed ? 'Unsubscribed' : 'Active';
    const statusClass = subscriber.unsubscribed ? 'inactive' : 'active';
    
    // Create row HTML
    row.innerHTML = `
        <td><input type="checkbox" class="subscriber-checkbox" data-id="${subscriber.id}"></td>
        <td>${subscriber.email}</td>
        <td>${formattedDate}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>
            <div class="table-actions">
                <button class="btn action-btn toggle-subscriber-btn" data-id="${subscriber.id}" title="${subscriber.unsubscribed ? 'Resubscribe' : 'Unsubscribe'}">
                    <i class="fas ${subscriber.unsubscribed ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                </button>
                <button class="btn action-btn delete-subscriber-btn" data-id="${subscriber.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </td>
    `;
    
    // Add event listeners
    const toggleBtn = row.querySelector('.toggle-subscriber-btn');
    const deleteBtn = row.querySelector('.delete-subscriber-btn');
    
    toggleBtn.addEventListener('click', () => {
        toggleSubscriberStatus(subscriber.id, subscriber.unsubscribed);
    });
    
    deleteBtn.addEventListener('click', () => {
        confirmDeleteSubscriber(subscriber.id);
    });
    
    return row;
}

// Toggle subscriber status
async function toggleSubscriberStatus(subscriberId, currentStatus) {
    try {
        await updateDoc(doc(db, "newsletter_subscribers", subscriberId), {
            unsubscribed: !currentStatus,
            updatedAt: serverTimestamp()
        });
        
        showToast(`Subscriber ${currentStatus ? 'resubscribed' : 'unsubscribed'} successfully`);
        
        // Reload subscribers
        loadNewsletterSubscribers();
    } catch (error) {
        console.error('Error toggling subscriber status:', error);
        showToast('Error updating subscriber status. Please try again.', 'error');
    }
}

// Confirm delete subscriber
function confirmDeleteSubscriber(subscriberId) {
    if (confirm('Are you sure you want to delete this subscriber? This action cannot be undone.')) {
        deleteSubscriber(subscriberId);
    }
}

// Delete subscriber
async function deleteSubscriber(subscriberId) {
    try {
        await deleteDoc(doc(db, "newsletter_subscribers", subscriberId));
        
        showToast('Subscriber deleted successfully');
        
        // Reload subscribers
        loadNewsletterSubscribers();
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        showToast('Error deleting subscriber. Please try again.', 'error');
    }
}

// Load newsletter campaigns (placeholder)
async function loadNewsletterCampaigns() {
    const campaignsTable = document.querySelector('#campaigns-table tbody');
    campaignsTable.innerHTML = '<tr><td colspan="7"><p class="empty-message">No campaigns available. Use the Create Campaign button to start sending newsletters.</p></td></tr>';
}

// Load newsletter templates (placeholder)
async function loadNewsletterTemplates() {
    const templatesGrid = document.querySelector('#templates-grid');
    templatesGrid.innerHTML = '';
    
    // Sample templates
    const templates = [
        { id: 'template1', name: 'Monthly Newsletter', thumbnail: '/img/template-monthly.jpg' },
        { id: 'template2', name: 'New Post Alert', thumbnail: '/img/template-post.jpg' },
        { id: 'template3', name: 'Special Announcement', thumbnail: '/img/template-announcement.jpg' }
    ];
    
    templates.forEach(template => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.dataset.id = template.id;
        
        templateItem.innerHTML = `
            <div class="template-preview">
                <img src="${template.thumbnail}" alt="${template.name}" onerror="this.src='/img/template-placeholder.jpg'">
            </div>
            <div class="template-info">
                <div class="template-name">${template.name}</div>
                <button class="btn use-template-btn" data-id="${template.id}">Use Template</button>
            </div>
        `;
        
        templatesGrid.appendChild(templateItem);
        
        // Add event listener
        const useTemplateBtn = templateItem.querySelector('.use-template-btn');
        useTemplateBtn.addEventListener('click', () => {
            // Create a new campaign with this template
            document.getElementById('create-newsletter-btn').click();
            document.getElementById('campaign-template').value = template.id;
        });
    });
}

// Handle campaign submission (placeholder)
async function handleCampaignSubmission(e) {
    e.preventDefault();
    
    showToast('Campaign creation not implemented in this demo');
    
    // Hide modal
    document.getElementById('campaign-modal').style.display = 'none';
}

// Load settings (placeholder)
async function loadSettings() {
    // In a real app, you would load settings from Firestore
    console.log('Settings loaded');
}

// Save settings (placeholder)
async function saveSettings() {
    // In a real app, you would save settings to Firestore
    showToast('Settings saved successfully');
}

// Format date helper
function formatDate(dateObj) {
    if (!dateObj) return 'Unknown';

    // Handle Firestore timestamps
    if (dateObj && dateObj.toDate && typeof dateObj.toDate === 'function') {
        dateObj = dateObj.toDate();
    }

    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return dateObj.toLocaleDateString('en-US', options);
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Show toast notification
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// External function from main.js - this would be imported from there
// Show post modal for adding/editing
async function showAddPostModal(type, postId = null) {
    // Implement this function based on your main site's code
    // For brevity, it's not included here
    showToast(`Edit ${type} post functionality is connected to main site's code`);
}

// External function from main.js - this would be imported from there
// Confirm post deletion
function confirmDeletePost(type, postId) {
    if (confirm(`Are you sure you want to delete this ${type} post? This action cannot be undone.`)) {
        deletePost(type, postId);
    }
}

// External function from main.js - this would be imported from there
// Delete post
async function deletePost(type, postId) {
    try {
        const collectionName = type === 'featured' ? 'featured_posts' : 'news_posts';
        
        // Get the post to retrieve the image URL
        const postDoc = await getDoc(doc(db, collectionName, postId));
        if (postDoc.exists()) {
            const post = postDoc.data();
            
            // If post has an image from Firebase Storage, delete it
            if (post.imageUrl && post.imageUrl.includes('firebasestorage')) {
                try {
                    // Extract the path from the URL
                    const imagePath = post.imageUrl.split('?')[0].split('/o/')[1].replace(/%2F/g, '/');
                    const imageRef = storageRef(storage, decodeURIComponent(imagePath));
                    await deleteObject(imageRef);
                } catch (deleteError) {
                    console.error('Error deleting image:', deleteError);
                    // Continue with post deletion even if image deletion fails
                }
            }
        }

        // Delete post from Firestore
        await deleteDoc(doc(db, collectionName, postId));

        showToast('Post deleted successfully');

        // Reload content
        if (type === 'featured') {
            loadFeaturedPosts();
        } else {
            loadNewsPosts();
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Error deleting post. Please try again.', 'error');
    }
}
// profile.js
import { auth, storage } from './firebase-config.js';
import { getUserProfile, updateUserProfile } from './auth.js';
import { getSavedArticles, getArticlesByUser, getPostsByUser } from './api/profile-api.js';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Initialize profile page
            initializeProfilePage();
            
            // Load user data
            await loadUserProfile(user.uid);
        } else {
            // Redirect to login
            window.location.href = 'login.html?redirect=profile';
        }
    });
});

async function loadUserProfile(userId) {
    try {
        // Show loading state
        const profileContainer = document.querySelector('.profile-content');
        if (profileContainer) {
            profileContainer.innerHTML = '<div class="loading-spinner"></div>';
        }
        
        // Get user profile data
        const profileData = await getUserProfile(userId);
        
        // Render profile info
        renderProfileInfo(profileData);
        
        // Load saved articles
        await loadSavedArticles(userId);
        
        // Load user's articles
        await loadUserArticles(userId);
        
        // Load user's posts
        await loadUserPosts(userId);
    } catch (error) {
        console.error("Error loading profile:", error);
        showError("Error loading profile data. Please try again later.");
    }
}

// Render user profile information
function renderProfileInfo(profile) {
    const profileInfoContainer = document.querySelector('.profile-info');
    if (!profileInfoContainer) return;
    
    profileInfoContainer.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">
                <img src="${profile.profilePicture || '/img/default-avatar.png'}" alt="${profile.username}">
                <button class="change-avatar-btn"><i class="fas fa-camera"></i></button>
                <input type="file" id="avatar-upload" accept="image/*" style="display:none">
            </div>
            <div class="profile-details">
                <h1>${profile.username}</h1>
                <p class="join-date">Member since ${formatDate(profile.createdAt.toDate())}</p>
                <p class="bio">${profile.bio || 'No bio provided yet.'}</p>
                <button class="edit-profile-btn">Edit Profile</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const changeAvatarBtn = document.querySelector('.change-avatar-btn');
    const avatarUpload = document.querySelector('#avatar-upload');
    const editProfileBtn = document.querySelector('.edit-profile-btn');
    
    changeAvatarBtn.addEventListener('click', () => {
        avatarUpload.click();
    });
    
    avatarUpload.addEventListener('change', handleAvatarUpload);
    
    editProfileBtn.addEventListener('click', showEditProfileForm);
}

// Handle avatar upload
async function handleAvatarUpload(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please select an image file');
            return;
        }
        
        // Show loading state
        const avatar = document.querySelector('.profile-avatar img');
        const originalSrc = avatar.src;
        avatar.src = '/img/loading-avatar.gif'; // Replace with actual loading image
        
        const user = auth.currentUser;
        
        // Upload to Firebase Storage
        const storageRef = ref(storage, `profile_pictures/${user.uid}/avatar`);
        await uploadBytes(storageRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // Update profile in Firestore
        await updateUserProfile(user.uid, {
            profilePicture: downloadURL
        });
        
        // Update avatar in UI
        avatar.src = downloadURL;
        
    } catch (error) {
        console.error("Error uploading avatar:", error);
        alert("Error uploading avatar. Please try again.");
        
        // Reset avatar to original
        const avatar = document.querySelector('.profile-avatar img');
        avatar.src = originalSrc;
    }
}

// Show edit profile form
function showEditProfileForm() {
    const profileDetails = document.querySelector('.profile-details');
    const currentUsername = profileDetails.querySelector('h1').textContent;
    const currentBio = profileDetails.querySelector('.bio').textContent;
    
    // Create form HTML
    const formHTML = `
        <h2>Edit Profile</h2>
        <form class="edit-profile-form">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" value="${currentUsername}" required>
            </div>
            <div class="form-group">
                <label for="bio">Bio</label>
                <textarea id="bio" name="bio" rows="4">${currentBio === 'No bio provided yet.' ? '' : currentBio}</textarea>
            </div>
            <div class="form-buttons">
                <button type="button" class="cancel-btn">Cancel</button>
                <button type="submit" class="save-btn">Save Changes</button>
            </div>
        </form>
    `;
    
    // Replace profile details with form
    profileDetails.innerHTML = formHTML;
    
    // Add event listeners
    const form = document.querySelector('.edit-profile-form');
    const cancelBtn = document.querySelector('.cancel-btn');
    
    form.addEventListener('submit', handleProfileUpdate);
    
    cancelBtn.addEventListener('click', () => {
        // Get user profile again to restore original view
        const user = auth.currentUser;
        if (user) {
            loadUserProfile(user.uid);
        }
    });
}

// Handle profile update
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    try {
        const usernameInput = document.querySelector('#username');
        const bioInput = document.querySelector('#bio');
        
        const username = usernameInput.value.trim();
        const bio = bioInput.value.trim();
        
        if (!username) {
            alert('Username cannot be empty');
            return;
        }
        
        // Show loading state
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;
        
        const user = auth.currentUser;
        
        // Update profile in Firestore
        await updateUserProfile(user.uid, {
            username,
            bio
        });
        
        // Reload profile
        await loadUserProfile(user.uid);
        
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Error updating profile. Please try again.");
        
        // Reset button
        const saveBtn = document.querySelector('.save-btn');
        saveBtn.textContent = 'Save Changes';
        saveBtn.disabled = false;
    }
}

// Load saved articles
async function loadSavedArticles(userId) {
    try {
        const savedArticles = await getSavedArticles(userId);
        const savedContainer = document.querySelector('#saved-articles');
        
        if (!savedContainer) return;
        
        // Clear container
        savedContainer.innerHTML = '';
        
        // If no saved articles
        if (savedArticles.length === 0) {
            savedContainer.innerHTML = '<p class="no-content">You have no saved articles yet.</p>';
            return;
        }
        
        // Create list of saved articles
        const savedList = document.createElement('div');
        savedList.className = 'saved-articles-list';
        
        savedArticles.forEach(article => {
            const articleItem = document.createElement('div');
            articleItem.className = 'saved-article';
            
            articleItem.innerHTML = `
                <div class="article-image">
                    <img src="${article.featured_image}" alt="${article.title}">
                </div>
                <div class="article-info">
                    <h3><a href="article.html?id=${article.id}">${article.title}</a></h3>
                    <div class="article-meta">
                        <span class="category">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</span>
                        <span class="date">${formatDate(article.publishDate.toDate())}</span>
                    </div>
                </div>
                <button class="remove-saved" data-article-id="${article.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            savedList.appendChild(articleItem);
        });
        
        savedContainer.appendChild(savedList);
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-saved').forEach(button => {
            button.addEventListener('click', handleRemoveSaved);
        });
        
        // Update saved count in tab
        const savedCount = document.querySelector('.saved-count');
        if (savedCount) {
            savedCount.textContent = savedArticles.length;
        }
    } catch (error) {
        console.error("Error loading saved articles:", error);
        
        const savedContainer = document.querySelector('#saved-articles');
        if (savedContainer) {
            savedContainer.innerHTML = '<p class="error-message">Error loading saved articles.</p>';
        }
    }
}

// Handle removing saved article
async function handleRemoveSaved(e) {
    try {
        const articleId = e.target.closest('.remove-saved').dataset.articleId;
        const user = auth.currentUser;
        
        if (!user) return;
        
        // Show removing animation
        const articleItem = e.target.closest('.saved-article');
        articleItem.classList.add('removing');
        
        // Update in Firestore
        await updateUserProfile(user.uid, {
            savedArticles: arrayRemove(articleId)
        });
        
        // Remove from UI after animation completes
        setTimeout(() => {
            articleItem.remove();
            
            // Check if list is now empty
            const savedList = document.querySelector('.saved-articles-list');
            if (savedList && savedList.children.length === 0) {
                document.querySelector('#saved-articles').innerHTML = 
                    '<p class="no-content">You have no saved articles yet.</p>';
            }
            
            // Update saved count in tab
            const savedCount = document.querySelector('.saved-count');
            if (savedCount) {
                const currentCount = parseInt(savedCount.textContent);
                savedCount.textContent = currentCount - 1;
            }
        }, 300);
    } catch (error) {
        console.error("Error removing saved article:", error);
        alert("Error removing article. Please try again.");
        
        // Remove animation class to restore item
        e.target.closest('.saved-article').classList.remove('removing');
    }
}

// Format date helper
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show error message
function showError(message) {
    const profileContainer = document.querySelector('.profile-content');
    if (profileContainer) {
        profileContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

// Load user's articles
async function loadUserArticles(userId) {
    try {
        const articles = await getArticlesByUser(userId);
        const articlesContainer = document.querySelector('#user-articles');
        
        if (!articlesContainer) return;
        
        // Clear container
        articlesContainer.innerHTML = '';
        
        // If no articles
        if (articles.length === 0) {
            articlesContainer.innerHTML = '<p class="no-content">You haven\'t published any articles yet.</p>';
            return;
        }
        
        // Create articles grid
        const articlesGrid = document.createElement('div');
        articlesGrid.className = 'user-articles-grid';
        
        articles.forEach(article => {
            const articleCard = document.createElement('article');
            articleCard.className = 'article-card';
            
            articleCard.innerHTML = `
                <div class="article-image">
                    <img src="${article.featured_image}" alt="${article.title}">
                    <span class="category-tag ${article.category}">${article.category.charAt(0).toUpperCase() + article.category.slice(1)}</span>
                </div>
                <div class="article-content">
                    <h3>${article.title}</h3>
                    <p class="excerpt">${article.excerpt}</p>
                    <div class="article-meta">
                        <span class="date">${formatDate(article.publishDate.toDate())}</span>
                        <span class="views"><i class="fas fa-eye"></i> ${article.views}</span>
                    </div>
                    <a href="article.html?id=${article.id}" class="read-more">Read</a>
                </div>
            `;
            
            articlesGrid.appendChild(articleCard);
        });
        
        articlesContainer.appendChild(articlesGrid);
    } catch (error) {
        console.error("Error loading user articles:", error);
        
        const articlesContainer = document.querySelector('#user-articles');
        if (articlesContainer) {
            articlesContainer.innerHTML = '<p class="error-message">Error loading your articles.</p>';
        }
    }
}

// Load user's community posts
async function loadUserPosts(userId) {
    try {
        const posts = await getPostsByUser(userId);
        const postsContainer = document.querySelector('#user-posts');
        
        if (!postsContainer) return;
        
        // Clear container
        postsContainer.innerHTML = '';
        
        // If no posts
        if (posts.length === 0) {
            postsContainer.innerHTML = '<p class="no-content">You haven\'t created any community posts yet.</p>';
            return;
        }
        
        // Create posts container
        const postsGrid = document.createElement('div');
        postsGrid.className = 'user-posts-container';
        
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'community-post';
            postElement.dataset.id = post.id;
            
            // Format date
            const postDate = formatDate(post.createdAt);
            
            postElement.innerHTML = `
                <div class="post-header">
                    <img src="${post.userAvatar || '/img/default-avatar.png'}" alt="${post.username}" class="user-avatar">
                    <div class="post-info">
                        <h3 class="username">@${post.username}</h3>
                        <span class="post-time">${postDate}</span>
                    </div>
                </div>
                <div class="post-content">
                    <p>${post.content}</p>
                    ${post.images && post.images.length > 0 ?
                        `<div class="post-images">
                            ${post.images.map(img => `<img src="${img}" alt="Post image">`).join('')}
                        </div>` : ''}
                </div>
                <div class="post-actions">
                    <button class="like-btn ${post.likes.includes(userId) ? 'active' : ''}">
                        <i class="${post.likes.includes(userId) ? 'fas' : 'far'} fa-heart"></i> ${post.likes.length}
                    </button>
                    <button class="comment-btn">
                        <i class="fas fa-comment"></i> ${post.commentCount || 0}
                    </button>
                    <button class="edit-post-btn" data-post-id="${post.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-post-btn" data-post-id="${post.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            
            postsGrid.appendChild(postElement);
        });
        
        postsContainer.appendChild(postsGrid);
        
        // Add event listeners
        document.querySelectorAll('.edit-post-btn').forEach(button => {
            button.addEventListener('click', handleEditPost);
        });
        
        document.querySelectorAll('.delete-post-btn').forEach(button => {
            button.addEventListener('click', handleDeletePost);
        });
    } catch (error) {
        console.error("Error loading user posts:", error);
        
        const postsContainer = document.querySelector('#user-posts');
        if (postsContainer) {
            postsContainer.innerHTML = '<p class="error-message">Error loading your community posts.</p>';
        }
    }
}

// Handle edit post
function handleEditPost(e) {
    const postId = e.target.closest('.edit-post-btn').dataset.postId;
    const postElement = e.target.closest('.community-post');
    const postContent = postElement.querySelector('.post-content p').textContent;
    
    // Replace post content with edit form
    const contentContainer = postElement.querySelector('.post-content');
    const originalContent = contentContainer.innerHTML;
    
    contentContainer.innerHTML = `
        <textarea class="edit-post-textarea">${postContent}</textarea>
        <div class="edit-actions">
            <button class="cancel-edit-btn">Cancel</button>
            <button class="save-edit-btn">Save Changes</button>
        </div>
    `;
    
    // Focus textarea
    contentContainer.querySelector('textarea').focus();
    
    // Add event listeners
    const cancelBtn = contentContainer.querySelector('.cancel-edit-btn');
    const saveBtn = contentContainer.querySelector('.save-edit-btn');
    
    cancelBtn.addEventListener('click', () => {
        // Restore original content
        contentContainer.innerHTML = originalContent;
    });
    
    saveBtn.addEventListener('click', async () => {
        const newContent = contentContainer.querySelector('textarea').value.trim();
        
        if (!newContent) return;
        
        try {
            // Show loading state
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
            
            // Update post in Firestore
            await updatePost(postId, { content: newContent });
            
            // Update UI
            contentContainer.innerHTML = `
                <p>${newContent}</p>
                ${originalContent.includes('post-images') ? 
                    originalContent.substring(originalContent.indexOf('<div class="post-images">')) : ''}
            `;
        } catch (error) {
            console.error("Error updating post:", error);
            alert("Error updating post. Please try again.");
            
            // Reset button
            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }
    });
}

// Handle delete post
async function handleDeletePost(e) {
    const postId = e.target.closest('.delete-post-btn').dataset.postId;
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Show deleting animation
        const postElement = e.target.closest('.community-post');
        postElement.classList.add('deleting');
        
        // Delete post from Firestore
        await deletePost(postId);
        
        // Remove from UI after animation completes
        setTimeout(() => {
            postElement.remove();
            
            // Check if container is now empty
            const postsGrid = document.querySelector('.user-posts-container');
            if (postsGrid && postsGrid.children.length === 0) {
                document.querySelector('#user-posts').innerHTML = 
                    '<p class="no-content">You haven\'t created any community posts yet.</p>';
            }
        }, 300);
    } catch (error) {
        console.error("Error deleting post:", error);
        alert("Error deleting post. Please try again.");
        
        // Remove animation class
        e.target.closest('.community-post').classList.remove('deleting');
    }
}
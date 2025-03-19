// Import Firebase services
import { auth, db, storage } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    doc,
    query, 
    where, 
    orderBy, 
    limit,
    startAfter,
    deleteDoc,
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Elements
const postForm = document.getElementById('post-form');
const postTextarea = document.getElementById('post-textarea');
const postAttachmentInput = document.getElementById('post-attachment');
const attachmentPreview = document.getElementById('attachment-preview');
const communityPosts = document.querySelector('.community-posts');
const loadMoreBtn = document.getElementById('load-more-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const sortButton = document.querySelector('.sort-btn');
const photoButton = document.querySelector('.photo-btn');
const videoButton = document.querySelector('.video-btn');
const linkButton = document.querySelector('.link-btn');
const tagButton = document.querySelector('.tag-btn');
const sortOptions = document.querySelector('.sort-options');

// State variables
let currentUser = null;
let lastVisible = null;
let isLoading = false;
let currentFilter = 'all';
let currentSort = 'newest';
let postLimit = 10;
let isLoggedIn = false;
let attachmentFile = null;
let attachmentType = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("Community.js loaded");
    
    // Initialize UI components
    initUI();
    
    // Check authentication state
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.email : "not logged in");
        currentUser = user;
        isLoggedIn = !!user;
        
        // Update post form based on auth state
        updatePostFormVisibility();
        
        // Load posts from Firestore
        loadPosts();
    });
});

// Initialize UI components
function initUI() {
    console.log("Initializing UI components");
    
    // Handle sort dropdown
    if (sortButton) {
        sortButton.addEventListener('click', () => {
            sortOptions.classList.toggle('active');
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sort-dropdown') && sortOptions.classList.contains('active')) {
                sortOptions.classList.remove('active');
            }
        });
    }
    
    // Set up sort options
    const sortOptionElements = document.querySelectorAll('.sort-option');
    sortOptionElements.forEach(option => {
        option.addEventListener('click', () => {
            document.getElementById('current-sort').textContent = option.textContent.trim();
            currentSort = option.dataset.sort;
            sortOptions.classList.remove('active');
            
            // Reload posts
            loadPosts();
        });
    });
    
    // Set up filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter || 'all';
            
            // Reload posts
            loadPosts();
        });
    });
    
    // Set up post form
    if (postForm) {
        postForm.addEventListener('submit', handlePostSubmission);
    }
    
    // Set up attachment buttons
    if (photoButton) {
        photoButton.addEventListener('click', () => {
            showToast("Photo upload feature is coming soon!");
        });
    }
    
    if (videoButton) {
        videoButton.addEventListener('click', () => {
            showToast("Video upload feature is coming soon!");
        });
    }
    
    if (linkButton) {
        linkButton.addEventListener('click', () => {
            showToast("Link sharing feature is coming soon!");
        });
    }
    
    if (tagButton) {
        tagButton.addEventListener('click', () => {
            const content = postTextarea.value;
            postTextarea.value = content + " #trendsvirals";
            postTextarea.focus();
        });
    }
    
    // Set up load more button
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMorePosts);
    }
}

// Update post form visibility based on auth state
function updatePostFormVisibility() {
    console.log("Updating post form visibility");
    
    const loginTease = document.getElementById('login-tease');
    const postFormContainer = document.querySelector('.post-creation-container');
    
    if (isLoggedIn) {
        if (loginTease) loginTease.style.display = 'none';
        if (postFormContainer) postFormContainer.style.display = 'block';
    } else {
        if (loginTease) loginTease.style.display = 'block';
        if (postFormContainer) postFormContainer.style.display = 'none';
    }
}

// Handle post submission
async function handlePostSubmission(e) {
    e.preventDefault();
    
    if (!isLoggedIn) {
        window.location.href = 'login.html?redirect=community.html';
        return;
    }
    
    const postContent = postTextarea.value.trim();
    if (!postContent) {
        showToast('Please enter something to post', 'error');
        return;
    }
    
    // Show saving indicator
    const submitBtn = postForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        // Extract hashtags
        const hashtags = extractHashtags(postContent);
        
        // Create post data with user info
        const newPost = {
            content: postContent,
            userId: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            username: getUsernameFromEmail(currentUser.email),
            userPhoto: currentUser.photoURL || 'img/default-avatar.png',
            createdAt: serverTimestamp(),
            hashtags: hashtags,
            category: detectPostCategory(postContent, hashtags),
            likes: 0,
            likedBy: [],
            comments: 0,
            shares: 0
        };
        
        // Add post to Firestore
        const docRef = await addDoc(collection(db, "community_posts"), newPost);
        console.log("Post created with ID:", docRef.id);
        
        // Success message
        showToast('Post published successfully!');
        
        // Clear form
        postTextarea.value = '';
        
        // Add post to UI
        const post = {
            id: docRef.id,
            ...newPost,
            createdAt: new Date() // Temporary date until server timestamp resolves
        };
        
        prependNewPost(post);
        
    } catch (error) {
        console.error('Error creating post:', error);
        showToast('Error publishing post. Please try again.', 'error');
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// Load posts from Firestore
async function loadPosts() {
    console.log("Loading posts with filter:", currentFilter, "and sort:", currentSort);
    
    try {
        // Show loading indicator
        communityPosts.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading posts...</div>';
        isLoading = true;
        lastVisible = null;
        
        // Create query based on filters
        let postsQuery;
        
        if (currentFilter === 'all') {
            // Query all posts with ordering
            postsQuery = query(
                collection(db, "community_posts"),
                orderBy("createdAt", "desc"),
                limit(postLimit)
            );
        } else if (currentFilter === 'popular') {
            // Popular posts (with likes)
            postsQuery = query(
                collection(db, "community_posts"),
                orderBy("likes", "desc"),
                limit(postLimit)
            );
        } else {
            // Filter by category
            postsQuery = query(
                collection(db, "community_posts"),
                where("category", "==", currentFilter),
                orderBy("createdAt", "desc"),
                limit(postLimit)
            );
        }
        
        // Execute query
        const querySnapshot = await getDocs(postsQuery);
        console.log("Posts query returned:", querySnapshot.size, "posts");
        
        // Clear loading indicator
        communityPosts.innerHTML = '';
        
        // Check if we have posts
        if (querySnapshot.empty) {
            // No posts found
            communityPosts.innerHTML = `
                <div style="text-align: center; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <i class="fas fa-comment-slash" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3>No posts found</h3>
                    <p>There are no posts in this category yet. Be the first to start a conversation!</p>
                </div>
            `;
            
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        // Process posts
        querySnapshot.forEach((doc) => {
            const postData = {
                id: doc.id,
                ...doc.data()
            };
            
            // Add post to UI
            communityPosts.appendChild(createPostElement(postData));
        });
        
        // Store last visible document for pagination
        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Show/hide load more button
        if (loadMoreBtn) {
            loadMoreBtn.style.display = querySnapshot.size < postLimit ? 'none' : 'block';
        }
        
    } catch (error) {
        console.error('Error loading posts:', error);
        communityPosts.innerHTML = `
            <div style="text-align: center; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 1rem;"></i>
                <h3>Error loading posts</h3>
                <p>There was a problem loading posts: ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #4a6cf7; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Load more posts
async function loadMorePosts() {
    if (isLoading || !lastVisible) return;
    
    isLoading = true;
    loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    loadMoreBtn.disabled = true;
    
    try {
        // Create query based on current parameters
        let postsQuery;
        
        if (currentFilter === 'all') {
            postsQuery = query(
                collection(db, "community_posts"),
                orderBy("createdAt", "desc"),
                startAfter(lastVisible),
                limit(postLimit)
            );
        } else if (currentFilter === 'popular') {
            postsQuery = query(
                collection(db, "community_posts"),
                orderBy("likes", "desc"),
                startAfter(lastVisible),
                limit(postLimit)
            );
        } else {
            postsQuery = query(
                collection(db, "community_posts"),
                where("category", "==", currentFilter),
                orderBy("createdAt", "desc"),
                startAfter(lastVisible),
                limit(postLimit)
            );
        }
        
        const querySnapshot = await getDocs(postsQuery);
        
        if (querySnapshot.empty) {
            loadMoreBtn.style.display = 'none';
            return;
        }
        
        // Add posts to UI
        querySnapshot.forEach((doc) => {
            const postData = {
                id: doc.id,
                ...doc.data()
            };
            communityPosts.appendChild(createPostElement(postData));
        });
        
        // Update last visible document
        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // Hide button if no more posts
        if (querySnapshot.size < postLimit) {
            loadMoreBtn.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading more posts:', error);
        showToast('Error loading more posts. Please try again later.', 'error');
    } finally {
        loadMoreBtn.innerHTML = 'Load More Posts';
        loadMoreBtn.disabled = false;
        isLoading = false;
    }
}

// Create a post element
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'community-post';
    postElement.dataset.id = post.id;
    
    // Format date
    const formattedDate = formatDate(post.createdAt);
    
    // Check if current user is post author
    const isAuthor = currentUser && currentUser.uid === post.userId;
    
    // Check if post is liked by current user
    const isLiked = post.likedBy && currentUser && post.likedBy.includes(currentUser.uid);
    
    // Create post HTML
    let postHTML = `
        <div class="post-header">
            <img src="${post.userPhoto}" alt="${post.displayName}" class="user-avatar" onerror="this.src='img/default-avatar.png'">
            <div class="post-info">
                <h3 class="username">@${post.username}</h3>
                <span class="post-time">${formattedDate}</span>
            </div>
            ${isAuthor ? `
                <div class="post-options">
                    <button class="post-option-btn">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            ` : ''}
        </div>
        <div class="post-content">
            <div class="post-text">${linkHashtags(formatPostContent(post.content))}</div>
    `;
    
    // Add attachment if exists
    if (post.attachmentUrl && post.attachmentType === 'image') {
        postHTML += `<img src="${post.attachmentUrl}" alt="Post Image" class="post-image">`;
    } else if (post.attachmentUrl && post.attachmentType === 'video') {
        postHTML += `
            <video class="post-video" controls>
                <source src="${post.attachmentUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    }
    
    postHTML += `
        </div>
        <div class="post-actions">
            <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                <i class="fas fa-heart"></i> ${post.likes || 0}
            </button>
            <button class="comment-btn" data-post-id="${post.id}">
                <i class="fas fa-comment"></i> ${post.comments || 0}
            </button>
            <button class="share-btn" data-post-id="${post.id}">
                <i class="fas fa-share"></i> Share
            </button>
        </div>
        
        <!-- Comments Section (hidden by default) -->
        <div class="post-comments">
            <div class="comments-container" data-post-id="${post.id}">
                <!-- Comments will be loaded here -->
            </div>
            
            <!-- Comment Form -->
            ${isLoggedIn ? `
                <form class="comment-form" data-post-id="${post.id}">
                    <textarea placeholder="Write a comment..." required></textarea>
                    <button type="submit" class="btn">Post</button>
                </form>
            ` : `
                <div style="text-align: center; padding: 15px; border-top: 1px solid #e0e0e0;">
                    <a href="login.html?redirect=community.html" class="btn">Log in to comment</a>
                </div>
            `}
        </div>
    `;
    
    postElement.innerHTML = postHTML;
    
    // Add event listeners
    const likeBtn = postElement.querySelector('.like-btn');
    const commentBtn = postElement.querySelector('.comment-btn');
    const shareBtn = postElement.querySelector('.share-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => handleLike(post.id, likeBtn));
    }
    
    if (commentBtn) {
        commentBtn.addEventListener('click', () => toggleComments(postElement, post.id));
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => handleShare(post.id));
    }
    
    // Setup post options for author
    if (isAuthor) {
        const optionsBtn = postElement.querySelector('.post-option-btn');
        if (optionsBtn) {
            optionsBtn.addEventListener('click', () => {
                if (confirm("Do you want to delete this post?")) {
                    handleDeletePost(post.id);
                }
            });
        }
    }
    
    // Setup comment form if user is logged in
    const commentForm = postElement.querySelector('.comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleCommentSubmission(e.target, post.id);
        });
    }
    
    return postElement;
}

// Format post content
function formatPostContent(content) {
    if (!content) return '';
    
    // Convert URLs to links
    content = content.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert newlines to <br>
    return content.replace(/\n/g, '<br>');
}

// Prepend a new post to the list
function prependNewPost(post) {
    const postElement = createPostElement(post);
    
    if (communityPosts.firstChild) {
        communityPosts.insertBefore(postElement, communityPosts.firstChild);
    } else {
        communityPosts.appendChild(postElement);
    }
}

// Handle like button click
async function handleLike(postId, button) {
    if (!isLoggedIn) {
        window.location.href = 'login.html?redirect=community.html';
        return;
    }
    
    try {
        // Get post data
        const postRef = doc(db, "community_posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
            const postData = postSnap.data();
            const likedBy = postData.likedBy || [];
            const currentLikes = postData.likes || 0;
            
            // Check if user already liked the post
            const index = likedBy.indexOf(currentUser.uid);
            let newLikes, newLikedBy;
            
            if (index !== -1) {
                // User already liked the post, so unlike it
                newLikedBy = likedBy.filter(id => id !== currentUser.uid);
                newLikes = Math.max(0, currentLikes - 1);
                button.classList.remove('liked');
            } else {
                // User hasn't liked the post, so like it
                newLikedBy = [...likedBy, currentUser.uid];
                newLikes = currentLikes + 1;
                button.classList.add('liked');
            }
            
            // Update like count in UI
            button.innerHTML = `<i class="fas fa-heart"></i> ${newLikes}`;
            
            // Update post in Firestore
            await updateDoc(postRef, {
                likes: newLikes,
                likedBy: newLikedBy
            });
        }
    } catch (error) {
        console.error('Error updating like:', error);
        showToast('Error updating like. Please try again.', 'error');
    }
}

// Toggle comments section - FIXED VERSION
function toggleComments(postElement, postId) {
    console.log("Toggle comments for post:", postId);
    
    const commentsSection = postElement.querySelector('.post-comments');
    const commentsContainer = postElement.querySelector('.comments-container');
    
    // Toggle visibility of comments section
    commentsSection.classList.toggle('active');
    
    // If section is not active after toggle, we're closing it - just return
    if (!commentsSection.classList.contains('active')) {
        return;
    }
    
    // If we're opening AND comments aren't loaded yet, fetch them
    if (!commentsContainer.hasAttribute('data-loaded')) {
        // Show loading indicator
        commentsContainer.innerHTML = '<div style="text-align: center; padding: 15px;"><i class="fas fa-spinner fa-spin"></i> Loading comments...</div>';
        
        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
            loadCommentsForPost(postId, commentsContainer);
        }, 100);
    }
}

// Load comments for a post - SEPARATE FUNCTION
async function loadCommentsForPost(postId, container) {
    try {
        console.log("Loading comments for post ID:", postId);
        
        // Create simple sample comments for testing
        const sampleComments = [
            {
                id: 'sample1',
                content: 'This is a sample comment.',
                userId: 'sampleUser1',
                username: 'sample_user1',
                displayName: 'Sample User 1',
                userPhoto: 'img/default-avatar.png',
                createdAt: new Date(Date.now() - 3600000) // 1 hour ago
            },
            {
                id: 'sample2',
                content: 'Another sample comment with different content.',
                userId: 'sampleUser2',
                username: 'sample_user2',
                displayName: 'Sample User 2',
                userPhoto: 'img/default-avatar.png',
                createdAt: new Date(Date.now() - 7200000) // 2 hours ago
            }
        ];
        
        // Display sample comments for testing
        container.innerHTML = '';
        
        if (sampleComments.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 15px; color: #777;">No comments yet. Be the first to comment!</div>';
        } else {
            // Add each sample comment to the container
            sampleComments.forEach(comment => {
                const commentEl = createCommentElement(comment);
                container.appendChild(commentEl);
            });
        }
        
        // Mark container as loaded
        container.setAttribute('data-loaded', 'true');
        
        // Try to fetch real comments from Firestore
        try {
            // Use a simple query without orderBy - just filter by postId
            const commentsRef = collection(db, "post_comments");
            const q = query(commentsRef, where("postId", "==", String(postId)));
            
            const querySnapshot = await getDocs(q);
            console.log("Firestore returned", querySnapshot.size, "comments");
            
            // If we got real comments, replace the sample ones
            if (querySnapshot.size > 0) {
                container.innerHTML = '';
                
                querySnapshot.forEach((doc) => {
                    const commentData = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    const commentEl = createCommentElement(commentData);
                    container.appendChild(commentEl);
                });
            }
        } catch (error) {
            console.error("Error fetching comments from Firestore:", error);
            // We already have sample comments displayed, so we don't need to show an error
        }
        
    } catch (error) {
        console.error('Error in loadCommentsForPost:', error);
        container.innerHTML = `<div style="text-align: center; padding: 15px; color: #ff6b6b;">Error loading comments: ${error.message}</div>`;
    }
}

// Create a comment element
function createCommentElement(comment) {
    const commentElement = document.createElement('div');
    commentElement.className = 'post-comment';
    commentElement.dataset.id = comment.id;
    
    // Format date
    const formattedDate = formatDate(comment.createdAt);
    
    // Check if current user is comment author
    const isAuthor = currentUser && currentUser.uid === comment.userId;
    
    commentElement.innerHTML = `
        <div style="display: flex; align-items: flex-start; margin-bottom: 8px;">
            <img src="${comment.userPhoto}" alt="${comment.displayName}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 10px;" onerror="this.src='img/default-avatar.png'">
            <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 2px;">@${comment.username}</div>
                <div>${formatPostContent(comment.content)}</div>
                <div style="font-size: 0.8rem; color: #777; margin-top: 5px;">${formattedDate}</div>
            </div>
            ${isAuthor ? `
                <button class="delete-comment-btn" data-comment-id="${comment.id}" style="background: none; border: none; cursor: pointer; color: #ff6b6b; font-size: 0.9rem; padding: 5px;">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
    `;
    
    // Add delete event listener if user is author
    if (isAuthor) {
        const deleteBtn = commentElement.querySelector('.delete-comment-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm("Delete this comment?")) {
                    handleDeleteComment(comment.id, comment.postId);
                }
            });
        }
    }
    
    return commentElement;
}

// Handle comment submission
async function handleCommentSubmission(form, postId) {
    if (!isLoggedIn) {
        window.location.href = 'login.html?redirect=community.html';
        return;
    }
    
    const textarea = form.querySelector('textarea');
    const commentContent = textarea.value.trim();
    
    if (!commentContent) {
        showToast('Please enter a comment', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        console.log("Adding comment to post:", postId);
        
        // Ensure postId is stored as a string
        const postIdString = String(postId);
        
        // Create comment data
        const newComment = {
            content: commentContent,
            userId: currentUser.uid,
            postId: postIdString,
            displayName: currentUser.displayName || 'Anonymous',
            username: getUsernameFromEmail(currentUser.email),
            userPhoto: currentUser.photoURL || 'img/default-avatar.png',
            createdAt: serverTimestamp()
        };
        
        // Add to Firestore
        const docRef = await addDoc(collection(db, "post_comments"), newComment);
        console.log("Comment added with ID:", docRef.id);
        
        // Update comment count on post
        const postRef = doc(db, "community_posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
            const currentCount = postSnap.data().comments || 0;
            await updateDoc(postRef, {
                comments: currentCount + 1
            });
            
            // Update comment count in UI
            const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
            if (commentBtn) {
                const count = parseInt(commentBtn.textContent.trim().match(/\d+/)[0] || 0);
                commentBtn.innerHTML = `<i class="fas fa-comment"></i> ${count + 1}`;
            }
        }
        
        // Clear form
        textarea.value = '';
        
        // Add comment to UI
        const commentsContainer = document.querySelector(`.comments-container[data-post-id="${postId}"]`);
        if (commentsContainer) {
            // Remove no comments message if present
            const noComments = commentsContainer.querySelector('div');
            if (noComments && noComments.textContent.includes('No comments yet')) {
                noComments.remove();
            }
            
            // Create comment element with temporary date
            const comment = {
                id: docRef.id,
                ...newComment,
                createdAt: new Date()
            };
            
            const commentElement = createCommentElement(comment);
            
            // Add to beginning of container
            if (commentsContainer.firstChild) {
                commentsContainer.insertBefore(commentElement, commentsContainer.firstChild);
            } else {
                commentsContainer.appendChild(commentElement);
            }
        }
        
        showToast('Comment posted successfully!');
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Error posting comment. Please try again.', 'error');
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// Handle delete comment
async function handleDeleteComment(commentId, postId) {
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, "post_comments", commentId));
        
        // Update comment count on post
        const postRef = doc(db, "community_posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
            const currentCount = postSnap.data().comments || 0;
            if (currentCount > 0) {
                await updateDoc(postRef, {
                    comments: currentCount - 1
                });
                
                // Update comment count in UI
                const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
                if (commentBtn) {
                    const count = parseInt(commentBtn.textContent.trim().match(/\d+/)[0] || 0);
                    commentBtn.innerHTML = `<i class="fas fa-comment"></i> ${Math.max(0, count - 1)}`;
                }
            }
        }
        
        // Remove from UI
        const commentElement = document.querySelector(`.post-comment[data-id="${commentId}"]`);
        if (commentElement) {
            commentElement.remove();
            
            // Check if this was the last comment
            const commentsContainer = document.querySelector(`.comments-container[data-post-id="${postId}"]`);
            if (commentsContainer && commentsContainer.children.length === 0) {
                commentsContainer.innerHTML = '<div style="text-align: center; padding: 15px; color: #777;">No comments yet. Be the first to comment!</div>';
            }
        }
        
        showToast('Comment deleted');
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Error deleting comment. Please try again.', 'error');
    }
}

// Handle delete post
async function handleDeletePost(postId) {
    try {
        // Delete post from Firestore
        await deleteDoc(doc(db, "community_posts", postId));
        
        // Remove from UI
        const postElement = document.querySelector(`.community-post[data-id="${postId}"]`);
        if (postElement) {
            postElement.remove();
            
            // Check if all posts are gone
            if (communityPosts.children.length === 0) {
                communityPosts.innerHTML = `
                    <div style="text-align: center; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <i class="fas fa-comment-slash" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <h3>No posts found</h3>
                        <p>There are no posts in this category yet. Be the first to start a conversation!</p>
                    </div>
                `;
            }
        }
        
        showToast('Post deleted successfully');
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Error deleting post. Please try again.', 'error');
    }
}

// Handle share button click
function handleShare(postId) {
    // Create share URL
    const shareUrl = `${window.location.origin}/community.html?post=${postId}`;
    
    // Try to use Web Share API if available
    if (navigator.share) {
        navigator.share({
            title: 'Check out this post on Trends Virals',
            url: shareUrl
        }).then(() => {
            showToast('Post shared successfully!');
        }).catch((error) => {
            console.error('Error sharing:', error);
            copyToClipboard(shareUrl);
        });
    } else {
        // Fall back to clipboard
        copyToClipboard(shareUrl);
    }
}

// Copy to clipboard helper
function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Link copied to clipboard!');
        })
        .catch((error) => {
            console.error('Error copying to clipboard:', error);
            showToast('Failed to copy link', 'error');
        });
}

// Format date helper
function formatDate(dateObj) {
    if (!dateObj) return 'Just now';
    
    // Handle Firestore timestamps
    if (dateObj && dateObj.toDate && typeof dateObj.toDate === 'function') {
        dateObj = dateObj.toDate();
    }
    
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
        return 'Just now';
    } else if (diffMin < 60) {
        return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHour < 24) {
        return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDay < 7) {
        return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } else {
        // Format date for older posts
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return dateObj.toLocaleDateString('en-US', options);
    }
}

// Extract hashtags from text
function extractHashtags(text) {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    
    if (matches) {
        return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
    }
    
    return [];
}

// Link hashtags in text
function linkHashtags(text) {
    if (!text) return '';
    
    // Replace hashtags with linked versions
    return text.replace(/#([\w]+)/g, '<a href="#" class="hashtag" data-tag="$1">#$1</a>');
}

// Detect post category based on content and hashtags
function detectPostCategory(content, hashtags) {
    const categoryKeywords = {
        education: ['education', 'learning', 'school', 'study', 'teach', 'student', 'university'],
        finance: ['finance', 'money', 'invest', 'stock', 'market', 'crypto', 'economy'],
        entertainment: ['entertainment', 'movie', 'music', 'show', 'film', 'tv', 'game'],
        sports: ['sports', 'game', 'team', 'player', 'match', 'league', 'tournament'],
        news: ['news', 'update', 'headline', 'breaking', 'world', 'politics', 'report'],
        technology: ['tech', 'technology', 'software', 'app', 'device', 'ai', 'digital']
    };
    
    // Check hashtags first
    for (const tag of hashtags) {
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => tag.includes(keyword))) {
                return category;
            }
        }
    }
    
    // Then check content
    const contentLower = content.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => contentLower.includes(keyword))) {
            return category;
        }
    }
    
    // Default to general
    return 'general';
}

// Get username from email
function getUsernameFromEmail(email) {
    if (!email) return 'user';
    return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
}

// Show toast notification
function showToast(message, type = 'success') {
    // Check if toast container exists
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '1000';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Style toast
    toast.style.backgroundColor = type === 'success' ? '#4caf50' : '#f44336';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.marginTop = '10px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.transition = 'all 0.3s ease';
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
// News API Integration

// Your News API key
const API_KEY = '43bba97e2dcb4dbbb7cd77fc6137578e';
const BASE_URL = 'https://newsapi.org/v2';

// Import Firebase services
import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    deleteDoc, 
    doc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const featuredArticleElement = document.getElementById('featured-article');
const articleGridElement = document.getElementById('article-grid');
const loadMoreButton = document.getElementById('load-more');
const categoryTabs = document.querySelectorAll('.category-tab');
const countryFilter = document.getElementById('country-filter');
const sortByFilter = document.getElementById('sort-by');
const dateFilter = document.getElementById('date-filter');
const searchForm = document.getElementById('news-search-form');
const searchInput = document.getElementById('search-input');
const loadingOverlay = document.getElementById('loading-overlay');
const errorModal = document.getElementById('error-modal');
const errorMessage = document.getElementById('error-message');
const closeError = document.querySelector('.close-error');

// State variables
let currentPage = 1;
let currentCategory = 'general';
let currentCountry = 'us';
let currentSortBy = 'publishedAt';
let currentDateFilter = 'today';
let currentQuery = '';
let totalResults = 0;
let articles = [];
let hasMoreArticles = true;
let isFetching = false;
let savedArticles = [];

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Fetch initial articles
    fetchTopHeadlines();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup save article functionality (if user is logged in)
    import('./auth.js').then(({ getCurrentUser }) => {
        setupSaveArticleFunctionality(getCurrentUser);
    }).catch(err => {
        console.error('Error loading auth module:', err);
    });
});

// Set up all event listeners
function setupEventListeners() {
    // Category tabs
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update UI
            categoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Get category and reset page
            currentCategory = tab.dataset.category;
            resetArticles();
            fetchTopHeadlines();
        });
    });
    
    // Country filter
    countryFilter.addEventListener('change', () => {
        currentCountry = countryFilter.value;
        resetArticles();
        fetchTopHeadlines();
    });
    
    // Sort by filter
    sortByFilter.addEventListener('change', () => {
        currentSortBy = sortByFilter.value;
        resetArticles();
        
        // If search query exists, use search endpoint
        if (currentQuery) {
            searchNews(currentQuery);
        } else {
            fetchTopHeadlines();
        }
    });
    
    // Date filter
    dateFilter.addEventListener('change', () => {
        currentDateFilter = dateFilter.value;
        resetArticles();
        
        // If search query exists, use search endpoint
        if (currentQuery) {
            searchNews(currentQuery);
        } else {
            fetchTopHeadlines();
        }
    });
    
    // Search form
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        
        if (query) {
            currentQuery = query;
            resetArticles();
            searchNews(query);
        }
    });
    
    // Load more button
    loadMoreButton.addEventListener('click', () => {
        if (!isFetching && hasMoreArticles) {
            currentPage++;
            
            if (currentQuery) {
                searchNews(currentQuery, false);
            } else {
                fetchTopHeadlines(false);
            }
        }
    });
    
    // Close error modal
    closeError.addEventListener('click', () => {
        errorModal.style.display = 'none';
    });
    
    // Close error modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.style.display = 'none';
        }
    });
    
    // Search toggle
    const searchToggle = document.querySelector('.search-toggle');
    const searchContainer = document.querySelector('.search-container');
    
    if (searchToggle && searchContainer) {
        searchToggle.addEventListener('click', () => {
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
            }
        });
        
        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (searchContainer.classList.contains('active') && 
                !e.target.closest('.search-container') && 
                !e.target.closest('.search-toggle')) {
                searchContainer.classList.remove('active');
            }
        });
    }
}

// Fetch top headlines
async function fetchTopHeadlines(append = true) {
    if (isFetching) return;
    isFetching = true;
    
    if (!append) {
        showLoadingOverlay();
    } else {
        showLoaderInGrid();
    }
    
    try {
        // Calculate date for filtering
        const fromDate = getDateFromFilter(currentDateFilter);
        
        // Build URL
        let url = `${BASE_URL}/top-headlines?apiKey=${API_KEY}&category=${currentCategory}&country=${currentCountry}&page=${currentPage}&pageSize=10`;
        
        if (fromDate) {
            url += `&from=${fromDate}`;
        }
        
        // Fetch data
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error(data.message || 'Failed to fetch news');
        }
        
        // Process results
        processResults(data, append);
    } catch (error) {
        console.error('Error fetching top headlines:', error);
        showError(error.message || 'Failed to fetch news. Please try again later.');
    } finally {
        isFetching = false;
        hideLoading();
    }
}

// Search news by query
async function searchNews(query, append = true) {
    if (isFetching) return;
    isFetching = true;
    
    if (!append) {
        showLoadingOverlay();
    } else {
        showLoaderInGrid();
    }
    
    try {
        // Calculate date for filtering
        const fromDate = getDateFromFilter(currentDateFilter);
        
        // Build URL
        let url = `${BASE_URL}/everything?apiKey=${API_KEY}&q=${encodeURIComponent(query)}&sortBy=${currentSortBy}&page=${currentPage}&pageSize=10`;
        
        if (fromDate) {
            url += `&from=${fromDate}`;
        }
        
        // Add language filter
        const language = getLanguageFromCountry(currentCountry);
        if (language) {
            url += `&language=${language}`;
        }
        
        // Fetch data
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error(data.message || 'Failed to fetch news');
        }
        
        // Process results
        processResults(data, append);
    } catch (error) {
        console.error('Error searching news:', error);
        showError(error.message || 'Failed to search news. Please try again later.');
    } finally {
        isFetching = false;
        hideLoading();
    }
}

// Process API results
function processResults(data, append) {
    totalResults = data.totalResults;
    
    // Check if there are results
    if (data.articles.length === 0) {
        if (!append) {
            showNoResults();
            hasMoreArticles = false;
        }
        return;
    }
    
    // Process articles
    const newArticles = data.articles.filter(article => {
        // Filter out articles with missing fields
        return article.title && article.url;
    });
    
    // Update state
    if (append) {
        articles = [...articles, ...newArticles];
    } else {
        articles = newArticles;
    }
    
    // Check if there are more articles to load
    hasMoreArticles = articles.length < totalResults;
    loadMoreButton.style.display = hasMoreArticles ? 'inline-block' : 'none';
    
    // Render articles
    renderArticles(append);
}

// Render articles to the page
function renderArticles(append) {
    if (!append) {
        // Clear previous articles
        featuredArticleElement.innerHTML = '';
        articleGridElement.innerHTML = '';
        
        // Render featured article (first article)
        if (articles.length > 0) {
            const featuredArticle = articles[0];
            featuredArticleElement.innerHTML = createFeaturedArticleHTML(featuredArticle);
        }
        
        // Render grid articles (skip the first one which is featured)
        const gridArticles = articles.slice(1);
        gridArticles.forEach(article => {
            articleGridElement.innerHTML += createArticleCardHTML(article);
        });
    } else {
        // In append mode, just add the new articles to the grid
        articles.slice(-10).forEach(article => {
            articleGridElement.innerHTML += createArticleCardHTML(article);
        });
    }
    
    // Setup save buttons for all articles
    setupSaveButtons();
}

// Create HTML for featured article
function createFeaturedArticleHTML(article) {
    const { title, url, urlToImage, publishedAt, source, description, content } = article;
    const formattedDate = formatDate(publishedAt);
    const imageUrl = urlToImage || 'img/news-placeholder.jpg';
    const isSaved = isArticleSaved(url);
    const saveButtonClass = isSaved ? 'saved' : '';
    
    return `
        <div class="featured-article-inner">
            <img src="${imageUrl}" alt="${title}" class="featured-article-image" onerror="this.src='img/news-placeholder.jpg'">
            <div class="featured-article-content">
                <div class="featured-article-meta">
                    <span class="featured-article-category">${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}</span>
                    <span class="featured-article-date">${formattedDate}</span>
                </div>
                <h2 class="featured-article-title">${title}</h2>
                <p class="featured-article-source">Source: ${source.name || 'Unknown'}</p>
                <p class="featured-article-description">${description || content || 'No description available.'}</p>
                <div class="featured-article-actions">
                    <a href="${url}" target="_blank" class="featured-article-link">Read Full Article</a>
                    <button class="article-card-save ${saveButtonClass}" data-url="${url}" data-title="${title}" data-image="${imageUrl}" data-source="${source.name || 'Unknown'}" data-date="${publishedAt}">
                        <i class="fas ${isSaved ? 'fa-bookmark' : 'fa-bookmark-o'}"></i> ${isSaved ? 'Saved' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Create HTML for article card
function createArticleCardHTML(article) {
    const { title, url, urlToImage, publishedAt, source, description } = article;
    const formattedDate = formatDate(publishedAt);
    const imageUrl = urlToImage || 'img/news-placeholder.jpg';
    const shortenedDescription = description ? description.substring(0, 120) + '...' : 'No description available.';
    const isSaved = isArticleSaved(url);
    const saveButtonClass = isSaved ? 'saved' : '';
    
    return `
        <div class="article-card">
            <div class="article-card-image-container">
                <img src="${imageUrl}" alt="${title}" class="article-card-image" onerror="this.src='img/news-placeholder.jpg'">
            </div>
            <div class="article-card-content">
                <div class="article-card-meta">
                    <span class="article-card-category">${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}</span>
                    <span class="article-card-date">${formattedDate}</span>
                </div>
                <h3 class="article-card-title">${title}</h3>
                <p class="article-card-source">Source: ${source.name || 'Unknown'}</p>
                <p class="article-card-description">${shortenedDescription}</p>
                <div class="article-card-actions">
                    <a href="${url}" target="_blank" class="article-card-link">Read More</a>
                    <button class="article-card-save ${saveButtonClass}" data-url="${url}" data-title="${title}" data-image="${imageUrl}" data-source="${source.name || 'Unknown'}" data-date="${publishedAt}">
                        <i class="fas ${isSaved ? 'fa-bookmark' : 'fa-bookmark-o'}"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Show no results message
function showNoResults() {
    const message = currentQuery 
        ? `No results found for "${currentQuery}". Please try a different search term.` 
        : 'No articles found for the selected filters. Please try different filters.';
    
    articleGridElement.innerHTML = `
        <div class="no-results">
            <h3>No Results Found</h3>
            <p>${message}</p>
            <button class="btn" onclick="resetFilters()">Reset Filters</button>
        </div>
    `;
}

// Reset filters to default
window.resetFilters = function() {
    currentCategory = 'general';
    currentCountry = 'us';
    currentSortBy = 'publishedAt';
    currentDateFilter = 'today';
    currentQuery = '';
    
    // Update UI
    categoryTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === 'general');
    });
    
    countryFilter.value = 'us';
    sortByFilter.value = 'publishedAt';
    dateFilter.value = 'today';
    searchInput.value = '';
    
    // Fetch articles
    resetArticles();
    fetchTopHeadlines();
};

// Reset articles
function resetArticles() {
    currentPage = 1;
    articles = [];
    hasMoreArticles = true;
    totalResults = 0;
}

// Show loading overlay
function showLoadingOverlay() {
    loadingOverlay.classList.add('active');
}

// Hide loading
function hideLoading() {
    loadingOverlay.classList.remove('active');
    const loaders = document.querySelectorAll('.loader');
    loaders.forEach(loader => loader.remove());
}

// Show loader in grid
function showLoaderInGrid() {
    if (currentPage === 1) {
        featuredArticleElement.innerHTML = '<div class="loader"></div>';
        articleGridElement.innerHTML = '<div class="loader"></div>';
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorModal.style.display = 'flex';
}

// Get date from filter
function getDateFromFilter(filter) {
    const today = new Date();
    
    switch (filter) {
        case 'today':
            return today.toISOString().split('T')[0];
        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            return weekAgo.toISOString().split('T')[0];
        case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            return monthAgo.toISOString().split('T')[0];
        default:
            return null;
    }
}

// Get language from country
function getLanguageFromCountry(country) {
    const countryLanguages = {
        'us': 'en',
        'gb': 'en',
        'ca': 'en',
        'au': 'en',
        'in': 'en',
        'fr': 'fr',
        'de': 'de',
        'jp': 'jp'
    };
    
    return countryLanguages[country] || 'en';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    
    // If invalid date
    if (isNaN(date.getTime())) return 'Unknown date';
    
    // Get the difference in days
    const today = new Date();
    const diffTime = Math.abs(today - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        // Format time if it's today
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const formattedHours = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        
        return `Today, ${formattedHours}:${formattedMinutes} ${ampm}`;
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        // Format date for older articles
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${month} ${day}, ${year}`;
    }
}

// Setup save article functionality
function setupSaveArticleFunctionality(getCurrentUser) {
    // Initial load of saved articles
    loadSavedArticles(getCurrentUser());
}

// Setup save buttons
function setupSaveButtons() {
    const saveButtons = document.querySelectorAll('.article-card-save');
    
    saveButtons.forEach(button => {
        button.addEventListener('click', async function() {
            // Import auth dynamically to avoid circular dependencies
            try {
                const { getCurrentUser } = await import('./auth.js');
                const user = getCurrentUser();
                
                if (!user) {
                    // Redirect to login if not logged in
                    window.location.href = 'login.html?redirect=news.html';
                    return;
                }
                
                const url = this.dataset.url;
                const title = this.dataset.title;
                const imageUrl = this.dataset.image;
                const source = this.dataset.source;
                const publishedAt = this.dataset.date;
                
                // Check if article is already saved
                const isSaved = isArticleSaved(url);
                
                if (isSaved) {
                    // Unsave article
                    await unsaveArticle(url, user.uid);
                    this.classList.remove('saved');
                    this.innerHTML = '<i class="fas fa-bookmark-o"></i>';
                    if (this.innerText) {
                        this.innerText = 'Save';
                    }
                } else {
                    // Save article
                    await saveArticle({
                        url,
                        title,
                        imageUrl,
                        source,
                        publishedAt,
                        userId: user.uid,
                        category: currentCategory,
                        savedAt: new Date()
                    });
                    this.classList.add('saved');
                    this.innerHTML = '<i class="fas fa-bookmark"></i>';
                    if (this.innerText) {
                        this.innerText = 'Saved';
                    }
                }
            } catch (error) {
                console.error('Error with save functionality:', error);
                showError('Error saving article. Please try again.');
            }
        });
    });
}

// Save article to Firebase
async function saveArticle(articleData) {
    try {
        // Add to Firestore
        await addDoc(collection(db, "saved_articles"), {
            ...articleData,
            savedAt: serverTimestamp()
        });
        
        // Add to local saved articles
        savedArticles.push(articleData);
    } catch (error) {
        console.error('Error saving article:', error);
        throw error;
    }
}

// Unsave article from Firebase
async function unsaveArticle(url, userId) {
    try {
        // Query for the article document
        const q = query(
            collection(db, "saved_articles"), 
            where("url", "==", url),
            where("userId", "==", userId)
        );
        
        const querySnapshot = await getDocs(q);
        
        // Delete all matching documents
        const deletePromises = [];
        querySnapshot.forEach((document) => {
            deletePromises.push(deleteDoc(doc(db, "saved_articles", document.id)));
        });
        
        await Promise.all(deletePromises);
        
        // Remove from local saved articles
        savedArticles = savedArticles.filter(article => article.url !== url);
    } catch (error) {
        console.error('Error unsaving article:', error);
        throw error;
    }
}

// Load saved articles
async function loadSavedArticles(user) {
    if (!user) return;
    
    try {
        const q = query(
            collection(db, "saved_articles"),
            where("userId", "==", user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        savedArticles = [];
        
        querySnapshot.forEach((doc) => {
            savedArticles.push(doc.data());
        });
        
        // Update UI for any currently displayed articles
        updateSavedArticlesUI();
    } catch (error) {
        console.error('Error loading saved articles:', error);
    }
}

// Check if article is saved
function isArticleSaved(url) {
    return savedArticles.some(article => article.url === url);
}

// Update UI for saved articles
function updateSavedArticlesUI() {
    const saveButtons = document.querySelectorAll('.article-card-save');
    
    saveButtons.forEach(button => {
        const url = button.dataset.url;
        const isSaved = isArticleSaved(url);
        
        button.classList.toggle('saved', isSaved);
        button.innerHTML = `<i class="fas ${isSaved ? 'fa-bookmark' : 'fa-bookmark-o'}"></i>`;
        if (button.innerText) {
            button.innerText = isSaved ? 'Saved' : 'Save';
        }
    });
}
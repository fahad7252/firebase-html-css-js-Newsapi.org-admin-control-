// profile-api.js
import { db } from '../firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    writeBatch,
    limit
} from "firebase/firestore";

// Get saved articles for a user
export async function getSavedArticles(userId) {
    try {
        // First get the user's saved article IDs
        const userDoc = await getDoc(doc(db, "users", userId));
        
        if (!userDoc.exists()) {
            throw new Error("User not found");
        }
        
        const userData = userDoc.data();
        const savedArticleIds = userData.savedArticles || [];
        
        if (savedArticleIds.length === 0) {
            return [];
        }
        
        // Get article details for each saved article
        const articles = [];
        
        // Process in batches if there are many saved articles
        const batchSize = 10;
        for (let i = 0; i < savedArticleIds.length; i += batchSize) {
            const batch = savedArticleIds.slice(i, i + batchSize);
            
            const articlesQuery = query(
                collection(db, "articles"),
                where("__name__", "in", batch)
            );
            
            const querySnapshot = await getDocs(articlesQuery);
            
            querySnapshot.forEach((doc) => {
                articles.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        }
        
        // Sort by most recently published
        articles.sort((a, b) => b.publishDate.toMillis() - a.publishDate.toMillis());
        
        return articles;
    } catch (error) {
        console.error("Error getting saved articles:", error);
        throw error;
    }
}

// Get articles authored by a user
export async function getArticlesByUser(userId) {
    try {
        const articlesQuery = query(
            collection(db, "articles"),
            where("authorId", "==", userId),
            orderBy("publishDate", "desc")
        );
        
        const querySnapshot = await getDocs(articlesQuery);
        
        const articles = [];
        querySnapshot.forEach((doc) => {
            articles.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return articles;
    } catch (error) {
        console.error("Error getting user articles:", error);
        throw error;
    }
}

// Get community posts by a user
export async function getPostsByUser(userId) {
    try {
        const postsQuery = query(
            collection(db, "community_posts"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(postsQuery);
        
        const posts = [];
        querySnapshot.forEach((doc) => {
            posts.push({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate()
            });
        });
        
        return posts;
    } catch (error) {
        console.error("Error getting user posts:", error);
        throw error;
    }
}

// Update a community post
export async function updatePost(postId, data) {
    try {
        const postRef = doc(db, "community_posts", postId);
        await updateDoc(postRef, data);
        return true;
    } catch (error) {
        console.error("Error updating post:", error);
        throw error;
    }
}

// Delete a community post
export async function deletePost(postId) {
    try {
        const batch = writeBatch(db);
        
        // Delete the post
        const postRef = doc(db, "community_posts", postId);
        batch.delete(postRef);
        
        // Get and delete associated comments
        const commentsQuery = query(
            collection(db, "comments"),
            where("postId", "==", postId)
        );
        
        const commentsSnapshot = await getDocs(commentsQuery);
        
        commentsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Commit the batch
        await batch.commit();
        
        return true;
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
}

// Get a user's activity stats
export async function getUserStats(userId) {
    try {
        // Get post count
        const postsQuery = query(
            collection(db, "community_posts"),
            where("userId", "==", userId),
            limit(1000) // Set a reasonable limit
        );
        
        const postsSnapshot = await getDocs(postsQuery);
        const postCount = postsSnapshot.size;
        
        // Get comment count
        const commentsQuery = query(
            collection(db, "comments"),
            where("userId", "==", userId),
            limit(1000)
        );
        
        const commentsSnapshot = await getDocs(commentsQuery);
        const commentCount = commentsSnapshot.size;
        
        // Get article count
        const articlesQuery = query(
            collection(db, "articles"),
            where("authorId", "==", userId),
            limit(1000)
        );
        
        const articlesSnapshot = await getDocs(articlesQuery);
        const articleCount = articlesSnapshot.size;
        
        // Get saved count
        const userDoc = await getDoc(doc(db, "users", userId));
        const savedCount = userDoc.exists() ? (userDoc.data().savedArticles?.length || 0) : 0;
        
        return {
            posts: postCount,
            comments: commentCount,
            articles: articleCount,
            saved: savedCount
        };
    } catch (error) {
        console.error("Error getting user stats:", error);
        throw error;
    }
}
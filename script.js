// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- FIREBASE CONFIGURATION ---
// PASTE YOUR KEYS HERE
const firebaseConfig = {
    apiKey: "AIzaSyAKkvOztBDOJ7hJ6vVZsTrBwi-yMPWPkBs", // Placeholder from your prompt
    authDomain: "xxxx-98488.firebaseapp.com",
    projectId: "xxxx-98488",
    storageBucket: "xxxx-98488.firebasestorage.app",
    messagingSenderId: "1043427778445",
    appId: "1:1043427778445:web:99d63a6f2ac450317a67c4",
    databaseURL: "https://xxxx-98488-default-rtdb.firebaseio.com/" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

// State
let currentFolderId = 'root';

// --- DOM ELEMENTS ---
const fileInput = document.getElementById('file-upload');
const folderListEl = document.getElementById('folder-list');
const filesGridEl = document.getElementById('files-grid');
const currentFolderLabel = document.getElementById('current-folder-name');

// --- EVENT LISTENERS ---

// File Upload Listener
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Visual feedback
    const btn = document.querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;

    try {
        await uploadFile(file);
        alert('File uploaded successfully!');
    } catch (error) {
        console.error("Upload failed:", error);
        alert('Error uploading file. Check console.');
    } finally {
        btn.innerHTML = originalText;
        fileInput.value = ''; // Reset input
    }
});

// --- CORE FUNCTIONS ---

// 1. Upload File
async function uploadFile(file) {
    // 1. Upload actual file to Firebase Storage
    const storageRef = sRef(storage, `uploads/${currentFolderId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 2. Save metadata to Realtime Database
    const filesRef = ref(db, 'files');
    const newFileRef = push(filesRef);
    
    await set(newFileRef, {
        name: file.name,
        url: downloadURL,
        folderId: currentFolderId,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: file.type,
        createdAt: Date.now()
    });
}

// 2. Create New Folder
window.promptNewFolder = async function() {
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    const foldersRef = ref(db, 'folders');
    const newFolderRef = push(foldersRef);
    
    await set(newFolderRef, {
        name: folderName,
        createdAt: Date.now()
    });
}

// 3. Load Folder Content (Switch view)
window.loadFolder = function(folderId, folderName = "All Notes") {
    currentFolderId = folderId;
    currentFolderLabel.innerText = folderName;
    
    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // (Simple logic: if root, highlight All Notes. If specific folder, highlight that)
    if(folderId === 'root') {
        document.querySelector('.nav-links > .nav-item').classList.add('active');
    }
    
    renderFiles();
}

// --- REALTIME LISTENERS ---

// A. Listen for Folders
const foldersRef = ref(db, 'folders');
onValue(foldersRef, (snapshot) => {
    folderListEl.innerHTML = ''; // Clear list
    const data = snapshot.val();
    
    if (data) {
        Object.keys(data).forEach(key => {
            const folder = data[key];
            const div = document.createElement('div');
            div.className = `nav-item ${currentFolderId === key ? 'active' : ''}`;
            div.onclick = () => loadFolder(key, folder.name);
            div.innerHTML = `<i class="far fa-folder"></i> ${folder.name}`;
            folderListEl.appendChild(div);
        });
    }
});

// B. Listen for Files
function renderFiles() {
    const filesRef = ref(db, 'files');
    
    // In a real app, use queries to filter by folderId on the server side.
    // For simplicity with basic rules, we fetch all and filter client-side here.
    onValue(filesRef, (snapshot) => {
        filesGridEl.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
            filesGridEl.innerHTML = '<p class="loading">No notes yet.</p>';
            return;
        }

        const files = Object.values(data).filter(f => f.folderId === currentFolderId);

        if (files.length === 0) {
            filesGridEl.innerHTML = '<p class="loading">Folder is empty.</p>';
            return;
        }

        files.forEach(file => {
            const date = new Date(file.createdAt).toLocaleDateString();
            
            // Determine icon based on type
            let iconClass = 'fa-file';
            let typeClass = 'file';
            if (file.type.includes('pdf')) { iconClass = 'fa-file-pdf'; typeClass = 'pdf'; }
            else if (file.type.includes('image')) { iconClass = 'fa-file-image'; typeClass = 'image'; }
            
            const card = document.createElement('div');
            card.className = `file-card ${typeClass}`;
            card.innerHTML = `
                <div class="file-icon"><i class="fas ${iconClass}"></i></div>
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">
                    <span>${date}</span>
                    <span class="tag">${file.size}</span>
                </div>
            `;
            
            // Clicking opens the file
            card.onclick = () => window.open(file.url, '_blank');
            filesGridEl.appendChild(card);
        });
    });
}

// Initial load
renderFiles();

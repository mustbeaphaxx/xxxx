// --- IMPORTS (Only Database, No Storage) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAKkvOztBDOJ7hJ6vVZsTrBwi-yMPWPkBs", 
    authDomain: "xxxx-98488.firebaseapp.com",
    projectId: "xxxx-98488",
    // storageBucket is removed because we aren't using it
    messagingSenderId: "1043427778445",
    appId: "1:1043427778445:web:99d63a6f2ac450317a67c4",
    databaseURL: "https://xxxx-98488-default-rtdb.firebaseio.com/" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let currentFolderId = 'root';

// --- DOM ELEMENTS ---
const fileInput = document.getElementById('file-upload');
const uploadBtn = document.getElementById('upload-btn');
const folderListEl = document.getElementById('folder-list');
const filesGridEl = document.getElementById('files-grid');
const currentFolderLabel = document.getElementById('current-folder-name');
const modal = document.getElementById('folder-modal');
const newFolderInput = document.getElementById('new-folder-name');

// --- HELPER: Convert File to Base64 String ---
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// --- 1. UPLOAD LOGIC (Modified for RTDB Only) ---
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // CHECK FILE SIZE (Limit to 5MB for safety)
    if (file.size > 5 * 1024 * 1024) {
        alert("File is too big! Realtime Database only supports small files (Max 5MB).");
        fileInput.value = '';
        return;
    }

    // UI Feedback
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Converting...`;
    uploadBtn.style.opacity = "0.7";
    uploadBtn.style.pointerEvents = "none";

    try {
        // 1. Convert file to text string
        const base64String = await toBase64(file);

        // 2. Save directly to Database
        const filesRef = ref(db, 'files');
        const newFileRef = push(filesRef);
        
        await set(newFileRef, {
            name: file.name,
            fileData: base64String, // <--- The actual file is saved here as text
            folderId: currentFolderId,
            type: file.type || 'unknown',
            size: (file.size / 1024).toFixed(1) + ' KB',
            createdAt: Date.now()
        });
        
        console.log("File saved to database");

    } catch (error) {
        console.error("Upload failed:", error);
        alert("Error saving to database. Check console.");
    } finally {
        uploadBtn.innerHTML = originalText;
        uploadBtn.style.opacity = "1";
        uploadBtn.style.pointerEvents = "auto";
        fileInput.value = '';
    }
});

// --- 2. RENDER FILES ---
onValue(ref(db, 'files'), (snapshot) => {
    filesGridEl.innerHTML = '';
    const data = snapshot.val();
    
    if (!data) {
        filesGridEl.innerHTML = '<p style="color:#aaa; text-align:center; width:100%;">No notes yet.</p>';
        return;
    }

    // Filter files for current folder
    const files = Object.values(data).filter(f => f.folderId === currentFolderId);

    if (files.length === 0) {
        filesGridEl.innerHTML = '<p style="color:#aaa; text-align:center; width:100%;">Folder is empty.</p>';
        return;
    }

    files.forEach(file => {
        // Determine Icon
        let icon = 'fa-file';
        let styleClass = 'type-other';
        const name = file.name.toLowerCase();

        if (name.endsWith('.pdf')) { 
            icon = 'fa-file-pdf'; styleClass = 'type-pdf'; 
        } else if (name.match(/\.(jpg|jpeg|png|gif)$/)) { 
            icon = 'fa-file-image'; styleClass = 'type-img'; 
        } else if (name.match(/\.(doc|docx)$/)) { 
            icon = 'fa-file-word'; styleClass = 'type-doc'; 
        }

        const date = new Date(file.createdAt).toLocaleDateString();

        const card = document.createElement('div');
        card.className = 'file-card';
        card.innerHTML = `
            <div class="icon-wrapper ${styleClass}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-date">${date}</div>
        `;
        
        // OPEN FILE: We create a temporary link to the Base64 data
        card.onclick = () => {
            const win = window.open();
            win.document.write(
                `<iframe src="${file.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
            );
        };
        
        filesGridEl.appendChild(card);
    });
});

// --- 3. RENDER FOLDERS (Same as before) ---
onValue(ref(db, 'folders'), (snapshot) => {
    folderListEl.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.keys(data).forEach(key => {
            const folder = data[key];
            const div = document.createElement('div');
            div.className = `nav-item ${currentFolderId === key ? 'active' : ''}`;
            div.innerHTML = `<i class="far fa-folder"></i> ${folder.name}`;
            div.onclick = () => window.loadFolder(key, folder.name);
            folderListEl.appendChild(div);
        });
    }
});

// --- 4. NAVIGATION LOGIC ---
window.loadFolder = function(id, name) {
    currentFolderId = id;
    if(currentFolderLabel) currentFolderLabel.innerText = name;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(id === 'root') {
        const rootBtn = document.getElementById('nav-root');
        if(rootBtn) rootBtn.classList.add('active');
    }
}

// Modal Logic
window.openModal = () => modal.classList.add('show');
window.closeModal = () => modal.classList.remove('show');

window.createFolder = async function() {
    const name = newFolderInput.value;
    if (!name) return;
    await push(ref(db, 'folders'), { name: name, createdAt: Date.now() });
    newFolderInput.value = '';
    closeModal();
}

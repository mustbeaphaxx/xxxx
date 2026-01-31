import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAKkvOztBDOJ7hJ6vVZsTrBwi-yMPWPkBs", 
    authDomain: "xxxx-98488.firebaseapp.com",
    projectId: "xxxx-98488",
    messagingSenderId: "1043427778445",
    appId: "1:1043427778445:web:99d63a6f2ac450317a67c4",
    databaseURL: "https://xxxx-98488-default-rtdb.firebaseio.com/" 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentFolderId = 'root';

// DOM Elements
const fileInput = document.getElementById('file-upload');
const uploadBtn = document.getElementById('upload-btn');
const filesGridEl = document.getElementById('files-grid');

// --- 1. UPLOAD & CONVERT LOGIC ---
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // We only accept DOCX for note conversion
    if (!file.name.endsWith('.docx')) {
        alert("Please upload a .docx file to convert it to a note.");
        return;
    }

    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = `<i class="fas fa-sync fa-spin"></i> Reading Doc...`;

    try {
        // 1. Read file as ArrayBuffer (Required for Mammoth)
        const arrayBuffer = await readFileAsArrayBuffer(file);

        // 2. Convert DOCX to HTML using Mammoth
        // Note: mammoth is loaded globally in index.html script tag
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const htmlContent = result.value; // The generated HTML
        
        if(!htmlContent) {
            throw new Error("Could not extract text. Is the document empty?");
        }

        // 3. Save HTML to Firebase
        const filesRef = ref(db, 'files');
        const newFileRef = push(filesRef);
        
        await set(newFileRef, {
            name: file.name.replace('.docx', ''), // Remove extension for clean title
            content: htmlContent, // SAVE HTML HERE
            type: 'note', // Custom type
            folderId: currentFolderId,
            createdAt: Date.now()
        });
        
    } catch (error) {
        console.error("Conversion failed:", error);
        alert("Error converting file.");
    } finally {
        uploadBtn.innerHTML = originalText;
        fileInput.value = '';
    }
});

// Helper: Read file for Mammoth
const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
};

// --- 2. RENDER NOTES ---
onValue(ref(db, 'files'), (snapshot) => {
    filesGridEl.innerHTML = '';
    const data = snapshot.val();
    
    if (!data) {
        filesGridEl.innerHTML = '<p style="color:#aaa;">No notes yet.</p>';
        return;
    }

    const files = Object.values(data).filter(f => f.folderId === currentFolderId);

    if (files.length === 0) {
        filesGridEl.innerHTML = '<p style="color:#aaa;">Folder is empty.</p>';
        return;
    }

    files.forEach(file => {
        const date = new Date(file.createdAt).toLocaleDateString();

        const card = document.createElement('div');
        card.className = 'file-card';
        // Use a "Sticky Note" look
        card.innerHTML = `
            <div class="icon-wrapper" style="background: #fef9c3; color: #d97706;">
                <i class="fas fa-sticky-note"></i>
            </div>
            <div class="file-name">${file.name}</div>
            <div class="file-date">${date}</div>
        `;
        
        // CLICKING OPENS THE NOTE VIEWER MODAL
        card.onclick = () => openNoteViewer(file.name, file.content);
        
        filesGridEl.appendChild(card);
    });
});

// --- 3. FOLDERS & MODALS ---

// Open Note Viewer
window.openNoteViewer = (title, htmlContent) => {
    document.getElementById('viewer-title').innerText = title;
    document.getElementById('viewer-content').innerHTML = htmlContent;
    document.getElementById('note-viewer-modal').classList.add('show');
}

// Generic Modal functions
window.openModal = (id) => document.getElementById(id).classList.add('show');
window.closeModal = (id) => document.getElementById(id).classList.remove('show');

// Folder Logic (Same as before)
window.loadFolder = function(id, name) {
    currentFolderId = id;
    document.getElementById('current-folder-name').innerText = name || "All Notes";
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(id === 'root') document.getElementById('nav-root').classList.add('active');
}

window.createFolder = async function() {
    const name = document.getElementById('new-folder-name').value;
    if (!name) return;
    await push(ref(db, 'folders'), { name: name, createdAt: Date.now() });
    document.getElementById('new-folder-name').value = '';
    window.closeModal('folder-modal');
}

onValue(ref(db, 'folders'), (snapshot) => {
    const list = document.getElementById('folder-list');
    list.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        Object.keys(data).forEach(key => {
            const folder = data[key];
            const div = document.createElement('div');
            div.className = `nav-item ${currentFolderId === key ? 'active' : ''}`;
            div.innerHTML = `<i class="far fa-folder"></i> ${folder.name}`;
            div.onclick = () => window.loadFolder(key, folder.name);
            list.appendChild(div);
        });
    }
});

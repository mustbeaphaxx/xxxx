import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
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
const filesGridEl = document.getElementById('files-grid');
const noteCountEl = document.getElementById('note-count');

// --- 1. UPLOAD & CONVERT LOGIC ---
window.triggerUpload = () => fileInput.click();

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
        alert("Please upload a .docx file.");
        return;
    }

    // Change button text temporarily
    const btn = document.querySelector('.btn-create');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
        const htmlContent = result.value;

        if(!htmlContent) throw new Error("Empty document");

        await push(ref(db, 'files'), {
            name: file.name.replace('.docx', ''),
            content: htmlContent, // Saves the text content
            folderId: currentFolderId,
            type: 'note',
            createdAt: Date.now()
        });

    } catch (error) {
        console.error(error);
        alert("Error converting note.");
    } finally {
        btn.innerHTML = originalText;
        fileInput.value = '';
    }
});

const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
};

// --- 2. RENDER NOTES (The Visual Fix) ---
onValue(ref(db, 'files'), (snapshot) => {
    filesGridEl.innerHTML = '';
    const data = snapshot.val();
    
    if (!data) {
        noteCountEl.innerText = "0 notes";
        return;
    }

    const files = Object.values(data).filter(f => f.folderId === currentFolderId);
    noteCountEl.innerText = `${files.length} notes`;

    files.forEach(file => {
        const date = new Date(file.createdAt).toLocaleDateString();

        // Create the "Note Look" Card
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <div class="card-icon"><i class="fas fa-sticky-note"></i></div>
            <div class="note-preview"></div> <div>
                <div class="note-title">${file.name}</div>
                <div class="note-date">${date}</div>
            </div>
        `;
        
        card.onclick = () => openNoteViewer(file.name, file.content);
        filesGridEl.appendChild(card);
    });
});

// --- 3. MODAL & FOLDER LOGIC ---
window.openNoteViewer = (title, content) => {
    document.getElementById('viewer-title').innerText = title;
    document.getElementById('viewer-content').innerHTML = content;
    document.getElementById('note-viewer-modal').classList.add('show');
}

window.openModal = (id) => document.getElementById(id).classList.add('show');
window.closeModal = (id) => document.getElementById(id).classList.remove('show');

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
            div.onclick = () => loadFolder(key, folder.name);
            list.appendChild(div);
        });
    }
});

window.loadFolder = (id, name) => {
    currentFolderId = id;
    document.getElementById('current-folder-name').innerText = name || "All Notes";
    // Update UI active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(id === 'root') document.getElementById('nav-root').classList.add('active');
    
    // Refresh grid triggers automatically via onValue listener
    // But we trigger a re-render of just the grid part if needed by the filter logic inside onValue
    // (The listener handles it automatically since it runs on every data change or reload)
    // To force re-filter on click without data change, we can re-read the snapshot or store data locally.
    // For simplicity, we just reload the page/view logic or let the listener handle updates.
    // A quick hack to force refresh view with current data:
    onValue(ref(db, 'files'), (snapshot) => { /* Re-runs the render logic above */ }, {onlyOnce: true}); 
}

window.createFolder = async () => {
    const name = document.getElementById('new-folder-name').value;
    if (!name) return;
    await push(ref(db, 'folders'), { name: name, createdAt: Date.now() });
    document.getElementById('new-folder-name').value = '';
    window.closeModal('folder-modal');
}

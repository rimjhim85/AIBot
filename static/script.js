// --- ELEMENT SELECTORS ---
const messages = document.getElementById('messages');
const input = document.getElementById('user-input');
const micBtn = document.getElementById('mic-btn');
const waveContainer = document.getElementById('wave-container');
const themeBtn = document.getElementById('theme-btn');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');

// NEW SELECTORS: File picker elements
const imageInput = document.getElementById('image-input');
const previewContainer = document.getElementById('preview-container'); // Optional wrapper for displaying thumb
const imagePreview = document.getElementById('image-preview'); // Optional target element inside container

// --- 1. THEME MANAGEMENT ---
function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    updateThemeIcon(isDark);
}

themeBtn.onclick = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
};

function updateThemeIcon(isDark) {
    themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// --- 2. VOICE RECOGNITION (Speech to Text) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    
    micBtn.onclick = () => {
        try {
            recognition.start();
            micBtn.classList.add('mic-active');
            waveContainer.style.display = 'flex';
        } catch (e) {
            console.warn("Recognition already active");
        }
    };

    recognition.onresult = (event) => {
        input.value = event.results[0][0].transcript;
        sendMessage();
    };

    recognition.onend = () => {
        micBtn.classList.remove('mic-active');
        waveContainer.style.display = 'none';
    };
}

// --- 3. SPEECH SYNTHESIS (Text to Speech) ---
function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

// --- 4. COPY TO CLIPBOARD ---
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        showSuccessState(btn);
    } catch (err) {
        console.warn('Modern clipboard API failed. Running manual fallback...', err);
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; 
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showSuccessState(btn);
        } catch (fallbackErr) {
            console.error('System failed to access clipboard stack: ', fallbackErr);
        }
        document.body.removeChild(textArea);
    }
}

function showSuccessState(btn) {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.classList.add("copied");
    setTimeout(() => { 
        btn.innerHTML = originalHTML; 
        btn.classList.remove("copied");
    }, 2000);
}

// --- 5. UI HELPERS (Typing & Scrolling) ---
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-bubble bot';
    typingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    messages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}

// NEW INTERACTION: Show image preview before sending if a file is picked
if (imageInput) {
    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file && imagePreview && previewContainer) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                previewContainer.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    });
}

// --- 6. CHAT CORE LOGIC ---
// CHANGED: Added dynamic handling for rendering image paths inside the message blocks
function addMessage(text, role, imageUrl = null) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    
    // Render image if one was passed in
    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'chat-attached-image';
        img.style.maxWidth = '200px';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '5px';
        img.style.display = 'block';
        div.appendChild(img);
    }

    if (text) {
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        div.appendChild(textSpan);
    }

    if (role === 'bot') {
        const actionContainer = document.createElement('div');
        actionContainer.className = 'bot-actions';

        const listenBtn = document.createElement('button');
        listenBtn.className = 'action-link';
        listenBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
        listenBtn.onclick = () => speak(text);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-link';
        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
        copyBtn.onclick = () => copyToClipboard(text, copyBtn);

        actionContainer.appendChild(listenBtn);
        actionContainer.appendChild(copyBtn);
        div.appendChild(actionContainer);
    }

    messages.appendChild(div);
    scrollToBottom();
}

async function sendMessage() {
    const text = input.value.trim();
    const fileSelected = imageInput && imageInput.files ? imageInput.files[0] : null;
    
    if (!text && !fileSelected) return;

    // Use absolute dynamic blob generation for rendering user image bubble instantly
    let localImageBlobUrl = null;
    if (fileSelected) {
        localImageBlobUrl = URL.createObjectURL(fileSelected);
    }

    // Add local user bubble message
    addMessage(text, 'user', localImageBlobUrl);
    
    // Prepare FormData stack container properties
    const formData = new FormData();
    formData.append('message', text);
    if (fileSelected) {
        formData.append('image', fileSelected);
    }

    // Reset components immediately
    input.value = '';
    if (imageInput) imageInput.value = '';
    if (previewContainer) previewContainer.style.display = 'none';
    
    input.disabled = true;
    const typingIndicator = showTypingIndicator();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            body: formData // Browser auto handles Multi-Part boundary configurations here
        });
        
        const data = await res.json();
        typingIndicator.remove();
        addMessage(data.reply, 'bot');
    } catch (e) {
        typingIndicator.remove();
        addMessage("Connection error. Check your server.", 'bot');
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// --- 7. EVENT LISTENERS ---
sendBtn.onclick = sendMessage;

clearBtn.onclick = () => { 
    if(confirm("Clear conversation?")) {
        messages.innerHTML = '';
        addMessage("Chat history cleared. How can I help?", "bot");
    }
};

input.onkeypress = (e) => { 
    if(e.key === 'Enter') sendMessage(); 
};

initTheme();
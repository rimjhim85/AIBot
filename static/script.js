// --- ELEMENT SELECTORS ---
const messages = document.getElementById('messages');
const input = document.getElementById('user-input');
const micBtn = document.getElementById('mic-btn');
const waveContainer = document.getElementById('wave-container');
const themeBtn = document.getElementById('theme-btn');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');

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
    // You can customize voice here: utterance.pitch = 1; utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
}

// --- 4. COPY TO CLIPBOARD ---
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.style.color = "#28a745"; // Success green
        setTimeout(() => { 
            btn.innerHTML = originalHTML; 
            btn.style.color = "";
        }, 2000);
    } catch (err) {
        console.error('Clipboard error: ', err);
    }
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

// --- 6. CHAT CORE LOGIC ---
function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    
    const textSpan = document.createElement('span');
    textSpan.innerText = text;
    div.appendChild(textSpan);

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
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';
    
    input.disabled = true;
    const typingIndicator = showTypingIndicator();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({message: text})
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

// Initialize theme on load
initTheme();
const pb = new PocketBase();
let unsubscribe = null;

// Auth Functions
async function login() {
    try {
        await pb.collection('users').authWithPassword(
            document.getElementById('email').value,
            document.getElementById('password').value
        );
        initChat();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (password !== passwordConfirm) {
        return alert('Passwords do not match!');
    }

    try {
        await pb.collection('users').create({
            username,
            email,
            password,
            passwordConfirm,
            emailVisibility: true
        });
        alert('Registration successful! Please login.');
        showLogin();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

function logout() {
    pb.authStore.clear();
    document.getElementById('chat-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
}

// Chat Functions
async function initChat() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';

    // Load messages
    const messages = await pb.collection('messages').getFullList({
        sort: '-created',
        expand: 'user'
    });

    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    messages.reverse().forEach(msg => addMessage(msg));
    scrollToBottom(true);

    // Real-time updates
    unsubscribe = pb.collection('messages').subscribe('*', async (e) => {
        try {
            if (e.action === 'delete') {
                document.querySelector(`[data-id="${e.record.id}"]`)?.remove();
            } else {
                const msg = await pb.collection('messages').getOne(e.record.id, { expand: 'user' });
                const existing = document.querySelector(`[data-id="${msg.id}"]`);
                if (existing) existing.remove();
                addMessage(msg);
                if (e.action === 'create') scrollToBottom();
            }
        } catch (error) {
            console.error('Real-time error:', error);
        }
    });

    // Search functionality
    document.getElementById('search-input').addEventListener('input', async (e) => {
        const results = await pb.collection('messages').getFullList({
            filter: `message ~ "${e.target.value}"`,
            expand: 'user'
        });
        document.getElementById('messages').innerHTML = '';
        results.reverse().forEach(msg => addMessage(msg));
    });
}
// Toggle search bar
function toggleSearch() {
    const searchContainer = document.getElementById('search-container');
    const isVisible = searchContainer.style.display === 'flex';
    searchContainer.style.display = isVisible ? 'none' : 'flex';
    document.querySelector('.chat-header').style.display = isVisible ? 'flex' : 'none';
    if (!isVisible) document.getElementById('search-input').focus();
}

// Add these SVG icons for message actions
const actionIcons = {
    reply: `<svg viewBox="0 0 24 24"><path d="M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>`
};

// Message Handling
function addMessage(msg) {
    const isOwn = msg.expand.user.id === pb.authStore.model.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    messageDiv.dataset.id = msg.id;
    

    messageDiv.innerHTML = `
        <div class="message-avatar">${getInitials(msg.expand.user.username)}</div>
        <div class="message-content">
            <div class="message-text">${linkify(msg.message)}</div>
            <div class="message-info">
                <span>${msg.expand.user.username}</span>
                <span>${formatDate(msg.created)}</span>
                ${msg.edited ? '<span class="edited-indicator">(edited)</span>' : ''}
            </div>
            <div class="message-actions">
                <button class="action-button" onclick="replyToMessage('${msg.id}')">
                    ${actionIcons.reply}
                </button>
                ${canEdit(msg) ? `
                <button class="action-button" onclick="editMessage('${msg.id}')">
                    ${actionIcons.edit}
                </button>` : ''}
                ${canDelete(msg) ? `
                <button class="action-button" onclick="deleteMessage('${msg.id}')">
                    ${actionIcons.delete}
                </button>` : ''}
            </div>;
        </div>
    `;
    
    document.getElementById('messages').appendChild(messageDiv);
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message) {
        try {
            await pb.collection('messages').create({
                user: pb.authStore.model.id,
                message
            });
            input.value = '';
        } catch (error) {
            alert('Failed to send message: ' + error.message);
        }
    }
}

// Message Actions
async function editMessage(messageId) {
    try {
        const message = await pb.collection('messages').getOne(messageId);
        const newText = prompt('Edit your message:', message.message);
        if (newText && newText !== message.message) {
            await pb.collection('messages').update(messageId, {
                message: newText,
                edited: new Date().toISOString()
            });
        }
    } catch (error) {
        alert('Failed to edit message: ' + error.message);
    }
}

async function deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
        try {
            await pb.collection('messages').delete(messageId);
        } catch (error) {
            alert('Failed to delete message: ' + error.message);
        }
    }
}

// Helpers
function getInitials(username) {
    return username.split(' ').map(n => n[0]).join('').toUpperCase();
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            day: '2-digit',
            month: 'short'
        });
    } catch {
        return '';
    }
}

function linkify(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function scrollToBottom(instant = false) {
    const messages = document.getElementById('messages');
    messages.scrollTo({
        top: messages.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
    });
}

function canEdit(msg) {
    return pb.authStore.model.id === msg.user || pb.authStore.model.admin;
}

function canDelete(msg) {
    return pb.authStore.model.admin;
}

function showSignup() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('signup-container').style.display = 'block';
}

function showLogin() {
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (pb.authStore.isValid) {
        initChat();
    } else {
        pb.authStore.loadFromCookie(document.cookie);
        if (pb.authStore.isValid) {
            initChat();
        }
    }
});

const pb = new PocketBase();
let unsubscribe = null;

// Core Functions
async function init() {
    try {
        pb.authStore.loadFromCookie(localStorage.getItem('pb_auth'));
        if(pb.authStore.isValid) {
            await pb.collection('users').authRefresh();
            showChat();
            setupRealtime();
            loadMessages();
        } else {
            showAuth();
        }
    } catch (err) {
        showAuth();
    }
}


// Auth Functions
async function handleLogin() {
    try {
        const user = await pb.collection('users').authWithPassword(
            document.getElementById('email').value,
            document.getElementById('password').value
        );
        // Save auth cookie
        localStorage.setItem('pb_auth', pb.authStore.exportToCookie());

         // Reset and password field
        document.getElementById('password').value = '';

        showChat();
        setupRealtime();
        loadMessages();
    } catch (err) {
        alert('Login failed: ' + err.message);
    }
}

async function handleSignup() {
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (password !== passwordConfirm) {
        alert('Passwords do not match!');
        return;
    }

    try {
        await pb.collection('users').create({ username, email, password, passwordConfirm });
        const user = await pb.collection('users').authWithPassword(email, password);
        // Save auth cookie
        localStorage.setItem('pb_auth', pb.authStore.exportToCookie());
        showChat();
        setupRealtime();
        loadMessages();
    } catch (err) {
        alert('Signup failed: ' + err.message);
    }
}

function logout() {
    // Clear auth store
    pb.authStore.clear();
    localStorage.removeItem('pb_auth');
    // Cleanup realtime
    if (unsubscribe) pb.collection('messages').unsubscribe();
    // Show Login
    showAuth();
}

function setupRealtime() {
    unsubscribe = pb.collection('messages').subscribe('*', async (e) => {
        let msg;
        // If the event is a deletion, avoid fetching the record (which no longer exists)
        if (e.action === 'delete') {
            msg = { id: e.record.id };
        } else {
            try {
                msg = await pb.collection('messages').getOne(e.record.id, { expand: 'user' });
            } catch (err) {
                console.error('Error fetching message:', err);
                return;
            }
        }
        handleMessage(msg, e.action);
    });
}


function handleMessage(msg, action) {
    const container = document.getElementById('messages');
    
    switch (action) {
        case 'create':
            container.appendChild(createMessageElement(msg));
            break;
        case 'update':
            const existing = document.querySelector(`[data-id="${msg.id}"]`);
            if (existing) existing.replaceWith(createMessageElement(msg));
            break;
        case 'delete':
            const messageEl = document.querySelector(`[data-id="${msg.id}"]`);
            if (messageEl) {
                messageEl.innerHTML = `
                    <div class="message-deleted">Message deleted</div>
                `;
            }
            //document.querySelector(`[data-id="${msg.id}"]`)?.remove();
            break;
    }
    scrollToBottom();
}

// Message Handling
async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        await pb.collection('messages').create({
            user: pb.authStore.model.id,
            message: text
        });
        input.value = '';
    }
}

function createMessageElement(msg) {
    const div = document.createElement('div');
    const isOwnMessage = msg.expand.user.id === pb.authStore.model.id;
    // Using a template literal to conditionally add a class for own messages
    div.className = `message ${isOwnMessage ? 'own' : ''}`;
    div.dataset.id = msg.id;
    const bgColor = getUniqueColor(msg.expand.user.username);

    div.innerHTML = `
    <div class="message-avatar">${getInitials(msg.expand.user.username)}</div>
    <div class="message-content">
      <div class="message-username">${msg.expand.user.username}</div>
      <div>${linkify(msg.message)}</div>
      <div class="message-info">
        <span>${formatDate(msg.created)}</span>
      </div>
    </div>
    <div class="message-menu">
      <div class="message-reaction">
        <i class="hidden message-menu-icon" data-feather="heart"></i>
      </div>
      <div class="message-reply">
        <i class="hidden message-menu-icon" data-feather="corner-up-left"></i>
      </div>
      <div class="message-edit">
        <i class="message-menu-icon" data-feather="edit-2"></i>
      </div>
      <div class="message-delete icon-alert">
        <i class="message-menu-icon" data-feather="trash"></i>
      </div>
    </div>
  `;

    // For own messages, hide the username/avatar; for others, hide edit/delete
    if (isOwnMessage) {
        const avatarEl = div.querySelector('.message-avatar');
        const usernameEl = div.querySelector('.message-username');
        if (usernameEl) usernameEl.style.display = 'none';
        if (avatarEl) avatarEl.style.display = 'none';
    } else {
        const messageEdit   = div.querySelector('.message-edit');
        const messageDelete = div.querySelector('.message-delete');
        if (messageEdit) messageEdit.style.display = 'none';
        if (messageDelete) messageDelete.style.display = 'none';
    }

    // Attach event listeners to the parent divs instead of icons
    const editButton = div.querySelector('.message-edit');
    const deleteButton = div.querySelector('.message-delete');

    if (editButton) {
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            editMessage(msg.id);
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteMessage(msg.id);
        });
    }

    // Return the newly created element so it can be appended to the DOM later
    return div;
}

async function editMessage(messageId) {
  const newText = prompt('Edit your message:');
  if (newText) {
    await pb.collection('messages').update(messageId, {
      message: newText
    });
  }
}

async function deleteMessage(messageId) {
  if (confirm('Are you sure you want to delete this message?')) {
    try {
      await pb.collection('messages').delete(messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }
}

// UI Helpers
function showChat() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    // Set focus on the message input field
    document.getElementById('message-input').focus();
}

function showAuth() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

async function loadMessages() {
    const messages = await pb.collection('messages').getFullList({
        sort: '-created',
        expand: 'user'
    });
    
    const container = document.getElementById('messages');
    container.innerHTML = '';
    messages.reverse().forEach(msg => {
        container.appendChild(createMessageElement(msg));
    });
    feather.replace();
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('messages');
    container.scrollTo(0, container.scrollHeight);
}

function getInitials(username) {
    return username.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Returns a unique color based on the username
function getUniqueColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // You can adjust saturation and lightness as desired.
  return `hsl(${hue}, 70%, 60%)`;
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

function canEdit(msg) {
    return pb.authStore.model.id === msg.user;
}

function canDelete(msg) {
    //return pb.authStore.model.id === msg.user || pb.authStore.model.admin;
    return pb.authStore.model.id === msg.user
}


// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the app
    init();

    // Load icons
    feather.replace();

    // Authentication button events
    document.getElementById('login-button').addEventListener('click', handleLogin);
    document.getElementById('signup-button').addEventListener('click', handleSignup);
    document.getElementById('logout-button').addEventListener('click', logout);

    // Toggle between login and signup forms
    document.getElementById('show-signup').addEventListener('click', () => {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    });
    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });

    // Message sending functionality
    //const sendMessage = () => {
    //  const message = messageInput.value.trim();
    //  if (message) {
    //    console.log('Sent:', message);
    //    messageInput.value = '';
    //  }
    //};
    
    // Login on pressing Enter on wider screens
    inputs = document.querySelectorAll('#login-form input');
    inputs.forEach(input => {
        input.addEventListener('keydown', e => {
            if (window.innerWidth > 810 && e.key === 'Enter') {
                e.preventDefault();
                handleLogin(); 
            }
        });
    });

    // Signup on pressing Enter on wider screens
    inputs = document.querySelectorAll('#signup-form input');
    inputs.forEach(input => {
        input.addEventListener('keydown', e => {
            if (window.innerWidth > 810 && e.key === 'Enter') {
                e.preventDefault();
                handleSignup(); 
            }
        });
    });

    // Send message on pressing Enter (when not using Shift+Enter on wider screens)
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('keydown', e => {
        if (window.innerWidth > 810 && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send message on button click
    document.getElementById('send-button').addEventListener('click', sendMessage);

});

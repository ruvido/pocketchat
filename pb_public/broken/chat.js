// Add these SVG icons for message actions
const actionIcons = {
    reply: `<svg viewBox="0 0 24 24"><path d="M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>`
};

// chat.js
const pb = new PocketBase('http://localhost:8090');
let unsubscribe = null;

// Core Initialization
async function init() {
  try {
    // Check existing auth
    pb.authStore.loadFromCookie(document.cookie);
    
    if (pb.authStore.isValid) {
      await pb.collection('users').authRefresh();
      showChat();
      connectRealtime();
    } else {
      showAuth();
    }
  } catch (err) {
    showAuth();
  }
}

// Auth Functions
async function handleLogin() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    alert('Please fill in both fields');
    return;
  }

  try {
    await pb.collection('users').authWithPassword(email, password);
    showChat();
    connectRealtime();
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  if (!username || !email || !password || !passwordConfirm) {
    alert('Please fill all fields');
    return;
  }

  if (password !== passwordConfirm) {
    alert('Passwords do not match');
    return;
  }

  try {
    await pb.collection('users').create({
      username,
      email,
      password,
      passwordConfirm,
      emailVisibility: true
    });
    await handleLogin(email, password);
  } catch (err) {
    alert('Signup failed: ' + err.message);
  }
}

function logout() {
  pb.authStore.clear();
  if (unsubscribe) unsubscribe();
  showAuth();
}

// Realtime Handling
function connectRealtime() {
  unsubscribe = pb.collection('messages').subscribe('*', async (e) => {
    const msg = await pb.collection('messages').getOne(e.record.id, { expand: 'user' });
    handleMessageUpdate(msg, e.action);
  });
}

function handleMessageUpdate(msg, action) {
  const container = document.getElementById('messages');
  
  switch (action) {
    case 'create':
      container.appendChild(createMessageElement(msg));
      scrollToBottom();
      break;
    case 'update':
      const existing = document.querySelector(`[data-id="${msg.id}"]`);
      if (existing) existing.replaceWith(createMessageElement(msg));
      break;
    case 'delete':
      document.querySelector(`[data-id="${msg.id}"]`)?.remove();
      break;
  }
}

// Message Handling
async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if (text) {
    try {
      await pb.collection('messages').create({
        user: pb.authStore.model.id,
        message: text
      });
      input.value = '';
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    }
  }
}

function createMessageElement(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.expand.user.id === pb.authStore.model.id ? 'own' : ''}`;
  div.dataset.id = msg.id;
  
  div.innerHTML = `
    <div class="message-content">
      <div class="message-text">${linkify(msg.message)}</div>
      <div class="message-info">
        <span>${msg.expand.user.username}</span>
        <span>${new Date(msg.created).toLocaleTimeString()}</span>
        ${msg.edited ? '<span>(edited)</span>' : ''}
      </div>
      <div class="message-actions">
        ${pb.authStore.model.id === msg.user ? `
          <button onclick="editMessage('${msg.id}')">Edit</button>
          <button onclick="deleteMessage('${msg.id}')">xxDelete</button>
        ` : ''}
      </div>
    </div>
  `;
  
  return div;
}

async function editMessage(id) {
  const newText = prompt('Edit message:');
  if (newText) {
    try {
      await pb.collection('messages').update(id, { 
        message: newText, 
        edited: new Date() 
      });
    } catch (err) {
      alert('Failed to edit message: ' + err.message);
    }
  }
}

async function deleteMessage(id) {
  if (confirm('Delete this message?')) {
    try {
      await pb.collection('messages').delete(id);
    } catch (err) {
      alert('Failed to delete message: ' + err.message);
    }
  }
}

// UI Helpers
function showChat() {
  document.getElementById('auth-container').hidden = true;
  document.getElementById('chat-container').hidden = false;
  loadMessages();
}

function showAuth() {
  document.getElementById('auth-container').hidden = false;
  document.getElementById('chat-container').hidden = true;
}

async function loadMessages() {
  try {
    const messages = await pb.collection('messages').getFullList({
      sort: '-created',
      expand: 'user'
    });
    
    const container = document.getElementById('messages');
    container.innerHTML = '';
    messages.reverse().forEach(msg => {
      container.appendChild(createMessageElement(msg));
    });
    scrollToBottom(true);
  } catch (err) {
    alert('Failed to load messages: ' + err.message);
  }
}

function scrollToBottom(instant = false) {
  const container = document.getElementById('messages');
  container.scrollTo({
    top: container.scrollHeight,
    behavior: instant ? 'auto' : 'smooth'
  });
}

function linkify(text) {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', init);

document.getElementById('login-button').addEventListener('click', handleLogin);
document.getElementById('signup-button').addEventListener('click', handleSignup);
document.getElementById('logout-button').addEventListener('click', logout);

document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById('show-signup').addEventListener('click', () => {
  document.getElementById('login-container').hidden = true;
  document.getElementById('signup-container').hidden = false;
});

document.getElementById('show-login').addEventListener('click', () => {
  document.getElementById('signup-container').hidden = true;
  document.getElementById('login-container').hidden = false;
});



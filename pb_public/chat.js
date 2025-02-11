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

    //// Show login and hide chat
    //document.getElementById('chat-container').style.display = 'none';
    //document.getElementById('login-container').style.display = 'block';
    //
    //// Clear form fields
    //document.getElementById('email').value = '';
    //document.getElementById('password').value = '';
}

// Realtime Handling
function setupRealtime() {
    unsubscribe = pb.collection('messages').subscribe('*', async (e) => {
        const msg = await pb.collection('messages').getOne(e.record.id, { expand: 'user' });
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
            document.querySelector(`[data-id="${msg.id}"]`)?.remove();
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


// Add these SVG icons for message actions
const actionIcons = {
    reply: `<svg viewBox="0 0 24 24"><path d="M10,9V5L3,12L10,19V14.9C15,14.9 18.5,16.5 21,20C20,15 17,10 10,9Z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>`
};


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

    // Attach click event listeners using relative selectors

    const editIcon = div.querySelector('.message-edit');
    const deleteIcon = div.querySelector('.message-delete');

    if (editIcon) {
        editIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            //editMessage(msg.id);
            console.log("edit")
        });
    }

    if (deleteIcon) {
        deleteIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            //deleteMessage(msg.id);
            console.log("delete")
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
    await pb.collection('messages').delete(messageId);
  }
}


//function createMessageElement(msg) {
//    const div = document.createElement('div');
//    const isOwnMessage = msg.expand.user.id === pb.authStore.model.id;
//    div.className = `message ${isOwnMessage ? 'own' : ''}`;
//    //div.className = `message ${msg.expand.user.id === pb.authStore.model.id ? 'own' : ''}`;
//    div.dataset.id = msg.id;
//    const bgColor = getUniqueColor(msg.expand.user.username);
//
//    div.innerHTML = `
//            <div id="message-avatar">${getInitials(msg.expand.user.username)}</div>
//            <div class="message-content">
//                <div id="message-username">${msg.expand.user.username}</div>
//                <div>${linkify(msg.message)}</div>
//                <div class="message-info">
//                    <span>${formatDate(msg.created)}</span>
//                </div>
//            </div>
//            <div id="message-menu">
//                <i id="message-reaction" class="message-menu-icon hidden" data-feather="heart"></i>
//                <i id="message-reply"    class="message-menu-icon hidden" data-feather="corner-up-left"></i>
//                <i id="message-edit"     class="message-menu-icon" data-feather="edit-2"></i>
//                <i id="message-delete"   class="message-menu-icon icon-alert" data-feather="trash"></i>
//            </div>
//    `;
//    // If the message is owned by the current user, hide the username element
//    // replace the avatar with a 3-dots menu icon
//    if (isOwnMessage) {
//        const avatarEl = div.querySelector('#message-avatar');
//        const usernameEl = div.querySelector('#message-username');
//        if (usernameEl) usernameEl.style.display = 'none';
//        if (avatarEl) avatarEl.style.display = 'none';
//    } else {
//        const messageEdit   = div.querySelector('#message-edit');
//        const messageDelete = div.querySelector('#message-delete');
//        if (messageEdit) messageEdit.style.display = 'none';
//        if (messageDelete) messageDelete.style.display = 'none';
//    }
//    // Interactions with messages
//    const reactionIcon  = document.getElementById('message-reaction');
//    const replyIcon     = document.getElementById('message-reply');
//    const editIcon      = document.getElementById('message-edit');
//    const deleteIcon    = document.getElementById('message-delete');
//    // Attach click event listeners to each icon
//    if (editIcon) {
//        editIcon.addEventListener('click', function() {
//            console.log('edit');
//        });
//    }
//    if (deleteIcon) {
//        deleteIcon.addEventListener('click', function() {
//            console.log('delete');
//        });
//    }
//        //if (avatarEl) {
//        //    avatarEl.innerHTML = '…';
//        //    avatarEl.classList.add('message-menu-icon');
//        //
//        //    // (Optional) Add a click handler to trigger your menu
//        //    avatarEl.addEventListener('click', function() {
//        //        // Open your menu here. For example:
//        //        // showMessageMenu(msg.id);
//        //        console.log("Menu clicked for message", msg.id);
//        //    });
//        //}
//                //${canEdit(msg) ? `<button style="width: 18px;" onclick="editMessage('${msg.id}')">${actionIcons.edit}</button>` : ''}
//                //${canDelete(msg) ? `<button style="width: 18px;" onclick="deleteMessage('${msg.id}')">${actionIcons.delete}</button>` : ''}
//
//    return div;
//}

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

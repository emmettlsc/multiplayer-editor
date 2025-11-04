// Polyfills for Node.js built-ins required by simple-peer
import { Buffer } from 'buffer';
import process from 'process';

globalThis.Buffer = Buffer;
globalThis.process = process;

import { GoogleAuth } from './auth';
import { CollaborativeEditor } from './editor';

const CONFIG = {
  googleClientId: '516492490729-tsncid3dcaoefnsra3450l4qs2h48l0n.apps.googleusercontent.com',
  redirectUri: 'http://localhost:3000',

  // Signaling server WebSocket URL
  // local testing: ws://localhost:8080/room/{roomId}
  // AWS testing: wss://52.207.226.41/room/{roomId}
  signalingServerUrl: 'ws://localhost:8080/room/',
};

const auth = new GoogleAuth({
  clientId: CONFIG.googleClientId,
  redirectUri: CONFIG.redirectUri,
});

let editor: CollaborativeEditor | null = null;

// UI 
const loginScreen = document.getElementById('login-screen')!;
const editorScreen = document.getElementById('editor-screen')!;
const loginBtn = document.getElementById('login-btn')!;
const loginError = document.getElementById('login-error')!;
const roomInput = document.getElementById('room-input') as HTMLInputElement;
const editorContainer = document.getElementById('editor-container')!;
const currentRoomEl = document.getElementById('current-room')!;
const currentUserEl = document.getElementById('current-user')!;

// Check if we have a token from redirect
const token = auth.getTokenFromUrl();

if (token) {
  auth.clearToken();
  initEditor(token);
} else {
  // Show login screen
  loginBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (!roomId) {
      loginError.textContent = 'Please enter a room ID';
      return;
    }

    // Store room ID for after redirect
    localStorage.setItem('pendingRoomId', roomId);

    // Start OAuth flow
    auth.login();
  });
}

function initEditor(token: string) {
  const roomId = localStorage.getItem('pendingRoomId') || 'demo-room';
  localStorage.removeItem('pendingRoomId');

  // Decode token to get email (simple decoding, validation happens server-side)
  const payload = JSON.parse(atob(token.split('.')[1]));
  const email = payload.email;

  // Show editor screen
  loginScreen.style.display = 'none';
  editorScreen.classList.add('active');

  // Update UI
  currentRoomEl.textContent = roomId;
  currentUserEl.textContent = email;

  // Initialize collaborative editor
  const wsUrl = `${CONFIG.signalingServerUrl}${roomId}`;
  editor = new CollaborativeEditor(
    editorContainer,
    roomId,
    email,
    wsUrl,
    token
  );
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  editor?.destroy();
});

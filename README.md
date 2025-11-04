# P2P Collaborative Editor

Authenticated WebRTC-based collaborative code editor using Google OAuth, WebSocket signaling, and Yjs.

## Quick Start

1. **Google OAuth Setup** - See [SETUP.md](./SETUP.md#1-google-oauth-setup)
2. **Install dependencies:**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
3. **Configure client** - Edit `client/src/main.ts` with your Google Client ID
4. **Run locally:**
   ```bash
   # Terminal 1
   cd server && npm run dev

   # Terminal 2
   cd client && npm run dev
   ```
5. Open `http://localhost:3000` in two browsers and test

## Architecture

```
Browser A                     Signaling Server                Browser B
    |                                |                             |
    |--[1] WSS + JWT--------------->|                             |
    |                [Verify JWT]    |                             |
    |<--[2] Welcome------------------|                             |
    |                                |<--[1] WSS + JWT-------------|
    |                                |      [Verify JWT]           |
    |                                |--[2] Welcome--------------->|
    |<--[3] peer-joined--------------|--[3] peer-joined---------->|
    |                                                               |
    |<===========WebRTC P2P Connection (Yjs sync)================>|
```

## Key Features

- **Google OIDC Auth**: Users authenticate with Google before joining
- **JWT Verification**: Server validates tokens using Google's JWKS
- **WebRTC P2P**: Direct browser-to-browser connections for document sync
- **Yjs CRDT**: Conflict-free collaborative editing
- **Monaco Editor**: VS Code-like editing experience

## File Structure

```
├── client/
│   ├── src/
│   │   ├── main.ts      - App entry, handles login flow
│   │   ├── auth.ts      - Google OAuth implementation
│   │   └── editor.ts    - Yjs + WebRTC collaboration logic
│   └── index.html       - UI layout
└── server/
    ├── server.ts        - WebSocket signaling server
    └── auth.ts          - JWT verification with Google JWKS
```

## Deployment

See [SETUP.md](./SETUP.md) for:
- AWS server deployment instructions
- SSL/TLS setup for production
- Firewall configuration
- Troubleshooting guide

## How It Works

1. **Authentication**: User clicks "Sign in with Google" → OAuth flow → receives JWT
2. **Connect**: Client connects to WebSocket server with JWT in URL
3. **Verify**: Server validates JWT against Google's public keys
4. **Signal**: Server relays WebRTC signaling messages between authorized peers
5. **P2P Sync**: Peers establish direct WebRTC connections and sync via Yjs

The server **never sees document content** - all editing happens peer-to-peer.

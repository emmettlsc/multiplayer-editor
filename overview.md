# Authenticated P2P Collaborative Editor

## Idea: a dummy proof of concept app

WebRTC multiplayer editor where users authenticate via OIDC before establishing peer-to-peer connections. The signaling server does this verifying identity before allowing peers to connect (?is this correct?)

## Components

### Client (Browser)
- **OIDC Login**: User authenticates with Google, receives JWT token
- **PeerJS Client**: Establishes WebRTC connections using authenticated identity
- **Yjs Document**: Handles all the editor syncing stuff, they have examples online doing multiplayer editing, can prob copy paste a lot 
- **Editor UI**: Monaco

### Signaling Server
- **WebSocket Server**: Accepts connections at `wss://52.207.226.41/room/{roomId}?token={JWT}` (TODO: use Ivan's server)
- **JWT Verification**: Google has JWKS endpoint, we should be using this to do verification
- **TODO: how to know user is authorized for the room?**
- **PeerJS Part**: relay peer discovery messages for authorized users

## User flow 
```text
1. Login Phase
   Browser → Google OAuth → Get JWT → Store Token

2. Join Room
   Browser → WSS + JWT → Server validates → Check allowlist → Admit or reject

3. Peer Discovery
   Server relays: "Alice (alice@gmail.com) wants to connect to Bob (bob@gmail.com)"
   
4. P2P Connection
   Browser A ←------ WebRTC DataChannel -----→ Browser B
   (Yjs sync happens here, server never sees document content)
```

## File Structure
```
project/
├── client/
│   ├── index.html          (login + editor UI)
│   ├── auth.ts             (OIDC flow with Google)
│   └── editor.ts           (PeerJS + Yjs integration)
│
└── server/
    ├── server.ts           (WebSocket signaling server)
    ├── auth.ts             (JWT verification)
    ├── allowlist.ts        (room access control)
    └── package.json        (dependencies)
```

## For This Demo

We'll implement:
1. Simple OIDC login (get JWT from Google)
2. Signaling server that checks JWT before admitting
3. PeerJS connections between verified users
4. Yjs collaborative editing over those connections

Simplified from spec:
- Hardcoded allowlist (not per-room management UI)
- No STUN/TURN credential issuing (use PeerJS defaults)
- Basic error handling
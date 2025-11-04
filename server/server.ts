import { WebSocketServer, WebSocket } from 'ws';
import { verifyGoogleToken, isUserAllowed } from './auth.js';
import * as http from 'http';
import * as url from 'url';

interface AuthenticatedClient {
  ws: WebSocket;
  email: string;
  roomId: string;
}

const clients = new Map<WebSocket, AuthenticatedClient>();
const rooms = new Map<string, Set<WebSocket>>();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebRTC Signaling Server Running\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  const parsedUrl = url.parse(req.url || '', true);
  const pathParts = parsedUrl.pathname?.split('/') || [];

  // Expected: /room/{roomId}
  if (pathParts[1] !== 'room' || !pathParts[2]) {
    ws.close(1008, 'Invalid path. Expected: /room/{roomId}');
    return;
  }

  const roomId = pathParts[2];
  const token = parsedUrl.query.token as string;

  if (!token) {
    ws.close(1008, 'Missing token parameter');
    return;
  }

  try {
    // Verify JWT token
    const payload = await verifyGoogleToken(token);

    if (!payload.email_verified) {
      ws.close(1008, 'Email not verified');
      return;
    }

    if (!isUserAllowed(payload.email)) {
      ws.close(1008, 'User not authorized for this room');
      return;
    }

    // Authentication successful
    const clientInfo: AuthenticatedClient = {
      ws,
      email: payload.email,
      roomId,
    };

    clients.set(ws, clientInfo);

    // Add to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(ws);

    console.log(`${payload.email} joined room ${roomId}`);

    // Notify user of successful connection
    ws.send(JSON.stringify({
      type: 'welcome',
      email: payload.email,
      roomId,
      peersInRoom: rooms.get(roomId)!.size - 1,
    }));

    // Broadcast to other peers in the room
    broadcastToRoom(roomId, ws, {
      type: 'peer-joined',
      email: payload.email,
    });

    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Relay peer discovery messages
        if (message.type === 'signal' || message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate') {
          // Forward to specific peer or broadcast
          if (message.to) {
            // Send to specific peer
            const targetClient = findClientByEmail(roomId, message.to);
            if (targetClient) {
              targetClient.send(JSON.stringify({
                ...message,
                from: clientInfo.email,
              }));
            }
          } else {
            // Broadcast to all in room except sender
            broadcastToRoom(roomId, ws, {
              ...message,
              from: clientInfo.email,
            });
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        console.log(`✗ ${client.email} left room ${client.roomId}`);

        // Remove from room
        rooms.get(client.roomId)?.delete(ws);
        if (rooms.get(client.roomId)?.size === 0) {
          rooms.delete(client.roomId);
        }

        // Notify others
        broadcastToRoom(client.roomId, ws, {
          type: 'peer-left',
          email: client.email,
        });

        clients.delete(ws);
      }
    });

  } catch (err) {
    console.error('Authentication failed:', err);
    ws.close(1008, 'Invalid or expired token');
  }
});

function broadcastToRoom(roomId: string, sender: WebSocket, message: any) {
  const roomClients = rooms.get(roomId);
  if (!roomClients) return;

  const messageStr = JSON.stringify(message);
  roomClients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

function findClientByEmail(roomId: string, email: string): WebSocket | null {
  const roomClients = rooms.get(roomId);
  if (!roomClients) return null;

  for (const ws of roomClients) {
    const client = clients.get(ws);
    if (client?.email === email) {
      return ws;
    }
  }
  return null;
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/room/{roomId}?token={JWT}`);
});

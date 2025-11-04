import * as Y from 'yjs';
import * as monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import SimplePeer from 'simple-peer';

// Configure Monaco Editor workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

export class CollaborativeEditor {
  private ydoc: Y.Doc;
  private ytext: Y.Text;
  private editor: monaco.editor.IStandaloneCodeEditor;
  private binding: MonacoBinding;
  private ws: WebSocket;
  private peers: Map<string, SimplePeer.Instance> = new Map();
  private roomId: string;
  private email: string;

  constructor(
    container: HTMLElement,
    roomId: string,
    email: string,
    wsUrl: string,
    token: string
  ) {
    this.roomId = roomId;
    this.email = email;

    // Initialize Yjs document
    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('monaco');

    // Initialize Monaco editor
    this.editor = monaco.editor.create(container, {
      value: '',
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: true,
    });

    // Bind Monaco to Yjs
    this.binding = new MonacoBinding(
      this.ytext,
      this.editor.getModel()!,
      new Set([this.editor]),
      null as any
    );

    // Connect to signaling server
    const wsWithToken = `${wsUrl}?token=${token}`;
    this.ws = new WebSocket(wsWithToken);

    this.ws.onopen = () => {
      console.log('Connected to signaling server');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
    };

    // Listen for Yjs updates to send to peers
    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        // Broadcast update to all peers
        this.broadcastUpdate(update);
      }
    });
  }

  private handleSignalingMessage(message: any) {
    console.log('Signaling message:', message.type, message);

    switch (message.type) {
      case 'welcome':
        console.log(`Joined room ${message.roomId} as ${message.email}`);
        this.updatePeerCount(message.peersInRoom);
        break;

      case 'peer-joined':
        console.log(`Peer joined: ${message.email}`);
        // Initiator creates offer
        if (message.email !== this.email) {
          this.createPeerConnection(message.email, true);
        }
        break;

      case 'peer-left':
        console.log(`Peer left: ${message.email}`);
        this.removePeer(message.email);
        break;

      case 'offer':
        this.handleOffer(message.from, message.offer);
        break;

      case 'answer':
        this.handleAnswer(message.from, message.answer);
        break;

      case 'ice-candidate':
        this.handleIceCandidate(message.from, message.candidate);
        break;
    }
  }

  private createPeerConnection(peerEmail: string, initiator: boolean) {
    if (this.peers.has(peerEmail)) {
      return;
    }

    const peer = new SimplePeer({
      initiator,
      trickle: true,
    });

    peer.on('signal', (signal) => {
      const type = signal.type === 'offer' ? 'offer' : signal.type === 'answer' ? 'answer' : 'ice-candidate';
      this.ws.send(JSON.stringify({
        type,
        to: peerEmail,
        [signal.type === 'offer' ? 'offer' : signal.type === 'answer' ? 'answer' : 'candidate']: signal,
      }));
    });

    peer.on('connect', () => {
      console.log(`P2P connected with ${peerEmail}`);
      this.updatePeerCount(this.peers.size);

      // Send current document state to new peer
      if (initiator) {
        const state = Y.encodeStateAsUpdate(this.ydoc);
        peer.send(state);
      }
    });

    peer.on('data', (data: Uint8Array) => {
      // Apply Yjs update from peer
      Y.applyUpdate(this.ydoc, data, this);
    });

    peer.on('error', (err) => {
      console.error(`Peer error with ${peerEmail}:`, err);
    });

    peer.on('close', () => {
      console.log(`Peer disconnected: ${peerEmail}`);
      this.removePeer(peerEmail);
    });

    this.peers.set(peerEmail, peer);
  }

  private handleOffer(from: string, offer: any) {
    if (!this.peers.has(from)) {
      this.createPeerConnection(from, false);
    }
    const peer = this.peers.get(from);
    if (peer) {
      peer.signal(offer);
    }
  }

  private handleAnswer(from: string, answer: any) {
    const peer = this.peers.get(from);
    if (peer) {
      peer.signal(answer);
    }
  }

  private handleIceCandidate(from: string, candidate: any) {
    const peer = this.peers.get(from);
    if (peer) {
      peer.signal(candidate);
    }
  }

  private removePeer(peerEmail: string) {
    const peer = this.peers.get(peerEmail);
    if (peer) {
      peer.destroy();
      this.peers.delete(peerEmail);
      this.updatePeerCount(this.peers.size);
    }
  }

  private broadcastUpdate(update: Uint8Array) {
    this.peers.forEach((peer) => {
      if (peer.connected) {
        peer.send(update);
      }
    });
  }

  private updatePeerCount(count: number) {
    const peerCountEl = document.getElementById('peer-count');
    if (peerCountEl) {
      peerCountEl.textContent = count.toString();
    }
  }

  destroy() {
    this.binding.destroy();
    this.editor.dispose();
    this.ws.close();
    this.peers.forEach((peer) => peer.destroy());
  }
}

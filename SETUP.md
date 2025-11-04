# Setup Instructions

## 1. Google OAuth Setup

### Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Choose **Web application**
6. Configure:
   - **Name**: "P2P Editor" (or any name)
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local dev)
     - Your production URL if deploying
   - **Authorized redirect URIs**:
     - `http://localhost:3000` (for local dev)
     - Your production URL if deploying
7. Click **Create**
8. Copy the **Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
9. Update `client/src/main.ts`:
   ```typescript
   const CONFIG = {
     googleClientId: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
     redirectUri: 'http://localhost:3000',
     signalingServerUrl: 'ws://localhost:8080/room/',
   };
   ```

## 2. Local Development

### Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### Run Locally

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```
Server will run on `ws://localhost:8080`

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```
Client will run on `http://localhost:3000`

### Testing
1. Open `http://localhost:3000` in two different browsers
2. Enter the same room name (e.g., "demo-room")
3. Sign in with Google on both
4. Start typing - changes should sync in real-time via P2P

## 3. AWS Server Deployment

### Prerequisites
- Your AWS EC2 instance: `52.207.226.41`
- SSH access to the server
- Node.js installed on the server

### Deploy Server to AWS

1. **SSH into your AWS instance:**
   ```bash
   ssh -i your-key.pem ubuntu@52.207.226.41
   ```

2. **Install Node.js (if not already installed):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Copy server files to AWS:**
   From your local machine:
   ```bash
   scp -i your-key.pem -r server ubuntu@52.207.226.41:~/p2p-editor-server
   ```

4. **On the AWS instance, install dependencies and run:**
   ```bash
   cd ~/p2p-editor-server
   npm install
   npm run build
   PORT=8080 node dist/server.js
   ```

5. **Set up as a service (optional but recommended):**
   Create `/etc/systemd/system/p2p-editor.service`:
   ```ini
   [Unit]
   Description=P2P Editor Signaling Server
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/home/ubuntu/p2p-editor-server
   ExecStart=/usr/bin/node dist/server.js
   Environment=PORT=8080
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

   Enable and start:
   ```bash
   sudo systemctl enable p2p-editor
   sudo systemctl start p2p-editor
   sudo systemctl status p2p-editor
   ```

### Configure WebSocket Port

6. **Ensure port 8080 is open in AWS Security Group:**
   - Go to EC2 Dashboard > Security Groups
   - Find your instance's security group
   - Add inbound rule:
     - Type: Custom TCP
     - Port: 8080
     - Source: 0.0.0.0/0 (or restrict to your IP)

### SSL/TLS Setup (Required for production)

For secure WebSocket (`wss://`), you need SSL. Options:

**Option A: Use Nginx as reverse proxy with Let's Encrypt**
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL cert (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Configure Nginx to proxy to WebSocket
sudo nano /etc/nginx/sites-available/default
```

Add this location block:
```nginx
location /room/ {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

**Option B: If using raw IP (not recommended for prod)**
- WebSocket will be `ws://52.207.226.41:8080/room/{roomId}`
- Modern browsers may block non-secure WebSocket from HTTPS pages

### Update Client Configuration

7. **Update `client/src/main.ts` for production:**
   ```typescript
   const CONFIG = {
     googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
     redirectUri: 'https://yourdomain.com', // or http://localhost:3000 for dev
     signalingServerUrl: 'wss://yourdomain.com/room/', // or ws://52.207.226.41:8080/room/
   };
   ```

8. **Build and deploy client:**
   ```bash
   cd client
   npm run build
   # Upload dist/ folder to your web host (S3, Netlify, Vercel, etc.)
   ```

## 4. Firewall Notes

If you have firewall issues:
```bash
# On AWS instance, check if port is listening
sudo netstat -tlnp | grep 8080

# Check firewall (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 8080/tcp
```

## 5. Testing Production

1. Update both Google OAuth redirect URIs to include your production URL
2. Open your deployed client URL in two browsers
3. Sign in and test collaboration

## Troubleshooting

### "WebSocket connection failed"
- Check server is running: `curl http://localhost:8080` should return "WebRTC Signaling Server Running"
- Check AWS security group allows port 8080
- Check server logs for errors

### "Invalid or expired token"
- Verify Google Client ID is correct in client config
- Check browser console for JWT decode errors
- Ensure email is verified in Google account

### "Peers not connecting"
- Check browser console for WebRTC errors
- NAT/firewall may block P2P - this demo uses default STUN servers
- For production, consider adding TURN servers for better connectivity

### CORS Issues
- The server accepts all origins for WebSocket
- If using HTTPS client with WS server (not WSS), browsers will block it

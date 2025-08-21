# WebRTC Video Call Application

A peer-to-peer video calling application built with Next.js and WebRTC.

## Features

- 🎥 Real-time video calling
- 🎤 Audio communication
- 👥 Multiple users support
- 📱 Responsive design
- 🔄 Automatic user list updates
- ⚡ Low latency P2P connections

## Architecture

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express and Socket.io for signaling
- **WebRTC**: Direct peer-to-peer connections for video/audio

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Modern web browser with WebRTC support

## Installation & Setup

### 1. Server Setup

```bash
cd server
npm install
npm run dev
```

The server will start on `http://localhost:3001`

### 2. Client Setup

```bash
cd client
npm install
npm run dev
```

The client will start on `http://localhost:3000`

## Usage

1. **Start the Server**: Run the signaling server first
2. **Start the Client**: Run the Next.js development server
3. **Open Multiple Tabs**: Open `http://localhost:3000` in multiple browser tabs/windows
4. **Enter Names**: Enter different names for each user
5. **Make Calls**: Click "Call" button next to any online user
6. **Accept/Reject**: Accept or reject incoming calls
7. **End Calls**: Click "End Call" to terminate the connection

## How It Works

### WebRTC Signaling Flow

1. **Connection**: Users connect to the signaling server via Socket.io
2. **User Discovery**: Server maintains a list of connected users
3. **Call Initiation**: Caller sends an offer through the signaling server
4. **Call Response**: Callee responds with an answer
5. **ICE Exchange**: Both peers exchange ICE candidates for NAT traversal
6. **P2P Connection**: Direct peer-to-peer connection established
7. **Media Streaming**: Video and audio streams directly between peers

### Technical Components

- **Signaling Server**: Handles user management and WebRTC signaling
- **STUN Server**: Google's STUN server for NAT traversal
- **React Hooks**: useState, useEffect, useRef for state management
- **Media API**: getUserMedia for camera/microphone access
- **RTCPeerConnection**: WebRTC API for peer connections

## File Structure

```
├── client/                 # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       └── page.tsx   # Main application component
│   ├── package.json
│   └── ...
├── server/                 # Node.js backend
│   ├── server.js          # Signaling server
│   ├── package.json
│   └── ...
└── README.md
```

## Configuration

### Server Configuration
- **Port**: Default 3001 (configurable via PORT environment variable)
- **CORS**: Configured for localhost:3000

### Client Configuration
- **Server URL**: Points to localhost:3001
- **STUN Server**: Uses Google's public STUN server

## Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Ensure browser permissions are granted
   - Use HTTPS in production for getUserMedia API

2. **Connection Failed**
   - Check if signaling server is running
   - Verify firewall settings
   - Ensure STUN server is accessible

3. **No Video/Audio**
   - Check device permissions
   - Verify media devices are working
   - Check browser console for errors

4. **No Other Users Showing**
   - Check browser console for WebSocket connection errors
   - Verify server is running on port 3001
   - Ensure multiple users have different names
   - Check server logs for user join/leave events

### Browser Compatibility

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

### Debug Mode

Open browser developer tools and check the console for:
- Socket connection status
- User list updates
- WebRTC connection logs

## Production Deployment

### Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=production

# Client
NEXT_PUBLIC_SERVER_URL=https://your-server-domain.com
```

### HTTPS Requirement

WebRTC requires HTTPS in production for security reasons. Ensure both client and server are served over HTTPS.

### TURN Server

For production use behind NAT/firewalls, consider adding TURN servers:

```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

## Security Considerations

- Implement user authentication
- Add rate limiting
- Validate all inputs
- Use secure WebSocket connections (WSS)
- Implement proper CORS policies
- Consider end-to-end encryption for sensitive communications

## Performance Optimization

- Implement bandwidth adaptation
- Add video quality controls
- Use efficient codecs (VP8, VP9, H.264)
- Implement connection monitoring
- Add reconnection logic

## License

MIT License - feel free to use this code for your projects!

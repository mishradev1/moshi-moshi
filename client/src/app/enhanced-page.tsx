'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [inCall, setInCall] = useState(false);
  const [userName, setUserName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [incomingCall, setIncomingCall] = useState<{ from: string, fromName: string, offer: RTCSessionDescriptionInit } | null>(null);
  const [callStatus, setCallStatus] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const cleanupCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      setRemoteStream(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    setInCall(false);
    setIncomingCall(null);
    setCallStatus('');
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [localStream, remoteStream, peerConnection]);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError('');
    });

    newSocket.on('connect_error', (error) => {
      setConnectionError('Failed to connect to server. Please make sure the server is running.');
      console.error('Connection error:', error);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setConnectionError('Disconnected from server');
    });

    newSocket.on('users', (userList: User[]) => {
      setUsers(userList);
    });

    newSocket.on('offer', async (data: { from: string, fromName: string, offer: RTCSessionDescriptionInit }) => {
      setIncomingCall(data);
    });

    newSocket.on('answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus('Connected');
        } catch (error) {
          console.error('Error setting remote description:', error);
          setCallStatus('Connection failed');
        }
      }
    });

    newSocket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnection) {
        try {
          peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    newSocket.on('call-ended', () => {
      cleanupCall();
    });

    return () => {
      cleanupCall();
      newSocket.disconnect();
    };
  }, [peerConnection, cleanupCall]);

  const joinRoom = () => {
    if (socket && userName.trim()) {
      socket.emit('join', { name: userName.trim() });
    }
  };

  const initializeMedia = async () => {
    try {
      setCallStatus('Requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallStatus('Media access granted');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setCallStatus('Failed to access camera/microphone');
      return null;
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const pc = new RTCPeerConnection(configuration);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setCallStatus('Connected');
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('Connected');
      } else if (pc.connectionState === 'failed') {
        setCallStatus('Connection failed');
      } else if (pc.connectionState === 'disconnected') {
        setCallStatus('Disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    setPeerConnection(pc);
    return pc;
  };

  const makeCall = async (targetUserId: string) => {
    const stream = await initializeMedia();
    if (!stream || !socket) return;

    setCallStatus('Connecting...');
    const pc = createPeerConnection(stream);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('offer', { to: targetUserId, offer, fromName: userName });
      setInCall(true);
    } catch (error) {
      console.error('Error creating offer:', error);
      setCallStatus('Failed to create call');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !socket) return;

    const stream = await initializeMedia();
    if (!stream) return;

    setCallStatus('Accepting call...');
    const pc = createPeerConnection(stream);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer', { to: incomingCall.from, answer });
      setInCall(true);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('Failed to accept call');
    }
  };

  const rejectCall = () => {
    setIncomingCall(null);
    if (socket) {
      socket.emit('call-rejected', { to: incomingCall?.from });
    }
  };

  const endCall = () => {
    if (socket) {
      socket.emit('end-call');
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
          <p className="text-gray-600 mb-4">{connectionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!userName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold text-center mb-6">WebRTC Video Call</h1>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinRoom}
              disabled={!userName.trim()}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">📞</div>
              <h3 className="text-lg font-semibold mb-2">Incoming Call</h3>
              <p className="text-gray-600 mb-6">
                <span className="font-medium">{incomingCall.fromName}</span> is calling you
              </p>
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={acceptCall}
                  className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600 flex items-center space-x-2"
                >
                  <span>✓</span>
                  <span>Accept</span>
                </button>
                <button
                  onClick={rejectCall}
                  className="bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 flex items-center space-x-2"
                >
                  <span>✗</span>
                  <span>Reject</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">WebRTC Video Call</h1>
        
        {callStatus && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 text-center">
            {callStatus}
          </div>
        )}
        
        {inCall ? (
          <div className="space-y-6">
            {/* Video Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Local Video */}
              <div className="relative">
                <h3 className="text-lg font-semibold mb-2">You ({userName})</h3>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-64 object-cover"
                  />
                  {localStream && !localStream.getVideoTracks()[0]?.enabled && (
                    <div className="absolute inset-0 bg-black flex items-center justify-center text-white">
                      Video Disabled
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Video */}
              <div className="relative">
                <h3 className="text-lg font-semibold mb-2">Remote User</h3>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 object-cover"
                  />
                  {!remoteStream && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-white">
                      Waiting for remote video...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full ${
                  localStream?.getAudioTracks()[0]?.enabled 
                    ? 'bg-gray-500 hover:bg-gray-600' 
                    : 'bg-red-500 hover:bg-red-600'
                } text-white`}
                title={localStream?.getAudioTracks()[0]?.enabled ? 'Mute' : 'Unmute'}
              >
                {localStream?.getAudioTracks()[0]?.enabled ? '🎤' : '🔇'}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full ${
                  localStream?.getVideoTracks()[0]?.enabled 
                    ? 'bg-gray-500 hover:bg-gray-600' 
                    : 'bg-red-500 hover:bg-red-600'
                } text-white`}
                title={localStream?.getVideoTracks()[0]?.enabled ? 'Turn off video' : 'Turn on video'}
              >
                {localStream?.getVideoTracks()[0]?.enabled ? '📹' : '📷'}
              </button>

              <button
                onClick={endCall}
                className="bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 flex items-center space-x-2"
              >
                <span>📞</span>
                <span>End Call</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* User List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Online Users ({users.length})</h2>
              {users.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">👥</div>
                  <p className="text-gray-500">No other users online</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Open this page in another tab or share the link with friends
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                      <button
                        onClick={() => makeCall(user.id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-2"
                      >
                        <span>📞</span>
                        <span>Call</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current User Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-2">Your Information</h2>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-medium text-green-600">{userName}</p>
                  <p className="text-sm text-gray-500">Connected and ready to receive calls</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

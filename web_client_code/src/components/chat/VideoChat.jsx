import React, { useRef, useState, useEffect } from 'react';
import adapter from 'webrtc-adapter';

const VideoChat = ({ sendJsonMessage, lastJsonMessage, userId, username, callRequest }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [inCall, setInCall] = useState(false);

  const iceServers = [
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  const initMediaStream = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }

      // Disable tracks initially (muted/off)
      localStream.current.getAudioTracks().forEach((track) => (track.enabled = false));
      localStream.current.getVideoTracks().forEach((track) => (track.enabled = false));

      setIsMicOn(false);
      setIsCamOn(false);

      console.log('Media stream initialized successfully.');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      const errorMessages = {
        NotAllowedError: 'Camera and microphone access were denied. Please allow access.',
        NotFoundError: 'No camera or microphone found. Please connect devices.',
        OverconstrainedError: 'The requested constraints cannot be satisfied.',
        default: 'An unexpected error occurred while accessing media devices.',
      };
      alert(errorMessages[error.name] || errorMessages.default);
    }
  };

  const addRemoteUser = (remoteUserId) => {
    if (!remoteVideoRefs.current[remoteUserId]) {
      remoteVideoRefs.current[remoteUserId] = React.createRef();
      setRemoteUsers((prev) => [...prev, remoteUserId]);
    }
  };

  const removeRemoteUser = (remoteUserId) => {
    delete remoteVideoRefs.current[remoteUserId];
    setRemoteUsers((prev) => prev.filter((id) => id !== remoteUserId));
  };

  const createPeerConnection = (remoteUserId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    localStream.current.getTracks().forEach((track) =>
      peerConnection.addTrack(track, localStream.current)
    );

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendJsonMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          recipientId: remoteUserId,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log(`Track received from ${remoteUserId}:`, event.streams);
      addRemoteUser(remoteUserId);

      const remoteVideo = remoteVideoRefs.current[remoteUserId]?.current;
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        console.log(`Stream set for ${remoteUserId}`);
      }
    };

    return peerConnection;
  };

  const toggleTracks = (enabled) => {
    localStream.current?.getAudioTracks().forEach((track) => (track.enabled = enabled));
    localStream.current?.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setIsMicOn(enabled);
    setIsCamOn(enabled);
  };

  const toggleMic = () => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  const toggleCam = () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamOn(videoTrack.enabled);
    }
  };

  const hangUp = () => {
    sendJsonMessage({
      type: 'hang-up',
      senderId: userId,
      recipientId: remoteUserId,
    });
    cleanup();
  };

  const cleanup = () => {
    localStream.current?.getTracks().forEach((track) => track.stop());

    Object.keys(peerConnections.current).forEach((id) => {
      peerConnections.current[id]?.close();
      delete peerConnections.current[id];
    });

    Object.keys(remoteVideoRefs.current).forEach((id) => {
      delete remoteVideoRefs.current[id];
    });

    setRemoteUsers([]);
    setInCall(false);
    console.log('Call ended. All resources cleaned.');
  };

  const handleOffer = async (offer, senderId) => {
    addRemoteUser(senderId);
    let peerConnection = peerConnections.current[senderId];
    if (!peerConnection) {
      peerConnection = createPeerConnection(senderId);
      peerConnections.current[senderId] = peerConnection;
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendJsonMessage({ type: 'answer', answer, recipientId: senderId });
  };

  const handleAnswer = async (answer, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleNewICECandidate = async (candidate, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const createAndSendOffer = async (remoteUserId) => {
    setRemoteUserId(remoteUserId); // Store the remote user ID
    const peerConnection = createPeerConnection(remoteUserId);
    peerConnections.current[remoteUserId] = peerConnection;

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendJsonMessage({
        type: 'offer',
        offer,
        recipientId: remoteUserId,
      });
       setInCall(true); // Set inCall to true when the call starts
      console.log('In Call State:', inCall);
    } catch (error) {
      console.error('Error creating offer:', error); // Highlighted: Enhanced error handling
    }
  };

  useEffect(() => {
    initMediaStream();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (lastJsonMessage) {
      const { type, senderId, ...data } = lastJsonMessage;

       // Handle only WebRTC-related messages
      const allowedTypes = ['initiate-call', 'offer', 'answer', 'ice-candidate'];
      if (!allowedTypes.includes(type)) return;
        
        

      switch (type) {
        
        case 'initiate-call':
          createAndSendOffer(senderId); // Initiates an offer for the caller
          break;

        case 'offer':
          handleOffer(data.offer, senderId);
          break;
        case 'answer':
          handleAnswer(data.answer, senderId);
          break;
        case 'ice-candidate':
          handleNewICECandidate(data.candidate, senderId);
          break;
        case 'hang-up':
          removeRemoteUser(senderId);
          break;
        default:
          console.warn('Unhandled message:', type);
      }
    }
  }, [lastJsonMessage]);

  return (
    <div>
      <h2>Live Video Chat</h2>
      <video ref={localVideoRef} autoPlay muted style={{ width: '300px', border: '1px solid black' }} />
      <div>
        <button onClick={toggleMic}>{isMicOn ? 'Turn Mic Off' : 'Turn Mic On'}</button>
        <button onClick={toggleCam}>{isCamOn ? 'Turn Cam Off' : 'Turn Cam On'}</button>
        {inCall && (
          <button onClick={hangUp} style={{ color: 'red', fontWeight: 'bold' }}>
            Hang Up
          </button>
        )}
      </div>
      <h3>Remote Streams:</h3>
      {remoteUsers.map((id) => (
        <video
          key={id}
          ref={remoteVideoRefs.current[id]}
          autoPlay
          playsInline
          style={{ width: '300px', border: '1px solid black' }}
        />
      ))}
    </div>
  );
};

export default VideoChat;

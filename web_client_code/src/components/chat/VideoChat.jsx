import React, { useRef, useState, useEffect } from 'react';

const VideoChat = ({ sendJsonMessage, lastJsonMessage, userId, username }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:turn.example.com', 
      credential: 'webrtc',
      username: 'webrtc'
    }
  ];
  
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [availableBroadcasters, setAvailableBroadcasters] = useState([]);

  // Initialize media stream
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
        localStream.current.getAudioTracks().forEach((track) => (track.enabled = false));
        localStream.current.getVideoTracks().forEach((track) => (track.enabled = false));
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };
  
    initMediaStream();
  
    return () => {
      // Copy `peerConnections.current` to a variable before using in cleanup
      const connections = peerConnections.current;
  
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
  
      Object.values(connections).forEach((pc) => {
        pc.close();
      });
    };
  }, []);

  // Toggle microphone
  const toggleMic = () => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  // Toggle camera
  const toggleCam = () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamOn(videoTrack.enabled);
    }
  };

  // Start broadcasting
  const startBroadcast = async () => {
    if (!localStream.current) return;

    sendJsonMessage({ type: 'start-broadcast' });
    setIsBroadcasting(true);
  };

  // Stop broadcasting
  const stopBroadcast = () => {
    // Close all peer connections
    Object.keys(peerConnections.current).forEach((peerId) => {
      const pc = peerConnections.current[peerId];
      pc.close();
      delete peerConnections.current[peerId];
    });

    // Reset remote video refs
    remoteVideoRefs.current = {};

    // Send stop broadcast message
    sendJsonMessage({ type: 'stop-broadcast' });
    setIsBroadcasting(false);
  };

  // Create a peer connection
  const createPeerConnection = (remoteUserId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    // Add local stream tracks to peer connection
    localStream.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream.current);
    });

    // Handle ICE candidates
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
      if (!remoteVideoRefs.current[remoteUserId]) {
        remoteVideoRefs.current[remoteUserId] = React.createRef();
      }
    
      const attachStream = () => {
        const remoteVideo = remoteVideoRefs.current[remoteUserId];
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = event.streams[0];
          console.log(`Attached remote stream to video element for user ${remoteUserId}`);
        } else {
          console.error(`Remote video element for ${remoteUserId} is not ready.`);
          // setTimeout(attachStream, 100); // Retry after a short delay
        }
      };
    
      attachStream(); // Attempt to attach the stream
    };
    

    return peerConnection;
  };

  // Create and send offer
  const createAndSendOffer = async (remoteUserId) => {
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
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  // Handle incoming offer
  const handleOffer = async (offer, senderId) => {
    const peerConnection = createPeerConnection(senderId);
    peerConnections.current[senderId] = peerConnection;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      sendJsonMessage({
        type: 'answer',
        answer,
        recipientId: senderId,
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  // Handle incoming answer
  const handleAnswer = async (answer, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  // Handle incoming ICE candidate
  const handleNewICECandidate = async (candidate, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  // WebRTC signaling and message handling
  useEffect(() => {
    if (lastJsonMessage) {
      const { type, senderId, ...data } = lastJsonMessage;

      // Ignore messages from self
      if (senderId === userId) return;

      switch (type) {
        case 'update-users':
          console.log('Received update-users:', data.users);
          setAvailableBroadcasters(
            data.users
              .filter(user => user.isBroadcasting)
              .map(user => ({
                id: user.id, // Use `id` provided by the server
                username: user.username
              }))
          );
          
          console.log('Broadcasters to render:', availableBroadcasters);

          break;
        

        case 'broadcast-request':
          // Another user wants to broadcast, create a peer connection
          if (!isBroadcasting) {
            createAndSendOffer(senderId);
          }
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

        case 'broadcast-ended':
          // Remove remote video for the user who stopped broadcasting
          if (remoteVideoRefs.current[senderId]) {
            delete remoteVideoRefs.current[senderId];
          }
          break;

        default:
          console.log('Ignored non-WebRTC message type:', type);
          break;
      }
    }
  }, [lastJsonMessage, userId, isBroadcasting]);

  return (
    <div>
      <h2>Live Video Chat</h2>
      <div>
        <video 
          ref={localVideoRef} 
          autoPlay 
          muted 
          style={{ width: '300px', border: '1px solid black' }}
        ></video>
        <div>
          <button onClick={toggleMic}>
            {isMicOn ? 'Turn Mic Off' : 'Turn Mic On'}
          </button>
          <button onClick={toggleCam}>
            {isCamOn ? 'Turn Cam Off' : 'Turn Cam On'}
          </button>
          {!isBroadcasting ? (
            <button onClick={startBroadcast}>Start Broadcast</button>
          ) : (
            <button onClick={stopBroadcast}>Stop Broadcast</button>
          )}
        </div>
      </div>

      <div>
        <h3>Available Broadcasters:</h3>
        {Object.values(availableBroadcasters).length > 0 ? (
          Object.values(availableBroadcasters).map((broadcaster, index)=> (
            <div key={index}>
              {broadcaster.username} is broadcasting
            </div>
          ))
        ) : (
          <p>No active broadcasters</p>
        )}
      </div>

      <div>
        <h3>Remote Streams:</h3>
        {Object.keys(remoteVideoRefs.current).map((id) => {
          if (!remoteVideoRefs.current[id]) {
            remoteVideoRefs.current[id] = React.createRef();
          }

          return (
            <video
              key={id}
              ref={remoteVideoRefs.current[id]}
              autoPlay
              playsInline
              style={{ width: '300px', border: '1px solid black' }}
            ></video>
          );
        })}
          </div>
    </div>
  );
};

export default VideoChat;

import React, { useRef, useState, useEffect } from 'react';
import adapter from 'webrtc-adapter';

const VideoChat = ({ sendJsonMessage, lastJsonMessage, userId, username, callRequest}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [inCall, setInCall] = useState(false); // State to track if a call is active


  const iceServers = [
    // Public STUN servers
    { urls: 'stun:stun.stunprotocol.org:3478' },
  ];
  


  const hangUp = () => {
    // Notify the other user to hang up
    sendJsonMessage({
      type: 'hang-up',
      senderId: userId,
      recipientId: remoteUserId, // Include the recipient ID
    });
    console.log(`Hang-up message sent from ${userId} to ${remoteUserId}`);
    handleHangUp(); // Perform local cleanup
  };

  const handleHangUp = () => {
    console.log('Received hang-up signal from remote user');
    cleanupPeerConnection();
  };

  // Clean up peer connection resources
  const cleanupPeerConnection = (peerId) => {
   // Stop local tracks
   if (localStream.current) {
    localStream.current.getTracks().forEach((track) => track.stop());
  }

  // Close all peer connections
  Object.keys(peerConnections.current).forEach((peerId) => {
    const pc = peerConnections.current[peerId];
    if (pc) pc.close();
    delete peerConnections.current[peerId];
  });

  // Clear remote video refs
  remoteVideoRefs.current = {};

  // Reset call state
  setInCall(false);
  console.log('Call ended. Resources cleaned up.');
  };

  

  useEffect(() => {
    const initMediaStream = async () => {
      try {
        // Enumerate available media devices
        const devices = await navigator.mediaDevices.enumerateDevices();
  
        // Find a video input device (camera) and audio input device (microphone)
        const videoDevice = devices.find((device) => device.kind === "videoinput");
        const audioDevice = devices.find((device) => device.kind === "audioinput");
  
        // Set up constraints based on available devices
        const constraints = {
          video: videoDevice ? { width: 1280, height: 720 } : false,
          audio: !!audioDevice,
        };
  
        console.log("getUserMedia start with constraints:", constraints);
  
        // Request media stream with the constraints
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
  
        // Assign the stream to the local video element and the localStream reference
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStream.current = stream;
  
        // Optionally, disable tracks initially (e.g., for muting)
        toggleTracks(false);
  
        console.log("Media stream initialized successfully.");
      } catch (error) {
        console.error("Error accessing media devices:", error);
  
        const errorMessages = {
          NotAllowedError: "Camera and microphone access was denied. Please allow access in browser settings.",
          NotFoundError: "No camera or microphone found. Please connect devices.",
          OverconstrainedError: "The requested constraints cannot be satisfied.",
          default: "An unexpected error occurred while accessing media devices.",
        };
  
        alert(errorMessages[error.name] || errorMessages.default);
      }
    };
  
    initMediaStream();
  
    return () => {
      handleHangUp(); // Clean up resources when the component unmounts
    };
  }, []);
  

  const toggleTracks = (isEnabled) => {
    localStream.current?.getAudioTracks().forEach((track) => (track.enabled = isEnabled));
    localStream.current?.getVideoTracks().forEach((track) => (track.enabled = isEnabled));
    setIsMicOn(isEnabled);
    setIsCamOn(isEnabled);
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



  //Fuction to create Peer Connection
  const createPeerConnection = (remoteUserId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

      // Comprehensive connection state management
  const handleConnectionStateChange = () => {
    switch (peerConnection.connectionState) {
      case 'connected':
        setInCall(true);
        console.log(`Peer connection established with ${username}`);
        break;
      
      // case 'disconnected':
      //   console.warn(`Connection with ${remoteUserId} lost`);
      //   handlePeerDisconnection(remoteUserId);
      //   break;
      
      case 'failed':
        console.error(`Connection with ${remoteUserId} failed`);
        handleConnectionFailure(remoteUserId);
        break;
      
      case 'closed':
        console.log(`Connection with ${remoteUserId} closed`);
        cleanupPeerConnection(remoteUserId);
        break;
    }
  };

  // Ice connection state detailed monitoring
  const handleIceConnectionStateChange = () => {
    switch (peerConnection.iceConnectionState) {
      case 'checking':
        console.log(`Establishing connection with ${remoteUserId}`);
        break;
      
      case 'connected':
        console.log(`ICE connection established with ${remoteUserId}`);
        break;
      
      // case 'disconnected':
      //   console.warn(`ICE connection lost with ${remoteUserId}`);
      //   handlePeerDisconnection(remoteUserId);
      //   break;
      
      case 'failed':
        console.error(`ICE connection failed with ${remoteUserId}`);
        handleConnectionFailure(remoteUserId);
        break;
    }
  };


  // Handle connection failure
  const handleConnectionFailure = (peerId) => {
    console.error(`Permanent connection failure with ${peerId}`);
    
    // Clean up resources
    cleanupPeerConnection(peerId);
    
    // Provide user-friendly error notification
    alert(`Unable to establish stable connection. Please check your network and try again.`);
  };

  // Add event listeners for connection state monitoring
  peerConnection.onconnectionstatechange = handleConnectionStateChange;
  peerConnection.oniceconnectionstatechange = handleIceConnectionStateChange;



//old
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
    
      // Create a MediaStream buffer
      const buffer = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        buffer.addTrack(track);
      });
    
      // Simulate buffering delay (adjust timeout as necessary for latency)
      setTimeout(() => {
        if (!remoteVideoRefs.current[remoteUserId]) {
          remoteVideoRefs.current[remoteUserId] = React.createRef();
        }
    
        const remoteVideo = remoteVideoRefs.current[remoteUserId];
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = buffer;
          console.log(`Buffered stream set for ${remoteUserId}`);
        }
      }, 500); // Adjust delay to match latency conditions
    };

    return peerConnection;
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

  const handleOffer = async (offer, senderId) => {
    setRemoteUserId(senderId); // Store the sender as the remote user
    let peerConnection = peerConnections.current[senderId];
    if (!peerConnection) {
      peerConnection = createPeerConnection(senderId);
      peerConnections.current[senderId] = peerConnection;
    }
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
      console.error(`Error handling offer for ${senderId}:`, error); // Highlighted: Error handling for offers
    }
  };

  const handleAnswer = async (answer, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (!peerConnection) {
      console.error(`No peer connection found for senderId: ${senderId}`); // Highlighted: Handle missing peerConnection
      return;
    }
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`Set remote description for ${senderId}`);
    } catch (error) {
      console.error(`Error handling answer for ${senderId}:`, error); // Highlighted: Error handling for answers
    }
  };

  const handleNewICECandidate = async (candidate, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`Added ICE candidate for ${senderId}`);
      } catch (error) {
        console.error(`Error adding ICE candidate for ${senderId}:`, error); // Highlighted: Error handling for ICE candidates
      }
    }
  };

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
          handleOffer(data.offer, senderId); // Handles the incoming offer
          break;
  
        case 'answer':
          handleAnswer(data.answer, senderId); // Handles the incoming answer
          break;
  
        case 'ice-candidate':
          handleNewICECandidate(data.candidate, senderId); // Adds ICE candidate
          break;

        case 'hang-up':
          handleHangUp();
        break;
  
        default:
          console.warn('Unhandled WebRTC message type:', { type, data, senderId }); // Highlighted: Enhanced logging
      }
    }
  }, [lastJsonMessage]);
  
  

  return (
    <div>
      <h2>Live Video Chat</h2>
      <video ref={localVideoRef} autoPlay muted style={{ width: '300px', border: '1px solid black' }}></video>
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
      {Object.keys(remoteVideoRefs.current).map((id) => (
        <video
          key={id}
          ref={remoteVideoRefs.current[id]}
          autoPlay
          playsInline
          style={{ width: '300px', border: '1px solid black' }}
        ></video>
            ))}
    </div>
  );
};

export default VideoChat;

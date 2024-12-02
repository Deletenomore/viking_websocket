import React, { useRef, useState, useEffect } from 'react';

const VideoChat = ({ sendJsonMessage, lastJsonMessage, userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);

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
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle microphone toggle
  const toggleMic = () => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  // Handle camera toggle
  const toggleCam = () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamOn(videoTrack.enabled);
    }
  };

  // Start broadcasting
  const startBroadcast = () => {
    sendJsonMessage({ type: 'start-broadcast' });
  };

  // Handle incoming offer
  const handleOffer = async (offer, senderId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });
    peerConnections.current[senderId] = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendJsonMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          recipientId: senderId,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      if (!remoteVideoRefs.current[senderId]) {
        remoteVideoRefs.current[senderId] = React.createRef();
      }
      if (remoteVideoRefs.current[senderId].current) {
        remoteVideoRefs.current[senderId].current.srcObject = event.streams[0];
      }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    localStream.current.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream.current);
    });

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendJsonMessage({
      type: 'answer',
      answer,
      recipientId: senderId,
    });
  };

  // Handle incoming answer
  const handleAnswer = async (answer, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  // Handle incoming ICE candidate
  const handleNewICECandidate = async (candidate, senderId) => {
    const peerConnection = peerConnections.current[senderId];
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  // WebRTC signaling message handler
  useEffect(() => {
    if (lastJsonMessage) {
      const { type, senderId, ...data } = lastJsonMessage;

      if (senderId === userId) {
        console.log('Ignored message from self');
        return;
      }

      switch (type) {
        case 'start-broadcast':
          console.log(`Broadcast started by user: ${senderId}`);
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

        default:
          console.log('Ignored non-WebRTC message type:', type);
          break;
      }
    }
  }, [lastJsonMessage, userId]);

  return (
    <div>
      <h2>Live Video Chat</h2>
      <div>
        <video ref={localVideoRef} autoPlay muted style={{ width: '300px', border: '1px solid black' }}></video>
        <div>
          <button onClick={toggleMic}>{isMicOn ? 'Turn Mic Off' : 'Turn Mic On'}</button>
          <button onClick={toggleCam}>{isCamOn ? 'Turn Cam Off' : 'Turn Cam On'}</button>
          <button onClick={startBroadcast}>Start Broadcast</button>
        </div>
      </div>
      <div>
        <h3>Remote Streams:</h3>
        {Object.keys(remoteVideoRefs.current).map((id) => (
          <video
            key={id}
            ref={remoteVideoRefs.current[id]}
            autoPlay
            style={{ width: '300px', border: '1px solid black' }}
          ></video>
        ))}
      </div>
    </div>
  );
};

export default VideoChat;

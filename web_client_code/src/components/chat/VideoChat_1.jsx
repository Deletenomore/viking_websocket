import React, { useRef, useState, useEffect } from "react";
import adapter from "webrtc-adapter";

const VideoChat = ({ sendJsonMessage, lastJsonMessage, userId, username }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const localStream = useRef(null);
  const peerConnections = useRef({});
  const [userList, setUserList] = useState([]); // Online user list
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [inCall, setInCall] = useState(false);

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.stunprotocol.org" },
    { urls: "turn:turn.example.com", username: "webrtc", credential: "webrtc" },
  ];

  const log = (msg) => console.log(msg);

  // Initialize media stream
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
        }
        toggleTracks(false); // Start with mic and camera off
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    initMediaStream();

    return () => {
      handleHangUp(); // Cleanup when the component unmounts
    };
  }, []);

  // Create a peer connection
  const createPeerConnection = (remoteUserId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendJsonMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          senderId: userId,
          recipientId: remoteUserId,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      log(`Track received from ${remoteUserId}`);
      if (!remoteVideoRefs.current[remoteUserId]) {
        remoteVideoRefs.current[remoteUserId] = React.createRef();
      }
      const remoteVideo = remoteVideoRefs.current[remoteUserId];
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case "connected":
          log(`Peer connection established with ${remoteUserId}`);
          setInCall(true);
          break;
        case "failed":
        case "disconnected":
        case "closed":
          log(`Connection closed or failed with ${remoteUserId}`);
          cleanupPeerConnection(remoteUserId);
          break;
        default:
          break;
      }
    };

    localStream.current?.getTracks().forEach((track) =>
      peerConnection.addTrack(track, localStream.current)
    );

    return peerConnection;
  };

  // Cleanup peer connection
  const cleanupPeerConnection = (peerId) => {
    if (remoteVideoRefs.current[peerId]) {
      remoteVideoRefs.current[peerId].current.srcObject = null;
      delete remoteVideoRefs.current[peerId];
    }

    const pc = peerConnections.current[peerId];
    if (pc) {
      pc.close();
      delete peerConnections.current[peerId];
    }

    if (Object.keys(peerConnections.current).length === 0) {
      setInCall(false);
    }
  };

  // Toggle microphone and camera
  const toggleTracks = (isEnabled) => {
    localStream.current?.getAudioTracks().forEach((track) => (track.enabled = isEnabled));
    localStream.current?.getVideoTracks().forEach((track) => (track.enabled = isEnabled));
    setIsMicOn(isEnabled);
    setIsCamOn(isEnabled);
  };

  const toggleMic = () => toggleTracks(!isMicOn);
  const toggleCam = () => toggleTracks(!isCamOn);

  // Hang up the call
  const hangUp = () => {
    sendJsonMessage({
      type: "hang-up",
      senderId: userId,
      recipientId: remoteUserId,
    });
    handleHangUp();
  };

  const handleHangUp = () => {
    log("Call ended.");
    cleanupPeerConnection(remoteUserId);
  };

  // Handle incoming signaling messages
  const handleSignalingMessage = async (message) => {
    switch (message.type) {
      case "offer":
        await handleOffer(message.offer, message.senderId);
        break;
      case "answer":
        await handleAnswer(message.answer, message.senderId);
        break;
      case "ice-candidate":
        await handleNewICECandidate(message.candidate, message.senderId);
        break;
      case "hang-up":
        handleHangUp();
        break;
      default:
        log("Unhandled signaling message type:", message.type);
    }
  };

  const handleOffer = async (offer, senderId) => {
    const peerConnection = createPeerConnection(senderId);
    peerConnections.current[senderId] = peerConnection;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendJsonMessage({
      type: "answer",
      answer: peerConnection.localDescription,
      senderId: userId,
      recipientId: senderId,
    });
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

  useEffect(() => {
    if (lastJsonMessage) {
      if (lastJsonMessage.type === "user-list") {
        setUserList(lastJsonMessage.users);
      } else {
        handleSignalingMessage(lastJsonMessage);
      }
    }
  }, [lastJsonMessage]);

  // Start a call
  const startCall = async (recipientId) => {
    setRemoteUserId(recipientId);
    const peerConnection = createPeerConnection(recipientId);
    peerConnections.current[recipientId] = peerConnection;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendJsonMessage({
      type: "offer",
      offer: peerConnection.localDescription,
      senderId: userId,
      recipientId,
    });
  };

  return (
    <div>
      <h2>Live Video Chat</h2>
      <video ref={localVideoRef} autoPlay muted style={{ width: "300px", border: "1px solid black" }} />
      <div>
        <button onClick={toggleMic}>{isMicOn ? "Turn Mic Off" : "Turn Mic On"}</button>
        <button onClick={toggleCam}>{isCamOn ? "Turn Cam Off" : "Turn Cam On"}</button>
        {inCall && (
          <button onClick={hangUp} style={{ color: "red", fontWeight: "bold" }}>
            Hang Up
          </button>
        )}
      </div>
      <h3>Online Users</h3>
      <ul>
        {userList.map((user) => (
          <li key={user.id}>
            {user.username}{" "}
            {user.id !== userId && (
              <button onClick={() => startCall(user.id)}>Start Call</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VideoChat;

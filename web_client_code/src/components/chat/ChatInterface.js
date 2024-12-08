import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import VideoChat from '../chat/VideoChat';
import { useNavigate } from 'react-router-dom';


const ChatInterface = () => {
  const location = useLocation();
  const { username, role } = location.state || {}; // Get the username from CreateRoom.js
  const [userRole, setuserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [webSocketError, setWebSocketError] = useState(null); // To handle connection errors
  const [callRequest, setCallRequest] = useState(null); // To handle incoming calls
  const navigate = useNavigate();

  const localhost =  'localhost';

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(`ws://${localhost}:8080`, {
    onOpen: () => {
      console.log('WebSocket connected');
      sendJsonMessage({
        type: 'sign-in',
        username,
        role
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error); // Log WebSocket errors
      setWebSocketError('WebSocket connection failed. Please try again.');
    },
    shouldReconnect: () => true, // Auto-reconnect on disconnect
  });

  // Handle messages from the WebSocket server
  useEffect(() => {
    if (lastJsonMessage) {
      const { type, ...data } = lastJsonMessage;

      if (['offer', 'answer', 'ice-candidate'].includes(type)) {
        console.log("Ignore RTC", type);
        // Ignore WebRTC signaling messages here
        return;
      }

      switch (type) {
        case 'sign-in':
          console.log(`Signed in as ${data.username} (ID: ${data.userId})`);
          setUserId(data.userId);
          setuserRole(data.userRole);
          break;

        case 'update-users':
          console.log(participants);
          setParticipants(data.users);

          break;

        case 'send-message':
          setMessages((prevMessages) => [...prevMessages, { sender: data.sender, text: data.text, timestamp: data.timestamp }]);
          break;
          
          case "initiate-call":
            console.log(`Incoming call from ${data.senderId}`);
            setCallRequest(data.senderId); // Store the caller's ID
            break;

          case 'error':
            alert(data.message);
            break;

        default:
          console.log('Unhandled message:', lastJsonMessage);
      }
    }
  }, [lastJsonMessage]);

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;

    if (!userId) {
      console.log('Error: userId is not set yet.');
      return;
    }

    if (readyState !== WebSocket.OPEN) {
      console.log('WebSocket connection is not open.');
      alert('Connection lost. Reconnecting...');
      return;
    }

    sendJsonMessage({
      type: 'send-message',
      text: inputMessage,
      senderId: userId, // Explicitly pass the senderId
    });

    setInputMessage('');
  };

  
  const initiateCall = (remoteUserId) => {
    if (!remoteUserId || remoteUserId === userId) {
      alert('Cannot call yourself.');
      return;
    }
    sendJsonMessage({
      type: 'initiate-call',
      recipientId: remoteUserId,
    });
  };

  const createBreakout = (student) => {
    if (role !== 'instructor') {
      alert('Only instructors can create breakout rooms.');
      return;
    }
  
     // Navigate to BreakoutRoom with the selected student
  navigate('/breakout', {
    state: { instructor: { id: userId, username }, student },
  });
};
  
function capitalizeFirstLetter(string) {
  if (!string) return 'Unknown Role'; // Handle undefined or null roles
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatUsername(username) {
  if (!username) return 'Unknown User'; // Handle undefined or null usernames
  return username.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add spaces between camelCase words
}

  return (
    <div style={{ padding: '20px' }}>
      <h1>Chat Room</h1>
      <h3>Welcome, {username}</h3>

      {webSocketError && <div style={{ color: 'red' }}>{webSocketError}</div>}

      <div>
        <h2>Participants:</h2>
        <ul>
          {participants.map((participant) => (
            <li key={participant.id}>
              <strong>{capitalizeFirstLetter(participant.role)}</strong>: {formatUsername(participant.username || 'Unknown User')}
              {role === 'instructor' && participant.id !== userId && (
              <button onClick={() => createBreakout(participant)}>Create Breakout Room</button>
            )}
              {participant.id !== userId && (
                <button onClick={() => initiateCall(participant.id)}>Call</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll' }}>
        <h2>Messages:</h2>
        {messages.map((message, index) => (
          <p key={index}>
            <strong>{message.sender}</strong> ({new Date(message.timestamp).toLocaleTimeString()}): {message.text}
          </p>
        ))}
      </div>


      <div>
        <input
          type="text"
          placeholder="Type a message"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          style={{ margin: '10px', width: '80%' }}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>

      <div>
      {/* Other chat interface components */}
      {userId && (
        <VideoChat 
        sendJsonMessage={sendJsonMessage}
         lastJsonMessage={lastJsonMessage} 
         userId={userId} 
         username={username}
         callRequest={callRequest} // Pass the call request to VideoChat
         u
         />
      )}
      </div>

     
    </div>
      
  );
};

export default ChatInterface;

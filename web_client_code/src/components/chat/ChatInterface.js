import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';
import VideoChat from '../chat/VideoChat';

const ChatInterface = () => {
  const location = useLocation();
  const { username } = location.state || {}; // Get the username from CreateRoom.js

  const [userId, setUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [webSocketError, setWebSocketError] = useState(null); // To handle connection errors


  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(`ws://localhost:8080`, {
    onOpen: () => {
      console.log('WebSocket connected');
      sendJsonMessage({
        type: 'sign-in',
        username,
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

      switch (type) {
        case 'signed-in':
          console.log(`Signed in as ${data.username} (ID: ${data.userId})`);
          setUserId(data.userId);
          break;

        case 'update-users':
          setParticipants(data.users);
          break;

        case 'send-message':
          setMessages((prevMessages) => [...prevMessages, { sender: data.sender, text: data.text }]);
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
      return;
    }

    sendJsonMessage({
      type: 'send-message',
      text: inputMessage,
    });

    setInputMessage('');
  };

  

  

  return (
    <div style={{ padding: '20px' }}>
      <h1>Chat Room</h1>
      <h3>Welcome, {username}</h3>

      {webSocketError && <div style={{ color: 'red' }}>{webSocketError}</div>}

      <div>
        <h2>Participants:</h2>
        <ul>
          {participants.map((participant, index) => (
            <li key={index}>
              {participant}
           
              </li>
          ))}
        </ul>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll' }}>
        <h2>Messages:</h2>
        {messages.map((message, index) => (
          <p key={index}>
            <strong>{message.sender}:</strong> {message.text}
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
        <VideoChat sendJsonMessage={sendJsonMessage} lastJsonMessage={lastJsonMessage} userId={userId} />
      )}
      </div>

     
    </div>
      
  );
};

export default ChatInterface;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import useWebSocket from 'react-use-websocket';

const BreakoutRoom = () => {
  const { roomId } = useParams(); // Extract roomId from the URL
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState(location.state || null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const messagesEndRef = useRef(null);

  const localhost = 'localhost';

  // Retrieve state from localStorage if not available from location.state
  useEffect(() => {
    if (!state) {
      const storedState = localStorage.getItem(`breakoutRoomState-${roomId}`);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        console.log('Retrieved state from localStorage:', parsedState);
        setState(parsedState); // Set the retrieved state
      } else {
        console.error('No state found in localStorage for this room.');
        navigate('/'); // Redirect to the main chat room
      }
    }
  }, [state, roomId, navigate]);

  // WebSocket hook
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    `ws://${localhost}:8080/breakout/${roomId}`,
    {
      onOpen: () => {
        console.log('WebSocket connection established for breakout room');
        if (state && roomId) {
          sendJsonMessage({
            type: 'breakout-room-info',
            roomId: roomId,
            instructor: { id: state.instructor.id, username: state.instructor.username },
            student: { id: state.student.id, username: state.student.username },
          });
        }
      },
      onClose: () => {
        console.log('WebSocket connection closed for breakout room');
      },
      onError: (event) => {
        console.error('WebSocket error:', event);
      },
      shouldReconnect: () => true, // Automatically attempt to reconnect
    }
  );

  // Handle messages from the WebSocket server
  useEffect(() => {
    if (lastJsonMessage) {
      const { type, ...data } = lastJsonMessage;

      switch (type) {
        case 'breakout-message':
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              sender: data.sender,
              text: data.text,
              timestamp: data.timestamp,
            },
          ]);
          break;

        case 'update-participants':
          setParticipants(data.participants);
          console.log('Updated participants:', data.participants);
          break;

        case 'end-breakout-room':
          if (data.roomId === roomId) {
            alert('The breakout room has been ended.');
            handleLeaveBreakoutRoom();
          }
          break;

        default:
          console.log('Unhandled message:', lastJsonMessage);
      }
    }
  }, [lastJsonMessage, roomId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send a message handler
  const handleSendMessage = useCallback(() => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || !state) return;

    sendJsonMessage({
      type: 'breakout-message',
      roomId,
      sender: state.instructor.username,
      text: trimmedMessage,
      timestamp: new Date().toISOString(),
    });

    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: 'Me', text: trimmedMessage },
    ]);
    setInputMessage('');
  }, [inputMessage, roomId, sendJsonMessage, state]);

  // Leave breakout room handler
  const handleLeaveBreakoutRoom = useCallback(() => {
    if (readyState === WebSocket.OPEN && state) {
      sendJsonMessage({
        type: 'leave-breakout-room',
        roomId,
        userId: state.instructor.id,
      });
    }

    navigate('/'); // Navigate back to main interface
  }, [roomId, sendJsonMessage, state, navigate, readyState]);

  // Prevent rendering until state is loaded
  if (!state || !state.instructor || !state.student) {
    return <div>Loading breakout room...</div>;
  }

  return (
    <div className="breakout-room-container">
      <h2>Breakout Room</h2>
      <div className="room-participants">
        <h3>Instructor: {state.instructor.username}</h3>
        <h3>Student: {state.student.username}</h3>
      </div>

      <div className="chat-container">
        <div className="messages-list">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.sender === 'Me' ? 'sent' : 'received'}`}
            >
              <strong>{message.sender}:</strong> {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input">
          <input
            type="text"
            placeholder="Type a message"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button onClick={handleSendMessage}>Send</button>
        </div>
      </div>

      <div className="room-controls">
        <button onClick={handleLeaveBreakoutRoom} className="leave-room-btn">
          Leave Room
        </button>
      </div>
    </div>
  );
};

export default BreakoutRoom;

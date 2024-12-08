import React, { useState, useEffect, useRef } from 'react';
import VideoChat from '../chat/VideoChat';

const BreakoutRoom = ({ instructor, student, sendJsonMessage, lastJsonMessage }) => {
  const [roomActive, setRoomActive] = useState(false); // To manage breakout room state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomId, setRoomId] = useState(null);

  useEffect(() => {
    // Generate a unique room ID based on instructor and student
    const id = `${instructor.id}-${student.id}`;
    setRoomId(id);

    // Notify server to create a breakout room
    sendJsonMessage({
      type: 'create-breakout-room',
      roomId: id,
      participants: [instructor.id, student.id],
    });

    setRoomActive(true);
  }, [instructor, student, sendJsonMessage]);

  useEffect(() => {
    if (lastJsonMessage) {
      const { type, ...data } = lastJsonMessage;

      switch (type) {
        case 'breakout-message':
          if (data.roomId === roomId) {
            setMessages((prevMessages) => [...prevMessages, { sender: data.sender, text: data.text }]);
          }
          break;

        case 'end-breakout-room':
          if (data.roomId === roomId) {
            alert('The breakout room has been ended.');
            setRoomActive(false);
          }
          break;

        default:
          break;
      }
    }
  }, [lastJsonMessage, roomId]);

  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;

    sendJsonMessage({
      type: 'breakout-message',
      roomId,
      sender: instructor.id,
      text: inputMessage,
    });

    setMessages((prevMessages) => [...prevMessages, { sender: 'Me', text: inputMessage }]);
    setInputMessage('');
  };

  const endBreakoutRoom = () => {
    sendJsonMessage({
      type: 'end-breakout-room',
      roomId,
    });
    setRoomActive(false);
  };

  if (!roomActive) {
    return <div>Breakout room is not active.</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Breakout Room</h2>
      <h3>Instructor: {instructor.username}</h3>
      <h3>Student: {student.username}</h3>

      <VideoChat
        sendJsonMessage={sendJsonMessage}
        lastJsonMessage={lastJsonMessage}
        userId={instructor.id}
        username={instructor.username}
      />

      <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'scroll' }}>
        <h3>Chat</h3>
        {messages.map((message, index) => (
          <p key={index}>
            <strong>{message.sender}:</strong> {message.text}
          </p>
        ))}
      </div>

      <input
        type="text"
        placeholder="Type a message"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        style={{ width: '80%', margin: '10px' }}
      />
      <button onClick={handleSendMessage}>Send</button>

      <div style={{ marginTop: '10px' }}>
        <button onClick={endBreakoutRoom} style={{ color: 'red', fontWeight: 'bold' }}>
          End Breakout Room
        </button>
      </div>
    </div>
  );
};

export default BreakoutRoom;

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

  const localhost =  '10.62.77.181';

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
       
          setParticipants(data.users);
          console.log(participants);

          break;

        case 'send-message':
          setMessages((prevMessages) => [...prevMessages, { sender: data.sender, text: data.text, timestamp: data.timestamp }]);
          break;
          
          case "initiate-call":
            console.log(`Incoming call from ${data.senderId}`);
            setCallRequest(data.senderId); // Store the caller's ID
            break;

          case 'create-breakout-room':
          // Handle breakout room creation for both instructor and student
          if (data.roomId && data.instructor && data.student) {
            // Check if the current user is either the instructor or the student
            const isInstructor = data.instructor.id === userId;
            const isStudent = data.student.id === userId;

            if (isInstructor || isStudent) {
              const stateData = {
                instructor: data.instructor,
                student: data.student,
                roomId: data.roomId,
              };

              // Save state to localStorage
              localStorage.setItem(`breakoutRoomState-${data.roomId}`, JSON.stringify(stateData));

              // Open breakout room
              const breakoutUrl = `/breakout/${data.roomId}`;
              
              if (isInstructor) {
                // Open in a new tab for instructor
                const newTab = window.open(breakoutUrl, '_blank');
                if (newTab) newTab.focus();
              } else {
                // Navigate in the current window for student
                navigate(breakoutUrl, { state: stateData });
              }
            }
          }
          break;


          case 'join-breakout-room':
            // Automatically navigate to the breakout room for the student
            if (role === 'student' && data.roomId && data.student && data.breakoutUrl) {
              console.log('Received join breakout room request with URL:', data.breakoutUrl);
          
              // Ensure that the student matches the current user's ID
              if (data.student.id !== userId) {
                console.error('This breakout room is not for the current user.');
                return;
              }
          
              // Save the state to localStorage for persistence
              const stateData = {
                instructor: data.instructor,
                student: data.student,
                roomId: data.roomId,
                breakoutUrl: data.breakoutUrl,
              };
              localStorage.setItem(`breakoutRoomState-${data.roomId}`, JSON.stringify(stateData));
          
              // Create a new WebSocket connection for the breakout room
              const breakoutWebSocket = new WebSocket(data.breakoutUrl);
          
              breakoutWebSocket.onopen = () => {
                console.log('Connected to breakout room:', data.roomId);
                breakoutWebSocket.send(
                  JSON.stringify({
                    type: 'join',
                    roomId: data.roomId,
                    userId,
                  })
                );
              };
          
              breakoutWebSocket.onmessage = (event) => {
                const messageData = JSON.parse(event.data);
                console.log('Message from breakout room:', messageData);
          
                // Handle messages specific to the breakout room
                switch (messageData.type) {
                  case 'breakout-message':
                    console.log(`Breakout message: ${messageData.text}`);
                    break;
          
                  case 'end-breakout-room':
                    console.log('Breakout room ended.');
                    breakoutWebSocket.close();
                    break;
          
                  default:
                    console.log('Unhandled breakout room message type:', messageData.type);
                    break;
                }
              };
          
              breakoutWebSocket.onclose = () => {
                console.log('Disconnected from breakout room:', data.roomId);
              };
          
              breakoutWebSocket.onerror = (error) => {
                console.error('Breakout WebSocket error:', error);
              };
          
              // Optionally navigate to a breakout room page with the roomId
              navigate(`/breakout/${data.roomId}`, {
                state: stateData,
              });
            }
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
  
    const roomId = `${username}-${student.username}`;
    console.log('Creating breakout room with ID:', roomId);
  
    const stateData = {
      instructor: { id: userId, username },
      student: { id: student.id, username: student.username },
      roomId,
    };
  
    // Save state to localStorage
    localStorage.setItem(`breakoutRoomState-${roomId}`, JSON.stringify(stateData));
    // Open in a new tab
    const breakoutUrl = `/breakout/${roomId}`;
  
    // Notify the server to create the breakout room
    sendJsonMessage({
      type: 'create-breakout-room',
      roomId,
      instructor: stateData.instructor,
      student: stateData.student,
      breakoutUrl:breakoutUrl
    });
  
 
    const newTab = window.open(breakoutUrl, '_blank');
    if (newTab) newTab.focus();
  };
  

//Disconnect WebSocekt when join another room
const disconnectWebSocket = () => {
  if (readyState === WebSocket.OPEN) {
    console.log('Disconnecting from public WebSocket');
    sendJsonMessage({ type: 'disconnect', userId });
  }
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
   {/*    {userId && (
        <VideoChat 
        sendJsonMessage={sendJsonMessage}
         lastJsonMessage={lastJsonMessage} 
         userId={userId} 
         username={username}
         callRequest={callRequest} // Pass the call request to VideoChat
         u
         />
      )}  */}
      </div>

     
    </div>
      
  );
};

export default ChatInterface;

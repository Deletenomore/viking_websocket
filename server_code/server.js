const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

//To allow the other devices to connect to the server, hook the host to real ip address of the local host
//For example, if local IP: 192.168.0.1, change host:'192.168.0.1'
//At the same time, change the ChatInterface websocket listening as well.  useWebSocket('ws://192.168.0.1:8080', {....})

// Create a WebSocket server
const wss = new WebSocket.Server({port: 8080 });

// Global dictionary to track all users
const users = {}; // Maps userId to WebSocket and username

// WebSocket server connection
wss.on('connection', (ws) => {
  const userId = uuidv4(); // Generate a unique userId for the user
  let voiceChatOn = false; // Default voice chat status is off

  // Log when the connection opens
  console.log(`WebSocket connection opened for userId: ${userId}`);

  // Error handling: WebSocket 'close' event
  ws.on('close', () => {
    console.log(`WebSocket connection closed for userId: ${userId}`);
    delete users[userId]; // Remove user from global users dictionary
    broadcast({ type: 'update-users', users: Object.values(users).map((user) => user.username) });
  });

  // Error handling: WebSocket 'error' event
  ws.on('error', (error) => {
    console.error(`WebSocket error for userId: ${userId}`, error);
    // Close the connection if there's an error
    ws.close();
  });

  // Handle incoming messages from the client
  ws.on('message', (message) => {
    try {

      const data = JSON.parse(message); // Parse the incoming message

      switch (data.type) {
        case 'sign-in': {
          const username = data.username || 'Anonymous';

          // Save user details in the global dictionary
          users[userId] = { ws, username };
          ws.userId = userId; // Associate the WebSocket with the userId

          console.log(`User signed in: ${username} (${userId})`);

          // Send the userId and username back to the client
          ws.send(JSON.stringify({ type: 'signed-in', userId, username }));

          // Notify all other users about the new participant
          broadcast({ type: 'update-users', users: Object.values(users).map((user) => user.username) });
          break;
        }

        case 'send-message': {
          const senderId = ws.userId;
          const sender = users[senderId]?.username || 'Unknown';

          if (!senderId || !data.text) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message parameters' }));
            return;
          }

          console.log(`Broadcasting message from ${sender} (${senderId}): ${data.text}`);

          // Broadcast the message to all connected users
          broadcast({ type: 'send-message', text: data.text, sender });
          break;
        }

       //Toggle voice chat 
        case 'toggle-voice-chat': {
          voiceChatOn = !voiceChatOn; // Toggle the voice chat state
          users[userId].voiceChatOn = voiceChatOn; // Update the voice chat status
          const currentUser = users[userId];
          console.log(`User ${userId} toggled voice chat: ${currentUser.voiceChatOn ? 'on' : 'off'}`);
          broadcast({
            type: 'voice-chat-status',
            userId,
            voiceChatOn: currentUser.voiceChatOn,
          });
          break;
        }

        // New: Handle WebRTC signaling
        case 'offer': {
          console.log(`Broadcasting offer from ${userId}`);
          sendToAllUsers({ type: 'offer', sdp: data.sdp, from: userId }, userId);
          break;
        }
        
        case 'answer': {
          console.log(`Broadcasting answer from ${userId}`);
          sendToAllUsers({ type: 'answer', sdp: data.sdp, from: userId }, userId);
          break;
        }
        
        case 'ice-candidate': {
          console.log(`Broadcasting ICE candidate from ${userId}`);
          sendToAllUsers({ type: 'ice-candidate', candidate: data.candidate, from: userId }, userId);
          break;
        }
        
        
        default:
          console.log('Unhandled WebSocket message:', data);
          break;
      }


    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Helper function to broadcast messages to all connected users
  function broadcast(data) {
    Object.values(users).forEach((user) => {
      if (user.ws.readyState === WebSocket.OPEN) {
        try {
          user.ws.send(JSON.stringify(data)); 
        } catch (sendError) {
          console.error(`Error sending message to user ${user.userId}`, sendError);
        }
      }
    });
  }

  function sendToAllUsers(data, excludeUserId) {
    Object.keys(users).forEach((userId) => {
      if (userId !== excludeUserId) { // Exclude the sender
        const user = users[userId];
        if (user.ws.readyState === WebSocket.OPEN) {
          try {
            user.ws.send(JSON.stringify(data));
            console.log(`Sent data to user ${userId}:`, data);
          } catch (error) {
            console.error(`Failed to send data to user ${userId}:`, error.message);
          }
        }
      }
    });
  }
  
});



console.log('WebSocket server is running on ws://localhost:8080');

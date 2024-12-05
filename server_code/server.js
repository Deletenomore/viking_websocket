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
    
    // Notify others that this user has disconnected
    broadcastUserDisconnection(userId);
    delete users[userId]; // Remove user from global users dictionary
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
      // Associate userId with the WebSocket
      data.senderId = userId;

      switch (data.type) {
        case 'sign-in': {
          const username = data.username || 'Anonymous';

          // Save user details in the global dictionary
          users[userId] = { 
            ws, 
            username, 
            isBroadcasting: false 
          };

          console.log(`User signed in: ${username} (${userId})`);

          // Send the userId and username back to the client
          ws.send(JSON.stringify({ 
            type: 'signed-in', 
            userId, 
            username 
          }));

          // Notify all other users about the new participant
          broadcastUserList();
          break;
        }

        case 'send-message': {
          const senderId = data.senderId; // Correct senderId usage
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
        
        case 'start-broadcast': {
          // Mark this user as a broadcaster
          if (users[userId]) {
            users[userId].isBroadcasting = true;
          }

          console.log(`User ${userId} started broadcasting`);
          
          // Notify all other users that this user wants to start a broadcast
          broadcastToOthers({ 
            type: 'broadcast-request', 
            senderId: userId,
            senderUsername: users[userId]?.username || 'Anonymous'
          }, userId);
          
          break;
        }


         // WebRTC Signaling Messages
          case 'offer':
          case 'answer':
          case 'ice-candidate': {
            // Forward signaling messages to the specific recipient
            forwardSignalingMessage(data);
            break;
          }
  
          case 'stop-broadcast': {
            // Mark this user as no longer broadcasting
            if (users[userId]) {
              users[userId].isBroadcasting = false;
            }
  
            // Notify others that broadcast has stopped
            broadcastToOthers({
              type: 'broadcast-ended',
              senderId: userId
            }, userId);
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

    // Helper function to broadcast the current user list
    function broadcastUserList() {
      broadcast({ 
        type: 'update-users', 
        users: Object.entries(users).map(([id, user]) => ({
          id, // Add the userId as id
          username: user.username,
          isBroadcasting: user.isBroadcasting
        }))
      });
    }

   // Helper function to broadcast messages to all users except the sender
   function broadcastToOthers(data, excludeUserId) {
    Object.keys(users).forEach((userId) => {
      if (userId !== excludeUserId && users[userId].ws.readyState === WebSocket.OPEN) {
        try {
          users[userId].ws.send(JSON.stringify(data));
        } catch (sendError) {
          console.error(`Failed to send message to user ${userId}`, sendError);
        }
      }
    });
  }

  // Helper function to forward WebRTC signaling messages
  function forwardSignalingMessage(data) {
    const recipientId = data.recipientId;
    const recipient = users[recipientId];

    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
      try {
        recipient.ws.send(JSON.stringify(data));
      } catch (sendError) {
        console.error(`Error forwarding ${data.type} to recipient`, sendError);
      }
    } else {
      console.log(`Recipient ${recipientId} not found or not connected`);
    }
  }

  // Helper function to broadcast user disconnection
  function broadcastUserDisconnection(disconnectedUserId) {
    broadcastToOthers({
      type: 'user-disconnected',
      senderId: disconnectedUserId
    }, disconnectedUserId);
  }
  
});



console.log('WebSocket server is running on ws://localhost:8080');

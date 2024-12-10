var http = require('http');
const WebSocket = require('ws');
const express = require('express');
const { v4: uuidv4 } = require('uuid');


const app = express();
// Example route
app.get('/', (req, res) => {
  res.send('Hello, HTTPS World!');
});

// Define the hostname and port
const HOSTNAME = '0.0.0.0'; // Use '0.0.0.0' to accept requests from any IP
const PORT = 8080;
const WSSPORT = 443;

// Global dictionary to track all users
const users = {}; // Maps userId to WebSocket and username
const breakoutRoom = {};
const rooms = {}; // Track rooms and participants


// Create the HTTP server
const webServer = http.createServer(app);
// Start the server
webServer.listen(PORT,HOSTNAME, () => {
  console.log(`Server is listening on port ${PORT}`);
});

//WebSocket server for Public Room
const wss = new WebSocket.Server({ noServer:true});
wss.on('connection', (ws) => {
  const userId = uuidv4(); // Generate a unique userId for the user
  console.log(`WebSocket connection opened for userId: ${ userId}`);

  ws.on('close', () => {
    console.log(`WebSocket connection closed for user: ${ users[userId].role}: ${ users[userId].username}`);
    delete users[userId];
    broadcastUserList();
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      data.senderId = userId;

      switch (data.type) {
        case 'sign-in': {
          let username = data.username || 'Anonymous';
          let userRole = data.role;
          // Check if an instructor is already logged in
          const instructorExists = Object.values(users).some(
            (user) => user.role === 'instructor'
          );

          if (userRole === 'instructor' && instructorExists) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'An instructor is already logged in.',
              })
            );
            return;
          }

          username = ensureUniqueUsername(username); // Ensure the username is unique
          users[userId] = { ws, username,role: userRole };
          console.log(`User signed in: ${userRole} ${username} (${userId})`);
          ws.send(JSON.stringify({ type: 'sign-in', userId, username, role:userRole }));
          broadcastUserList();
          break;
        }

        case 'send-message': {
          const sender = users[userId]?.username || 'Unknown';
          if (!data.text) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message parameters' }));
            return;
          }
          const timestamp = new Date().toISOString(); // Generate timestamp
          console.log(`Broadcasting message from ${sender} at ${timestamp}: ${data.text}`);
          broadcast({ type: 'send-message', sender, text: data.text, timestamp });
          break;
        }

        case 'hang-up': {
          const recipientId = data.recipientId; // Ensure recipientId is included
          console.log(`User ${userId} initiated hang-up with recipient ${recipientId}`);

          if (recipientId) {
            const recipient = users[recipientId];
            if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
              recipient.ws.send(JSON.stringify({ type: 'hang-up', senderId: userId }));
            } else {
              console.log(`Recipient ${recipientId} not found or not connected`);
            }
          }
          break;
        }

        //Breakout room request
        case 'create-breakout-room': {
          console.log('raw', data);
          const { roomId, instructor, student } = data;
        
          if (!roomId || !instructor || !student) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid breakout room data' }));
            return;
          }
        
          // Create the breakout room
          breakoutRoom[roomId] = { instructor, student };
          console.log(`Breakout room ${roomId} created for instructor ${instructor} and student ${student}`);
        
          // Construct the breakout URL
          const breakoutUrl = `ws://localhost:8080/breakout/${roomId}`;
        
          // Notify the student to join the breakout room
          const studentConnection = users[student.id];
          if (studentConnection && studentConnection.ws.readyState === WebSocket.OPEN) {
            const role = 'student';
            console.log('Sending join breakout room request to student');
            studentConnection.ws.send(
              JSON.stringify({
                type: 'join-breakout-room',
                roomId,
                student,
                instructor,
                role,
                breakoutUrl, // Include the breakout URL in the message
              })
            );
          } else {
            console.log('Student connection not found or unavailable.');
          }
        
          break;
        }
        

        default: {
          // Handle signaling messages (e.g., offer, answer, ice-candidate)
          const recipientId = data.recipientId;
          const recipient = users[recipientId];
          console.log('Video signal type', data.type);
          if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
            recipient.ws.send(JSON.stringify(data));
          } else {
            console.log(`Recipient ${recipientId} not found or not connected`);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  function ensureUniqueUsername(username) {
    let uniqueUsername = username;
    let counter = 1;
    const usernames = Object.values(users).map((user) => user.username);
    while (usernames.includes(uniqueUsername)) {
      uniqueUsername = `${username}${counter}`;
      counter++;
    }
    return uniqueUsername;
  }

  function broadcastUserList() {
    const userListMsg = {
      type: 'update-users',
      users: Object.entries(users).map(([id, user]) => ({ id, username: user.username,role: user.role})),
    };
    broadcast(userListMsg);
  }

  function broadcast(data) {
    Object.values(users).forEach((user) => {
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(data));
      }
    });
  }
});


//Breakout room websocket server
const breakoutRoomUsers = {}; // Track connections in each breakout room
const breakoutWSS = new WebSocket.Server({ noServer: true });
breakoutWSS.on('connection', (ws, request) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const roomId = pathname.split('/breakout/')[1]; // Extract roomId from the URL

    if (!roomId || !breakoutRoom[roomId]) {
        console.log(`Invalid breakout room connection attempt for roomId: ${roomId}`);
        ws.close();
        return;
    }

    console.log(`Breakout WebSocket connection opened for roomId: ${roomId}`);
    const { instructor, student } = breakoutRoom[roomId];

    // Add WebSocket connection to breakoutRoomUsers
    if (!breakoutRoomUsers[roomId]) {
        breakoutRoomUsers[roomId] = [];
    }
    breakoutRoomUsers[roomId].push({ ws, userId: ws.userId });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Breakout room (${roomId}) message:`, data);

            switch (data.type) {
                case 'breakout-message': {
                    const sender = data.sender;
                    const timestamp = new Date().toISOString();
                    console.log(`Broadcasting message in breakout room ${roomId} from ${sender}: ${data.text}`);

                    // Broadcast to all connections in this breakout room
                    breakoutRoomUsers[roomId].forEach((userConnection) => {
                        if (userConnection.ws.readyState === WebSocket.OPEN) {
                            userConnection.ws.send(JSON.stringify({
                                type: 'breakout-message',
                                roomId,
                                sender,
                                text: data.text,
                                timestamp,
                            }));
                        }
                    });
                    break;
                }
                case 'leave-breakout-room': {
                    console.log(`User ${data.userId} leaving breakout room ${roomId}`);
                    breakoutRoomUsers[roomId] = breakoutRoomUsers[roomId].filter(
                        (user) => user.userId !== data.userId
                    );
                    break;
                }
                case 'end-breakout-room': {
                    console.log(`Ending breakout room ${roomId}`);
                    breakoutRoomUsers[roomId].forEach((userConnection) => {
                        if (userConnection.ws.readyState === WebSocket.OPEN) {
                            userConnection.ws.send(JSON.stringify({ type: 'end-breakout-room', roomId }));
                        }
                    });
                    delete breakoutRoomUsers[roomId];
                    delete breakoutRoom[roomId];
                    break;
                }
                default:
                    console.log(`Unhandled message type in breakout room ${roomId}:`, data.type);
                    break;
            }
        } catch (error) {
            console.error(`Error handling breakout WebSocket message for room ${roomId}:`, error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        console.log(`Breakout WebSocket connection closed for roomId: ${roomId}`);
        breakoutRoomUsers[roomId] = breakoutRoomUsers[roomId].filter((user) => user.ws !== ws);
    });
});



// Upgrade logic for WebSocket connections
webServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname.startsWith('/breakout')) {
    breakoutWSS.handleUpgrade(request, socket, head, (ws) => {
      breakoutWSS.emit('connection', ws, request);
    });
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});


console.log('WebSocket server is running on ws://localhost:8080');

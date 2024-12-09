const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const HOSTNAME = '0.0.0.0';
const PORT = 8080;

// Global dictionaries to track users and connections
const users = {}; // Maps userId to user information
const userConnections = {}; // Maps userId to an array of WebSocket connections
const breakoutRooms = {}; // Store breakout room information

const webServer = http.createServer(app);
webServer.listen(PORT, HOSTNAME, () => {
  console.log(`Server is listening on port ${PORT}`);
});

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws, request) => {
  const userId = uuidv4();
  console.log(`WebSocket connection opened for userId: ${userId}`);

  // Initialize connections array for this user if not exists
  if (!userConnections[userId]) {
    userConnections[userId] = [];
  }
  userConnections[userId].push(ws);

  ws.on('close', () => {
    console.log(`WebSocket connection closed for userId: ${userId}`);
    
    // Remove this specific connection
    if (userConnections[userId]) {
      userConnections[userId] = userConnections[userId].filter(connection => connection !== ws);
      
      // If no connections remain, remove the user
      if (userConnections[userId].length === 0) {
        delete userConnections[userId];
        delete users[userId];
      }
    }
    
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

          username = ensureUniqueUsername(username);
          users[userId] = { 
            id: userId, 
            username, 
            role: userRole,
            connections: userConnections[userId]
          };
          
          console.log(`User signed in: ${userRole} ${username} (${userId})`);
          ws.send(JSON.stringify({ 
            type: 'sign-in', 
            userId, 
            username, 
            role: userRole 
          }));
          broadcastUserList();
          break;
        }

        case 'send-message': {
          const sender = users[userId]?.username || 'Unknown';
          if (!data.text) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message parameters' }));
            return;
          }
          const timestamp = new Date().toISOString();
          console.log(`Broadcasting message from ${sender} at ${timestamp}: ${data.text}`);
          broadcast({ type: 'send-message', sender, text: data.text, timestamp });
          break;
        }

        case 'create-breakout-room': {
          const { roomId, instructor, student } = data;
          
          // Store breakout room information
          breakoutRooms[roomId] = {
            instructor: { id: instructor.id, username: instructor.username },
            student: { id: student.id, username: student.username },
            connections: [] // Store WebSocket connections for this room
          };

          // Notify the student to join the breakout room
          const studentConnections = userConnections[student.id] || [];
          studentConnections.forEach(connection => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(
                JSON.stringify({
                  type: 'join-breakout-room',
                  roomId,
                  instructor,
                  student,
                })
              );
            }
          });

          console.log(`Breakout room ${roomId} created by ${instructor.username} for ${student.username}`);
          break;
        }

        default: {
          // Handle signaling messages (e.g., offer, answer, ice-candidate)
          const recipientId = data.recipientId;
          const recipientConnections = userConnections[recipientId] || [];
          
          recipientConnections.forEach(connection => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(JSON.stringify(data));
            }
          });
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
      users: Object.entries(users).map(([id, user]) => ({ 
        id, 
        username: user.username, 
        role: user.role 
      })),
    };
    broadcast(userListMsg);
  }

  function broadcast(data) {
    Object.values(userConnections).forEach((connections) => {
      connections.forEach((connection) => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify(data));
        }
      });
    });
  }
});

// Breakout WebSocket server
const breakoutWSS = new WebSocket.Server({ noServer: true });
breakoutWSS.on('connection', (ws, request) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const roomId = pathname.split('/breakout/')[1];

  if (!roomId || !breakoutRooms[roomId]) {
    console.log(`Invalid breakout room connection attempt for roomId: ${roomId}`);
    ws.close();
    return;
  }

  console.log(`Breakout WebSocket connection opened for roomId: ${roomId}`);
  
  // Add this connection to the room's connections
  breakoutRooms[roomId].connections.push(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Breakout room (${roomId}) message:`, data);

      switch (data.type) {
        case 'breakout-message': {
          const roomConnections = breakoutRooms[roomId].connections;
          
          // Broadcast to all connections in this room
          roomConnections.forEach(connection => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(JSON.stringify({
                type: 'breakout-message',
                roomId,
                sender: data.sender,
                text: data.text,
                timestamp: new Date().toISOString(),
              }));
            }
          });
          break;
        }

        case 'breakout-room-info':
          // Confirm room connection
          ws.send(JSON.stringify({ 
            type: 'room-connection-confirmed', 
            roomId,
            ...breakoutRooms[roomId]
          }));
          break;

        case 'leave-breakout-room':
          // Remove this connection from room connections
          breakoutRooms[roomId].connections = 
            breakoutRooms[roomId].connections.filter(conn => conn !== ws);
          
          if (breakoutRooms[roomId].connections.length === 0) {
            delete breakoutRooms[roomId];
          }
          break;

        case 'end-breakout-room':
          // Close all connections and remove the room
          breakoutRooms[roomId].connections.forEach(conn => {
            if (conn.readyState === WebSocket.OPEN) {
              conn.send(JSON.stringify({
                type: 'end-breakout-room',
                roomId,
              }));
              conn.close();
            }
          });
          delete breakoutRooms[roomId];
          break;
      }
    } catch (error) {
      console.error(`Error in breakout room ${roomId}:`, error);
    }
  });

  ws.on('close', () => {
    // Remove this connection from room connections
    if (breakoutRooms[roomId]) {
      breakoutRooms[roomId].connections = 
        breakoutRooms[roomId].connections.filter(conn => conn !== ws);
      
      if (breakoutRooms[roomId].connections.length === 0) {
        delete breakoutRooms[roomId];
      }
    }
    console.log(`Breakout WebSocket connection closed for roomId: ${roomId}`);
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

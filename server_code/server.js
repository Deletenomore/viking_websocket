var http = require('http');
var https = require('https');
var fs = require('fs');
const WebSocket = require('ws');
const express = require('express');
const { v4: uuidv4 } = require('uuid');


const app = express();


// HTTPS connections.
// Load the self-signed certificate and private key
const httpsOptions = {
  key: fs.readFileSync('localhost.key'),
  cert: fs.readFileSync('localhost.crt'),
  
};


// Example route
app.get('/', (req, res) => {
  res.send('Hello, HTTPS World!');
});


try {
  httpsOptions.key = fs.readFileSync(keyFilePath);
  console.log( httpsOptions.key);
  try {
    httpsOptions.cert = fs.readFileSync(certFilePath);
  } catch(err) {
    httpsOptions.key = null;
    httpsOptions.cert = null;
  }
} catch(err) {
  httpsOptions.key = null;
  httpsOptions.cert = null;
}

// If we were able to get the key and certificate files, try to
// start up an HTTPS server.

var webServer = null;

try {
  if (httpsOptions.key && httpsOptions.cert) {
    webServer = https.createServer(httpsOptions, handleWebRequest);
  }
} catch(err) {
  webServer = null;
}

if (!webServer) {
  try {
    webServer = http.createServer({}, handleWebRequest);
  } catch(err) {
    webServer = null;
    log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
  }
}


// Our HTTPS server does nothing but service WebSocket
// connections, so every request just returns 404. Real Web
// requests are handled by the main server on the box. If you
// want to, you can return real HTML here and serve Web content.

function handleWebRequest(request, response) {
  log ("Received request for " + request.url);
  response.writeHead(404);
  response.end();
}

// Spin up the HTTPS server on the port assigned to this sample.
// This will be turned into a WebSocket port very shortly.


// Start the server
const PORT = 8080;
webServer.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server: webServer });

// Global dictionary to track all users
const users = {}; // Maps userId to WebSocket and username

wss.on('connection', (ws) => {
  const userId = uuidv4(); // Generate a unique userId for the user
  console.log(`WebSocket connection opened for userId: ${userId}`);

  ws.on('close', () => {
    console.log(`WebSocket connection closed for userId: ${userId}`);
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

        

        default: {
          // Handle signaling messages (e.g., offer, answer, ice-candidate)
          const recipientId = data.recipientId;
          const recipient = users[recipientId];
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

console.log('WebSocket server is running on ws://localhost:8080');

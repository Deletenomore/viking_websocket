// import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreateRoom from './components/create-room/CreateRoom';
import ChatInterface from './components/chat/ChatInterface';


const App = () => {
  // const [ws, setWs] = useState(null);

  // useEffect(() => {
  //   // Initialize WebSocket connection
  //   const socket = new WebSocket('ws://localhost:8080'); // Replace with your WebSocket server URL
  //   setWs(socket);

  //   // Handle WebSocket connection lifecycle
  //   socket.onopen = () => console.log('WebSocket connected');
  //   socket.onclose = () => console.log('WebSocket disconnected');
  //   socket.onerror = (error) => console.error('WebSocket error:', error);

  //   return () => {
  //     socket.close();
  //   };
  // }, []);

  return (
      <Router>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/chat" element={<ChatInterface />} />
      </Routes>
    </Router>
  );
};

export default App;


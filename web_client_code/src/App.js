// import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreateRoom from './components/create-room/CreateRoom';
import ChatInterface from './components/chat/ChatInterface';
import BreakoutRoom from './components//chat/BreakoutRoom';


const App = () => {
;

  return (
      <Router>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/chat" element={<ChatInterface />} />
        <Route path="/breakout/:roomId" element={<BreakoutRoom />} />
      </Routes>
    </Router>
  );
};

export default App;


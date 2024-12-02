// part of frontend
// App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ChatInterface from './components/chat/ChatInterface';
import CreateThread from './components/CreateThread';
import CreateCategory from './components/CreateCategory';
import CreateRoom from './components/create-room/CreateRoom';
import './colors.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

function App() {
  const [theme, setTheme] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  useEffect(() => {
    // Listen for changes in system theme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className="min-vh-100">
      <div className={`min-vh-100 ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light'}`}>
        <Router>
          <Routes>
            {/* <Route path="/" element={<Login theme={theme} />} /> */}
            <Route path="/" element={<Navigate to="/chat" replace />} />
            {/* <Route path="/login" element={<Login theme={theme} />} />  */}
            {/* Duplicate link, for ease of navigation */}
            <Route path="/chat" element={<ChatInterface theme={theme} />} />
            {/* <Route path="/forgot-password" element={<ForgotPassword theme={theme} />} /> */}
            {/* <Route path="/register" element={<Register theme={theme} />} /> */}
            <Route path="/create-room" element={<CreateRoom theme={theme} />} />
            {/* New URL-based routes */}
            <Route path="/v/:roomUrl" element={<ChatInterface theme={theme} />} />
            <Route path="/v/:roomUrl/create-category" element={<CreateCategory theme={theme} />} />
            <Route path="/v/:roomUrl/:channelId" element={<ChatInterface theme={theme} />} />
            <Route path="/v/:roomUrl/:channelId/:threadId" element={<ChatInterface theme={theme} />} />
            {/* Keep create thread route but update it to match new URL pattern */}
            <Route path="/v/:roomUrl/create-thread" element={<CreateThread theme={theme} />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </Router>
      </div>
    </div>
  );
}

//frontend file structure DO NOT DELETE THIS
/*
src/
  ├── hooks/
  |   ├─ useFetch.js
  |   └─ useResponsive.js
  ├── components/
  |   ├─ chat/
  |   |  ├─ ChatInterface.js
  |   |  ├─ ContextMenu.js
  |   |  ├─ RoomSidebar.js
  |   |  ├─ ThreadList.js
  |   |  └─ ChannelSidebar.js
  |   ├─ create-room/
  |   |  ├─ CreateRoom.js
  |   |  ├─ DetailsForm.js
  |   |  ├─ index.js
  |   |  ├─ Layout.js
  |   |  └─ SettingsForm.js
  |   ├─ CreateChannel.js
  |   ├─ CreateThread.js
  |   ├─ ForgotPassword.js
  |   ├─ Login.js
  |   ├─ Register.js
  |   ├─ CreateCategory.js
  |   └─ ResetPassword.js
  ├── App.js
  ├── config.js
  ├── index.js
  ├── setupTests.js
  └── colors.css
  */

export default App;

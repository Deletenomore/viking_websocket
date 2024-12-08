import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateRoom = () => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('student'); // Default role is 'student'
  const navigate = useNavigate();

  const handleSignIn = () => {
    if (!username) {
      alert('Please enter a username.');
      return;
    }

    if (!role) {
      alert('Please select a role.');
      return;
    }

    // Navigate to the chat interface and pass the username
    navigate('/chat', { state: { username,role } });
  };

  return (
    <div style={{ padding: '20px' }}>
    <h1>Sign In to Chat</h1>
    <div>
      <label htmlFor="username">Enter your username:</label>
      <input
        type="text"
        id="username"
        placeholder="Your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ margin: '10px' }}
      />
    </div>
    <div>
      <label htmlFor="role">Select your role:</label>
      <select
        id="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        style={{ margin: '10px' }}
      >
        <option value="instructor">Instructor</option>
        <option value="student">Student</option>
      </select>
    </div>
    <button onClick={handleSignIn}>Sign In</button>
  </div>
  );
};

export default CreateRoom;

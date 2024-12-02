// part of frontend
// components/CreateThread.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import 'bootstrap/dist/css/bootstrap.min.css';

const CreateThread = ({ theme }) => {
  const { roomUrl, channelId } = useParams();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(channelId || '');
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const authToken = localStorage.getItem('authToken');
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomUrl) {
      navigate('/chat');
      return;
    }

    // First fetch room data
    const fetchRoomData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/by-url/${roomUrl}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const roomData = await response.json();
          setRoom(roomData);
          // After getting room data, fetch channels
          fetchChannels(roomData.room_id);
        } else {
          navigate('/chat');
        }
      } catch (error) {
        console.error('Error fetching room:', error);
        setError('Failed to load room data');
      }
    };

    const fetchChannels = async (roomId) => {
      try {
        const response = await fetch(`${API_BASE_URL}/channels/${roomId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels);
          if (data.channels.length > 0 && !selectedChannel) {
            setSelectedChannel(data.channels[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching channels:', error);
        setError('Failed to load channels');
      }
    };

    fetchRoomData();
  }, [roomUrl, authToken, navigate, channelId, selectedChannel]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(`url(${url})`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!selectedChannel) {
      setError('Please select a channel');
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('content', message);
      formData.append('userId', userId);
      formData.append('isAnonymous', isAnonymous);
      formData.append('channelId', selectedChannel);
      if (image) {
        formData.append('image', image);
      }

      const response = await fetch(`${API_BASE_URL}/threads/${selectedChannel}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate using the URL structure
        navigate(`/v/${roomUrl}`);
      } else if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        navigate('/login');
      } else {
        setError(data.message || 'Failed to create thread');
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      setError('An error occurred while creating the thread');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/v/${roomUrl}`);
  };

  return (
    <div className={`min-vh-100 py-5 ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light'}`}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            <div className={`card ${theme === 'dark' ? 'bg-mid-dark text-light' : ''}`}>
              <div className="card-body">
                <h2 className="card-title text-center mb-4">Create New Thread</h2>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="channel" className="form-label">
                      Channel
                    </label>
                    <select
                      className="form-select"
                      id="channel"
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      required
                    >
                      <option value="">Select a channel</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="message" className="form-label">
                      Message
                    </label>
                    <textarea
                      className="form-control"
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows="3"
                      required
                      maxLength={2000}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="image" className="form-label">
                      Image
                    </label>
                    <input type="file" className="form-control" id="image" accept="image/*" onChange={handleImageChange} />
                    {previewUrl && (
                      <div
                        className="mt-2 image-preview"
                        style={{
                          backgroundImage: previewUrl,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                          width: '100%',
                          height: '200px',
                        }}
                      />
                    )}
                  </div>

                  <div className="mb-3 d-flex align-items-center justify-content-between">
                    <label htmlFor="isAnonymous" className="form-label mb-0">
                      Anonymous Mode
                    </label>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isAnonymous"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                      />
                    </div>
                  </div>

                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Thread'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateThread;

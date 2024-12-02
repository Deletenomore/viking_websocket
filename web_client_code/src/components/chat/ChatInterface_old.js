// components/chat/ChatInterface.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import RoomSidebar from './RoomSidebar';
import ChannelSidebar from './ChannelSidebar';
import ThreadList from './ThreadList';
import ContextMenu from './ContextMenu';
import useResponsive from '../../hooks/useResponsive';
import useFetch from '../../hooks/useFetch';

const ChatInterface = ({ theme }) => {
  const navigate = useNavigate();
  const { roomUrl, channelId, threadId } = useParams();
  const { isMobile } = useResponsive();

  // State management
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [showRoomSidebar, setShowRoomSidebar] = useState(true);
  const [showChannelSidebar, setShowChannelSidebar] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [threads, setThreads] = useState([]);

  // Authentication helpers
  const handleInvalidToken = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  // Fetch and update room data including channels
  const fetchAndUpdateRoom = useCallback(
    async (roomId, urlName = null) => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          handleInvalidToken();
          return;
        }

        // Fetch room details and channels in parallel
        const [roomResponse, channelsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/rooms/by-url/${urlName || roomUrl}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/channels/${roomId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!roomResponse.ok || !channelsResponse.ok) {
          if (roomResponse.status === 401 || channelsResponse.status === 401) {
            handleInvalidToken();
            return;
          }
          throw new Error('Failed to fetch room data');
        }

        const [roomData, channelsData] = await Promise.all([roomResponse.json(), channelsResponse.json()]);

        // Update room with channels data
        const updatedRoom = {
          ...roomData,
          categories: channelsData.categories,
          is_admin: channelsData.is_admin,
        };

        setSelectedRoom(updatedRoom);
        return updatedRoom;
      } catch (error) {
        console.error('Error fetching room data:', error);
      }
    },
    [handleInvalidToken, roomUrl]
  );

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        handleInvalidToken();
        return;
      }

      const response = await fetch(`${API_BASE_URL}/rooms`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleInvalidToken();
        return;
      }

      const data = await response.json();
      setRooms(data.rooms || []);

      // If we have a roomUrl param, find and select that room
      if (roomUrl) {
        const matchingRoom = data.rooms.find((room) => room.url_name === roomUrl);
        if (matchingRoom) {
          await fetchAndUpdateRoom(matchingRoom.room_id, matchingRoom.url_name);
        }
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }, [handleInvalidToken, roomUrl, fetchAndUpdateRoom]);

  // Initial setup
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      handleInvalidToken();
      return;
    }
    fetchRooms();
  }, [fetchRooms, handleInvalidToken]);

  // URL-based navigation effect
  useEffect(() => {
    if (roomUrl && selectedRoom?.room_id) {
      fetchAndUpdateRoom(selectedRoom.room_id);
    }
  }, [roomUrl, selectedRoom?.room_id, fetchAndUpdateRoom]);

  const fetchThreads = async (channelId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/threads/${channelId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleInvalidToken();
        return;
      }

      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  };

  // Room selection handler
  const handleRoomSelect = async (room) => {
    if (!room.url_name) {
      console.error('Room URL name is missing:', room);
      return;
    }

    navigate(`/v/${room.url_name}`);
    await fetchAndUpdateRoom(room.room_id, room.url_name);

    if (isMobile) {
      setShowRoomSidebar(false);
      setShowChannelSidebar(true);
    }
  };

  const handleChannelSelect = (channel) => {
    navigate(`/v/${selectedRoom.url_name}/${channel.url_id}`);
    setSelectedChannel(channel);
    fetchThreads(channel.id);
    if (isMobile) {
      setShowChannelSidebar(false);
    }
  };

  const handleThreadSelect = (thread) => {
    navigate(`/v/${selectedRoom.url_name}/${selectedChannel.url_id}/${thread.url_id}`);
    setSelectedThread(thread);
  };

  const handleCreateRoom = () => {
    navigate('/create-room');
  };

  const handleCreateThread = () => {
    if (selectedChannel) {
      navigate(`/v/${selectedRoom.url_name}/create-thread`);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getRoomDisplay = (room) => {
    if (room.thumbnail_url) {
      const fullUrl = `${API_BASE_URL}${room.thumbnail_url}`;
      return (
        <img
          src={fullUrl}
          alt={room.name}
          className="w-100 h-100 rounded-circle object-fit-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
            e.target.parentElement.textContent = room.name.charAt(0).toUpperCase();
          }}
        />
      );
    }
    return room.name.charAt(0).toUpperCase();
  };

  const handleContextMenu = useCallback((e, item, type = 'room') => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      item,
      type,
    });
  }, []);

  const handleLeaveRoom = async (roomId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: localStorage.getItem('userId') }),
      });

      if (response.ok) {
        if (selectedRoom?.room_id === roomId) {
          setSelectedRoom(null);
          setSelectedChannel(null);
          setSelectedThread(null);
          setThreads([]);
        }
        fetchRooms();
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      setContextMenu(null);
    }
  };

  const getBaseClasses = (isDark) =>
    `${isDark ? 'bg-dark text-light' : 'bg-light text-dark'} 
     ${isDark ? 'border-secondary' : 'border-light'}`.trim();

  const ROOM_BUTTON_SIZE = 38;
  const SIDEBAR_WIDTH = 280;

  return (
    <div className={`vh-100 ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
      {/* Mobile Toggle Buttons */}
      {isMobile && (
        <>
          <button onClick={() => setShowRoomSidebar(!showRoomSidebar)} className="btn position-fixed top-0 start-0 m-2 z-3">
            <i className="bi bi-list fs-5"></i>
          </button>
          {selectedRoom && (
            <button
              onClick={() => setShowChannelSidebar(!showChannelSidebar)}
              className="btn position-fixed top-0 start-0 m-2 z-3"
              style={{ left: '64px' }}
            >
              <i className="bi bi-chat-left-text fs-5"></i>
            </button>
          )}
        </>
      )}

      {/* Rooms Sidebar */}
      <div
        className={`position-fixed start-0 top-0 h-100 border-end ${showRoomSidebar ? '' : 'translate-x-[-100%]'} ${
          theme === 'dark' ? 'bg-dark text-light border-secondary' : 'bg-light text-dark border-light'
        } transition-transform duration-300`}
        style={{ width: '54px', zIndex: 2 }}
      >
        <RoomSidebar
          rooms={rooms}
          selectedRoom={selectedRoom}
          onRoomSelect={handleRoomSelect}
          onCreateRoom={handleCreateRoom}
          onRoomContextMenu={handleContextMenu}
          getRoomDisplay={getRoomDisplay}
          theme={theme}
        />
      </div>

      {/* Channels Sidebar */}
      {selectedRoom && (
        <div
          className={`position-fixed h-100 border-end ${showChannelSidebar ? '' : 'translate-x-[-100%]'} ${getBaseClasses(
            theme === 'dark'
          )} transition-transform duration-300`}
          style={{
            width: `${SIDEBAR_WIDTH}px`,
            left: showRoomSidebar ? `${ROOM_BUTTON_SIZE + 16}px` : '0',
            zIndex: 1,
          }}
        >
          <ChannelSidebar
            selectedRoom={selectedRoom}
            selectedChannel={selectedChannel}
            onChannelSelect={handleChannelSelect}
            theme={theme}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="h-100 overflow-hidden"
        style={{
          marginLeft: showRoomSidebar
            ? selectedRoom
              ? `${ROOM_BUTTON_SIZE + 16 + SIDEBAR_WIDTH}px`
              : `${ROOM_BUTTON_SIZE + 16}px`
            : showChannelSidebar && selectedRoom
            ? `${SIDEBAR_WIDTH}px`
            : '0',
          transition: 'margin-left 0.3s ease-in-out',
        }}
      >
        {selectedChannel ? (
          <ThreadList
            selectedChannel={selectedChannel}
            threads={threads}
            onThreadSelect={handleThreadSelect}
            onCreateThread={handleCreateThread}
            theme={theme}
          />
        ) : (
          <div className="h-100 d-flex align-items-center justify-content-center">
            <p>{selectedRoom ? 'Select a channel to view threads' : 'Select a room to view channels'}</p>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <button className={`btn btn-sm btn-outline-danger position-fixed top-0 end-0 m-2 z-3`} onClick={handleLogout}>
        <i className="bi bi-box-arrow-right"></i> Logout
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y}>
          {contextMenu.type === 'room' && (
            <button className="btn btn-link text-danger w-100 text-start px-3" onClick={() => handleLeaveRoom(contextMenu.item.room_id)}>
              Leave Room
            </button>
          )}
        </ContextMenu>
      )}
    </div>
  );
};

export default ChatInterface;

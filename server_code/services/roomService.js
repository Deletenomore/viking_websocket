const path = require('path');
const fs = require('fs');

// Mock data for rooms
const mockRooms = [
  { id: 1, name: 'Room 1', url_name: 'room-1', thumbnail_url: '/uploads/room1.png' },
  { id: 2, name: 'Room 2', url_name: 'room-2', thumbnail_url: '/uploads/room2.png' },
];

// Function to destroy a room (mock logic)
exports.destroyRoom = async (roomId) => {
  try {
    // Find the room in the mock data
    const roomIndex = mockRooms.findIndex((room) => room.id === roomId);
    if (roomIndex === -1) {
      throw new Error('Room not found');
    }

    const roomData = mockRooms[roomIndex];

    // Remove room from mock data
    mockRooms.splice(roomIndex, 1);

    // Delete the thumbnail file (if exists)
    if (roomData?.thumbnail_url) {
      const thumbnailPath = path.join(__dirname, '..', 'public', roomData.thumbnail_url);
      fs.unlink(thumbnailPath, (err) => {
        if (err) {
          console.error('Error deleting thumbnail:', err);
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error destroying room:', error);
    throw error;
  }
};

// Export other mock room operations if needed
exports.getAllRooms = () => {
  return mockRooms;
};

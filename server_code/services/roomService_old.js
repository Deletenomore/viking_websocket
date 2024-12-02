// part of backend
// services/roomService.js
const path = require('path');
const fs = require('fs');

exports.destroyRoom = async (transaction, roomId) => {
  try {
    const roomData = await transaction.query('SELECT thumbnail_url FROM rooms WHERE id = $1', [roomId]);

    await transaction.query('DELETE FROM room_members WHERE room_id = $1', [roomId]);
    await transaction.query('DELETE FROM rooms WHERE id = $1', [roomId]);

    if (roomData.rows[0]?.thumbnail_url) {
      const thumbnailPath = path.join(__dirname, '..', 'public', roomData.rows[0].thumbnail_url);
      fs.unlink(thumbnailPath, (err) => {
        if (err) console.error('Error deleting thumbnail:', err);
      });
    }

    return true;
  } catch (error) {
    console.error('Error destroying room:', error);
    throw error;
  }
};

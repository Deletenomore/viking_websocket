// controllers/channelController.js
const db = require('../db');

exports.createChannel = async (req, res) => {
  const { roomId } = req.params;
  const { name, description, isNsfw } = req.body;
  const userId = req.user.userId;

  try {
    await db.transaction(async (client) => {
      // Check if user is room admin
      const adminCheck = await client.query('SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2 AND is_admin = true', [
        roomId,
        userId,
      ]);

      if (adminCheck.rows.length === 0) {
        throw new Error('Only room admins can create channels');
      }

      // Create the channel
      const result = await client.query(
        'INSERT INTO channels (room_id, name, description, is_nsfw) VALUES ($1, $2, $3, $4) RETURNING id, url_id',
        [roomId, name, description, isNsfw]
      );

      res.status(201).json({
        message: 'Channel created successfully',
        channelId: result.rows[0].id,
        urlId: result.rows[0].url_id,
      });
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(error.message === 'Only room admins can create channels' ? 403 : 500).json({ message: error.message });
  }
};

exports.getChannels = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user is room member and get their role
    const memberCheck = await db.query(
      `SELECT rm.is_admin 
       FROM room_members rm 
       WHERE rm.room_id = $1 AND rm.user_id = $2`,
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'User is not a member of this room' });
    }

    // First get all categories for the room
    const categoriesQuery = await db.query(
      `SELECT cc.id, cc.name, cc.position
       FROM channel_categories cc
       WHERE cc.room_id = $1
       ORDER BY cc.position`,
      [roomId]
    );

    // Then get all channels with their category information
    const channelsQuery = await db.query(
      `SELECT 
        c.*,
        COUNT(t.id) as thread_count,
        MAX(t.last_activity) as latest_activity
       FROM channels c
       LEFT JOIN threads t ON c.id = t.channel_id
       WHERE c.room_id = $1
       GROUP BY c.id
       ORDER BY c.position`,
      [roomId]
    );

    // Organize channels by category
    const categories = categoriesQuery.rows.map((category) => ({
      ...category,
      channels: channelsQuery.rows.filter((channel) => channel.category_id === category.id),
    }));

    res.json({
      categories,
      is_admin: memberCheck.rows[0].is_admin,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ message: 'Error fetching channels' });
  }
};

exports.updateChannel = async (req, res) => {
  const { channelId } = req.params;
  const { name, description, isNsfw, position } = req.body;
  const userId = req.user.userId;

  try {
    await db.transaction(async (client) => {
      // Check if user is room admin
      const adminCheck = await client.query(
        `SELECT 1 FROM room_members rm
         JOIN channels c ON c.room_id = rm.room_id
         WHERE c.id = $1 AND rm.user_id = $2 AND rm.is_admin = true`,
        [channelId, userId]
      );

      if (adminCheck.rows.length === 0) {
        throw new Error('Only room admins can update channels');
      }

      await client.query(
        `UPDATE channels 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             is_nsfw = COALESCE($3, is_nsfw),
             position = COALESCE($4, position)
         WHERE id = $5`,
        [name, description, isNsfw, position, channelId]
      );

      res.json({ message: 'Channel updated successfully' });
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(error.message === 'Only room admins can update channels' ? 403 : 500).json({ message: error.message });
  }
};

exports.deleteChannel = async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user.userId;

  try {
    await db.transaction(async (client) => {
      // Check if user is room admin
      const adminCheck = await client.query(
        `SELECT 1 FROM room_members rm
         JOIN channels c ON c.room_id = rm.room_id
         WHERE c.id = $1 AND rm.user_id = $2 AND rm.is_admin = true`,
        [channelId, userId]
      );

      if (adminCheck.rows.length === 0) {
        throw new Error('Only room admins can delete channels');
      }

      await client.query('DELETE FROM channels WHERE id = $1', [channelId]);
      res.json({ message: 'Channel deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(error.message === 'Only room admins can delete channels' ? 403 : 500).json({ message: error.message });
  }
};

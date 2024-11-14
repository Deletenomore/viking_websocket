// part of backend
// controllers/threadController.js
const db = require('../db');

exports.createThread = async (req, res) => {
  //console.log('Create thread got hit');

  const { roomId } = req.params;
  const { subject, content, isAnonymous } = req.body;
  const userId = req.user.userId;

  // Convert isAnonymous string to boolean
  const isAnonymousBoolean = isAnonymous === 'true';

  try {
    const result = await db.transaction(async (client) => {
      // Check if user is a member of the room
      const memberCheck = await client.query('SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, userId]);

      if (memberCheck.rows.length === 0) {
        throw new Error('User is not a member of this room');
      }

      // Create thread
      const threadResult = await client.query(
        'INSERT INTO threads (room_id, subject, author_id, is_anonymous) VALUES ($1, $2, $3, $4) RETURNING id',
        [roomId, subject, userId, isAnonymousBoolean]
      );

      const threadId = threadResult.rows[0].id;

      // Create the first post
      const postResult = await client.query(
        'INSERT INTO posts (thread_id, author_id, content) VALUES ($1, $2, $3) RETURNING id',
        [threadId, userId, content]
      );

      // If there's a file, add it to file_attachments
      if (req.file) {
        console.log('Adding file attachment:', req.file);
        await client.query(
          `INSERT INTO file_attachments 
           (post_id, file_name, file_type, file_size, file_url) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            postResult.rows[0].id,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            `/uploads/${req.file.filename}`
          ]
        );
      }

      return threadId;
    });

    res.status(201).json({ 
      message: 'Thread created successfully', 
      threadId: result
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(error.message === 'User is not a member of this room' ? 403 : 500).json({ message: error.message });
  }
};

exports.getThreads = async (req, res) => {
  const { roomId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user.userId;

  try {
    // First check if user is a member of the room
    const memberCheck = await db.query('SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, userId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'User is not a member of this room' });
    }

    // Query to get threads with their first posts and images
    const threads = await db.query(
      `
      WITH RankedPosts AS (
        SELECT 
          p.*,
          ROW_NUMBER() OVER (PARTITION BY p.thread_id ORDER BY p.created_at) as rn
        FROM posts p
        WHERE p.thread_id IN (
          SELECT id FROM threads WHERE room_id = $1
        )
      )
      SELECT 
        t.id,
        t.subject,
        t.created_at,
        t.is_pinned,
        t.last_activity,
        CASE 
          WHEN t.is_anonymous THEN NULL 
          ELSE u.email 
        END as author_email,
        COUNT(DISTINCT p.id) as post_count,
        rp.content as first_post_content,
        fa.file_url as first_post_image
      FROM threads t
      LEFT JOIN users u ON t.author_id = u.id
      LEFT JOIN posts p ON t.id = p.thread_id
      LEFT JOIN RankedPosts rp ON t.id = rp.thread_id AND rp.rn = 1
      LEFT JOIN file_attachments fa ON rp.id = fa.post_id 
        AND fa.file_type LIKE 'image/%'
      WHERE t.room_id = $1
      GROUP BY 
        t.id, 
        t.subject, 
        t.created_at, 
        t.is_pinned,
        t.last_activity, 
        t.is_anonymous, 
        u.email,
        rp.content,
        fa.file_url
      ORDER BY t.is_pinned DESC, t.last_activity DESC
      LIMIT $2 OFFSET $3
    `,
      [roomId, limit, offset]
    );

    // Debug log
    console.log('Thread data:', JSON.stringify(threads.rows, null, 2));

    res.json({ threads: threads.rows });
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ message: 'Error fetching threads' });
  }
};

exports.getPosts = async (req, res) => {
  const { threadId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user.userId;

  try {
    // Check if user is a member of the room that contains this thread
    const memberCheck = await db.query(
      `
      SELECT 1 FROM room_members rm
      JOIN threads t ON t.room_id = rm.room_id
      WHERE t.id = $1 AND rm.user_id = $2
      `,
      [threadId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ message: 'User is not a member of this room' });
    }

    const posts = await db.query(
      `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        p.updated_at,
        CASE 
          WHEN t.is_anonymous THEN NULL 
          ELSE u.email 
        END as author_email
      FROM posts p
      JOIN threads t ON p.thread_id = t.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.thread_id = $1
      ORDER BY p.created_at ASC
      LIMIT $2 OFFSET $3
    `,
      [threadId, limit, offset]
    );

    res.json({ posts: posts.rows });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
};

exports.createPost = async (req, res) => {
  const { threadId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    await db.transaction(async (client) => {
      // Check if user is a member of the room containing this thread
      const memberCheck = await client.query(
        `
        SELECT 1 FROM room_members rm
        JOIN threads t ON t.room_id = rm.room_id
        WHERE t.id = $1 AND rm.user_id = $2
      `,
        [threadId, userId]
      );

      if (memberCheck.rows.length === 0) {
        throw new Error('User is not a member of this room');
      }

      // Create the post first
      const postResult = await client.query(
        'INSERT INTO posts (thread_id, author_id, content) VALUES ($1, $2, $3) RETURNING id',
        [threadId, userId, content]
      );

      // If there's a file, add it to file_attachments
      if (req.file) {
        await client.query(
          `INSERT INTO file_attachments 
           (post_id, file_name, file_type, file_size, file_url) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            postResult.rows[0].id,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            `/uploads/${req.file.filename}`
          ]
        );
      }

      // Update thread's last_activity
      await client.query('UPDATE threads SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [threadId]);
    });

    res.status(201).json({ message: 'Post created successfully' });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(error.message === 'User is not a member of this room' ? 403 : 500).json({ message: error.message });
  }
};

exports.deleteThread = async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user.userId; // Get from JWT token

  try {
    await db.transaction(async (client) => {
      // Check if user is the thread author or room admin
      const authorCheck = await client.query(
        `
          SELECT 1 FROM threads t
          JOIN room_members rm ON t.room_id = rm.room_id
          WHERE t.id = $1 
          AND (t.is_anonymous = false AND t.author_id = $2 OR (rm.user_id = $2 AND rm.is_admin = true))
        `,
        [threadId, userId]
      );

      if (authorCheck.rows.length === 0) {
        throw new Error('Not authorized to delete thread');
      }

      await client.query('DELETE FROM threads WHERE id = $1', [threadId]);
    });

    res.status(200).json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(error.message === 'Not authorized to delete thread' ? 403 : 500).json({ message: error.message });
  }
};

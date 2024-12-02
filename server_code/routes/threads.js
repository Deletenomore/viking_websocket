// part of backend
// routes/threads.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');

const { createThread, getThreads, getPosts, createPost, deleteThread } = require('../controllers/threadController');

// Protect all routes with authentication
router.use(authenticateToken);

// Update the createThread route to use upload middleware
router.post('/:roomId', upload.single('image'), createThread);
router.get('/:roomId', getThreads);
router.get('/:threadId/posts', getPosts);
router.post('/:threadId/posts', createPost);
router.delete('/:threadId', deleteThread);

module.exports = router;

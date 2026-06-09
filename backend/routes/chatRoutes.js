const express = require('express');
const { protegerRuta } = require('../middleware/authMiddleware');
const { chat } = require('../controllers/chatController');

const router = express.Router();

router.post('/', protegerRuta, chat);

module.exports = router;
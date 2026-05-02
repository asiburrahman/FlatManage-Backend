const express = require('express');
const { verifyAccessToken } = require('../middlewares/auth');

const announcementRoutes = (announcementCollection) => {
  const router = express.Router();

  // Announcements Api
  router.get('/', verifyAccessToken, async (req, res) => {
    try {
      const result = await announcementCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: 'Failed to fetch announcements', error });
    }
  });

  return router;
};

module.exports = announcementRoutes;

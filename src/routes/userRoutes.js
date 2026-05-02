const express = require('express');
const { verifyAccessToken, verifyTokenEmail } = require('../middlewares/auth');

const userRoutes = (usersCollection) => {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const userData = req.body;
      userData.role = 'user';
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();

      const query = { email: userData?.email };
      const alreadyExists = await usersCollection.findOne(query);

      if (alreadyExists) {
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedIn: new Date().toISOString() },
        });
        return res.send(result);
      }

      const result = await usersCollection.insertOne(userData);
      res.send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Failed to create user' });
    }
  });

  router.get('/role/:email', verifyAccessToken, verifyTokenEmail, async (req, res) => {
    try {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      if (!result) return res.status(404).send({ message: 'User Not Found.' });
      res.send({ role: result?.role });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Failed to fetch user role' });
    }
  });

  return router;
};

module.exports = userRoutes;

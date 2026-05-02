const express = require('express');
const { verifyAccessToken, verifyTokenEmail } = require('../middlewares/auth');

const agreementRoutes = (agreementsCollection) => {
  const router = express.Router();

  router.get('/user/:email', verifyAccessToken, verifyTokenEmail, async (req, res) => {
    try {
      const email = req.params.email;
      const result = await agreementsCollection.findOne({ userEmail: email });
      res.send(result || {});
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Failed to fetch agreement for user' });
    }
  });

  return router;
};

module.exports = agreementRoutes;

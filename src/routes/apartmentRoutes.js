const express = require('express');

const apartmentRoutes = (flatCollection, agreementsCollection) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const apartments = await flatCollection.find().toArray();
      res.send(apartments);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to fetch apartments' });
    }
  });

  router.post('/', async (req, res) => {
    const { userEmail, apartmentNo, floor, block } = req.body;

    // 1. Check if the user already has an agreement
    const existing = await agreementsCollection.findOne({ userEmail });
    if (existing) {
      return res.status(400).json({ message: 'You already have an agreement.' });
    }

    // 2. Check if the apartment is already booked
    const apartment = await flatCollection.findOne({
      apartmentNo,
      floor,
      block,
      'booking.status': 'checked'
    });

    if (apartment) {
      return res.status(400).json({ message: 'This apartment is already booked.' });
    }

    // 3. Save agreement
    const result = await agreementsCollection.insertOne({
      ...req.body,
      status: 'pending',
    });

    // 4. Optionally update apartment to mark status as 'pending'
    await flatCollection.updateOne(
      { apartmentNo, floor, block },
      {
        $set: {
          'booking.status': 'pending',
          'booking.bookedBy': userEmail,
          'booking.bookedAt': new Date()
        }
      }
    );

    res.status(201).json(result);
  });

  return router;
};

module.exports = apartmentRoutes;

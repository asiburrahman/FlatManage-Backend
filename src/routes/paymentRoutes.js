const express = require('express');
const { verifyAccessToken, verifyMember, verifyTokenEmail } = require('../middlewares/auth');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const paymentRoutes = (agreementsCollection, paymentCollection) => {
  const router = express.Router();

  // payment on stripe
  router.post('/create-payment-secret', verifyAccessToken, async (req, res) => {
    const { paymentInfo } = req.body;

    const { email, rent, apartmentNo, floor, block, discount = 0 } = paymentInfo;

    if (!email || !apartmentNo || !floor || !block || !rent) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    try {
      // Step 1: Get agreement from DB
      const agreement = await agreementsCollection.findOne({
        userEmail: email,
        status: 'checked'
      });

      if (!agreement) {
        return res.status(404).json({ message: 'No valid agreement found' });
      }

      // Step 2: Calculate expected discounted rent
      const expectedRent = Math.round(
        agreement.rent - (agreement.rent * (discount || 0)) / 100
      );

      // Step 3: Match rent + apartment info
      const isValid =
        agreement.apartmentNo === apartmentNo &&
        agreement.floor === floor &&
        agreement.block === block &&
        expectedRent === rent;
      const expectedRentUSD = Math.floor(expectedRent / 140)
      if (!isValid) {
        return res.status(400).json({ message: 'Payment info mismatch or incorrect discount' });
      }

      // Step 4: Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: expectedRentUSD * 100,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          email,
          apartment: apartmentNo,
          floor,
          block,
          discount: discount.toString(),
          originalRent: agreement.rent.toString()
        },
      });

      res.send({ clientSecret: paymentIntent.client_secret });

    } catch (err) {
      console.error('Payment intent creation failed:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  router.post('/member/payment/success', verifyAccessToken, verifyMember, async (req, res) => {
    const payment = req.body;

    if (
      !payment ||
      !payment.email ||
      !payment.transactionId ||
      !payment.floor ||
      !payment.block ||
      !payment.apartmentNo ||
      !payment.month ||
      !payment.rent
    ) {
      return res.status(400).json({ message: 'Missing required payment fields' });
    }

    try {
      payment.paidAt = new Date();

      const result = await paymentCollection.insertOne(payment);

      if (result.insertedId) {
        return res.status(200).json({ message: 'Payment stored successfully', insertedId: result.insertedId });
      } else {
        return res.status(500).json({ message: 'Failed to store payment' });
      }
    } catch (error) {
      console.error('Payment saving failed:', error);
      return res.status(500).json({ message: 'Server error', error });
    }
  });

  // Get Payment history
  router.get('/payments/user/:email', verifyAccessToken, verifyTokenEmail, verifyMember, async (req, res) => {
    const email = req.params.email;
    const result = await paymentCollection.find({ email }).sort({ paidAt: -1 }).toArray();
    res.send(result);
  });

  return router;
};

module.exports = paymentRoutes;

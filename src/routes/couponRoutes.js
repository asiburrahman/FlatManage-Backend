const express = require('express');
const { ObjectId } = require('mongodb');
const { verifyAccessToken, verifyAdmin } = require('../middlewares/auth');

const couponRoutes = (couponCollection) => {
  const router = express.Router();

  // /admin/coupons
  router.get('/admin/coupons', async (req, res) => {
    const now = new Date();
    const coupons = await couponCollection.find().toArray();

    for (const coupon of coupons) {
      if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        await couponCollection.updateOne(
          { _id: coupon._id },
          { $set: { isValid: false } }
        );
      }
    }

    const updatedCoupons = await couponCollection.find().toArray();
    res.send(updatedCoupons);
  });

  router.post('/admin/coupons', verifyAccessToken, verifyAdmin, async (req, res) => {
    const { code, discount, description, expiresAt } = req.body;

    const newCoupon = {
      code,
      discount,
      description,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      isValid: true
    };

    const result = await couponCollection.insertOne(newCoupon);
    res.send(result);
  });

  router.delete('/admin/coupons/:id', verifyAccessToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    try {
      const result = await couponCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: 'Failed to delete coupon', error });
    }
  });

  router.patch('/admin/coupons/:id', verifyAccessToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const { code, discount, description, expiresAt } = req.body;

    try {
      const result = await couponCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            code,
            discount,
            description,
            expiresAt: new Date(expiresAt)
          }
        }
      );
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: 'Failed to update coupon', error });
    }
  });

  // /coupons/:code
  router.get('/coupons/:code', verifyAccessToken, async (req, res) => {
    const code = req.params.code;
    const now = new Date();

    try {
      const coupon = await couponCollection.findOne({ code });

      if (!coupon || !coupon.isValid || new Date(coupon.expiresAt) < now) {
        return res.send({
          isValid: false,
          discountPercentage: 0,
          message: 'Coupon expired or invalid'
        });
      }

      res.send({
        isValid: true,
        discountPercentage: coupon.discount,
        message: 'Coupon valid'
      });

    } catch (error) {
      res.status(500).send({
        isValid: false,
        discountPercentage: 0,
        message: 'Server error'
      });
    }
  });

  return router;
};

module.exports = couponRoutes;

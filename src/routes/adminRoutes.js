const express = require('express');
const { ObjectId } = require('mongodb');
const { verifyAccessToken, verifyAdmin } = require('../middlewares/auth');

const adminRoutes = (flatCollection, agreementsCollection, usersCollection, announcementCollection, couponCollection) => {
  const router = express.Router();

  // Create announcements by admin
  router.post('/announcement', verifyAccessToken, verifyAdmin, async (req, res) => {
    try {
      const announcement = req.body;
      announcement.createdAt = new Date(); // Add timestamp
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    } catch (error) {
      res.status(500).send({ message: 'Failed to create announcement', error });
    }
  });

  // Admin summary
  router.get('/summary', verifyAccessToken, verifyAdmin, async (req, res) => {
    try {
      const totalRooms = await flatCollection.estimatedDocumentCount();
      const agreedRooms = await agreementsCollection.countDocuments({ status: 'checked' });
      const availableRooms = totalRooms - agreedRooms;

      const userRoles = await usersCollection.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      const roleCounts = { user: 0, member: 0, admin: 0 };
      userRoles.forEach(r => { roleCounts[r._id] = r.count; });

      const availabilityPercent = totalRooms === 0 ? "0.00" : ((availableRooms / totalRooms) * 100).toFixed(2);
      const agreementPercent = totalRooms === 0 ? "0.00" : ((agreedRooms / totalRooms) * 100).toFixed(2);

      res.send({
        totalRooms,
        availableRooms,
        agreedRooms,
        availabilityPercent,
        agreementPercent,
        users: roleCounts.user || 0,
        members: roleCounts.member || 0,
        admin: roleCounts.admin || 0,
      });

    } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Failed to fetch admin profile summary' });
    }
  });

  // Manage Members
  router.get('/members', verifyAccessToken, verifyAdmin, async (req, res) => {
    try {
      const members = await usersCollection.find({ role: 'member' }).toArray();
      const results = await Promise.all(
        members.map(async (member) => {
          const agreement = await agreementsCollection.findOne({
            userEmail: member.email,
            status: 'checked',
          });

          const bookingName = agreement
            ? `Floor ${agreement.floor}, Block ${agreement.block}, Room ${agreement.apartmentNo}`
            : 'None';

          return {
            name: member.name,
            email: member.email,
            bookingName,
          };
        })
      );

      res.send(results);
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Failed to fetch members' });
    }
  });

  // Remove member
  router.patch('/remove-member/:email', verifyAccessToken, verifyAdmin, async (req, res) => {
    const email = req.params.email;

    try {
      await usersCollection.updateOne({ email }, { $set: { role: 'user' } });

      const agreement = await agreementsCollection.findOne({
        userEmail: email,
        status: 'checked'
      });

      if (agreement) {
        await flatCollection.updateOne(
          {
            apartmentNo: agreement.apartmentNo,
            block: agreement.block,
            floor: agreement.floor
          },
          {
            $set: {
              'booking.status': null,
              'booking.bookedBy': null,
              'booking.bookedAt': null
            }
          }
        );

        await agreementsCollection.deleteOne({ _id: agreement._id });
      }

      res.send({ success: true, message: 'Member removed and apartment booking cleared.' });

    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).send({ success: false, error: 'Internal Server Error' });
    }
  });

  // Fetch agreements
  router.get('/agreements', verifyAccessToken, verifyAdmin, async (req, res) => {
    try {
      const pendingAgreements = await agreementsCollection.find({ status: 'pending' }).toArray();
      res.send(pendingAgreements);
    } catch (error) {
      res.status(500).send({ message: 'Failed to fetch agreements', error });
    }
  });

  // Accept agreement
  router.patch('/agreements/:id/accept', verifyAccessToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    try {
      const agreement = await agreementsCollection.findOne({ _id: new ObjectId(id) });
      if (!agreement) return res.status(404).send({ message: 'Agreement not found' });

      await agreementsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'checked' } }
      );

      await usersCollection.updateOne(
        { email: agreement.userEmail },
        { $set: { role: 'member' } }
      );

      const updateApartment = await flatCollection.updateOne(
        {
          floor: agreement.floor,
          block: agreement.block,
          apartmentNo: agreement.apartmentNo
        },
        {
          $set: {
            'booking.status': 'checked',
            'booking.bookedBy': agreement.userEmail,
            'booking.bookedAt': new Date()
          }
        }
      );

      res.send({
        message: 'Agreement accepted, user promoted to member, apartment marked as booked',
        apartmentUpdated: updateApartment.modifiedCount > 0
      });
    } catch (error) {
      res.status(500).send({ message: 'Failed to accept agreement', error });
    }
  });

  // Reject agreement
  router.patch('/agreements/:id/reject', verifyAccessToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;

    try {
      const agreement = await agreementsCollection.findOne({ _id: new ObjectId(id) });
      if (!agreement) return res.status(404).send({ message: 'Agreement not found' });

      await agreementsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'checked' } }
      );

      const flatUpdateResult = await flatCollection.updateOne(
        {
          apartmentNo: agreement.apartmentNo,
          floor: agreement.floor,
          block: agreement.block
        },
        {
          $set: {
            'booking.status': null,
            'booking.bookedBy': null,
            'booking.bookedAt': null
          }
        }
      );

      res.send({
        message: 'Agreement rejected and apartment booking reset',
        updated: flatUpdateResult.modifiedCount > 0
      });

    } catch (error) {
      res.status(500).send({
        message: 'Failed to reject agreement and reset flat booking',
        error: error.message
      });
    }
  });

  return router;
};

module.exports = adminRoutes;

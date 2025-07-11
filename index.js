require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);
const stripe = require('stripe')(process.env.STRIPE_API_KEY)

// var serviceAccount = require("./firbaseToken.json");

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json())

// username = coffee-shop
// password= GN68LMBxFsuYP5p



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ajsrfci.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


//Jwt Verify Token
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  // console.log(authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: "Unauthorize Access" })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    // console.log('decoded Token', decoded);
    req.decoded = decoded

    next()
  } catch (error) {
    return res.status(401).send({ message: "Unauthorize Access" })
  }




}

const verifyTokenEmail = (req, res, next) => {



  if (req.params.email !== req.decoded.email) {
    return res.status(403).send({ message: "Forbidden Access" })
  }
  next();
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    const foodCollection = client.db('foodShare').collection('food')
    const flatCollection = client.db('ManageFlat').collection('apartment')
    const agreementsCollection = client.db('ManageFlat').collection('agreements')
    const usersCollection = client.db('ManageFlat').collection('users')
    const announcementCollection = client.db('ManageFlat').collection('announcement')
    const couponCollection = client.db('ManageFlat').collection('coupon')

    // Flatcollection Start 

    app.get('/apartments', async (req, res) => {
      try {
        const apartments = await flatCollection.find().toArray();
        res.send(apartments);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to fetch apartments' });
      }
    });

    app.post('/apartments', async (req, res) => {
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


    app.post('/user', async (req, res) => {
      const userData = req.body
      userData.role = 'user'
      userData.created_at = new Date().toISOString()
      userData.last_loggedIn = new Date().toISOString()
      const query = {
        email: userData?.email,
      }
      const alreadyExists = await usersCollection.findOne(query)
      console.log('User already exists: ', !!alreadyExists)
      if (!!alreadyExists) {
        console.log('Updating user data......')
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedIn: new Date().toISOString() },
        })
        return res.send(result)
      }

      console.log('Creating user data......')
      // return console.log(userData)
      const result = await usersCollection.insertOne(userData)
      res.send(result)
    })

    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email
      // console.log(email);

      const result = await usersCollection.findOne({ email })
      if (!result) return res.status(404).send({ message: 'User Not Found.' })
      res.send({ role: result?.role })
    })
    // User profile 
    app.get('/agreements/user/:email', async (req, res) => {
      const email = req.params.email;
      const result = await agreementsCollection.findOne({ userEmail: email });

      res.send(result || {});
    });

    // Announcements Api 
    app.get('/announcement', async (req, res) => {
      try {
        const result = await announcementCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch announcements', error });
      }
    });




    // Admin profile Data 
    // Create announcements by admin 
    app.post('/admin/announcement', async (req, res) => {
      try {
        const announcement = req.body;
        announcement.createdAt = new Date(); // Add timestamp
        const result = await announcementCollection.insertOne(announcement);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to create announcement', error });
      }
    });

    // routes/adminRoutes.js
    app.get('/admin/summary', async (req, res) => {
      try {
        // 1. Get total rooms
        const totalRooms = await flatCollection.estimatedDocumentCount();
        console.log(totalRooms);

        // 2. Get agreements where status is 'checked'
        const agreedRooms = await agreementsCollection.countDocuments({ status: 'checked' });

        // 3. Available rooms = total - booked
        const availableRooms = totalRooms - agreedRooms;

        // 4. Get user role counts
        const userRoles = await usersCollection.aggregate([
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 }
            }
          }
        ]).toArray();

        // console.log(userRoles);


        const roleCounts = {
          user: 0,
          member: 0,
          admin: 0
        };

        userRoles.forEach(r => {
          roleCounts[r._id] = r.count;
        });

        const availabilityPercent = ((availableRooms / totalRooms) * 100).toFixed(2);
        const agreementPercent = ((agreedRooms / totalRooms) * 100).toFixed(2);

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

    // Manage Member 
    app.get('/admin/members', async (req, res) => {
      try {
        // Step 1: Get all members
        const members = await usersCollection.find({ role: 'member' }).toArray();
        console.log(members);

        // Step 2: For each member, get their agreement if it’s accepted (checked)
        const results = await Promise.all(
          members.map(async (member) => {
            const agreement = await agreementsCollection.findOne({
              userEmail: member.email,
              status: 'checked',
            });

            // Format booking info or use 'None'
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
    // remove member from userCollection 
    app.patch('/admin/remove-member/:email', async (req, res) => {
      const email = req.params.email;

      try {
        // 1. Change role to 'user'
        const roleUpdate = await usersCollection.updateOne(
          { email },
          { $set: { role: 'user' } }
        );

        // 2. Find user's active (checked) agreement
        const agreement = await agreementsCollection.findOne({
          userEmail: email,
          status: 'checked'
        });

        if (agreement) {
          // 3. Reset apartment booking info
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

          // 4. (Optional) Delete or cancel the agreement
          await agreementsCollection.deleteOne({ _id: agreement._id }); // or use update to set status: 'cancelled'
        }

        res.send({ success: true, message: 'Member removed and apartment booking cleared.' });

      } catch (error) {
        console.error(' Error removing member:', error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    });


    // Fetch agreement Collection 
    app.get('/admin/agreements', async (req, res) => {
      try {
        const pendingAgreements = await agreementsCollection.find({ status: 'pending' }).toArray();
        res.send(pendingAgreements);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch agreements', error });
      }
    });

    // Agreement accept 
    app.patch('/admin/agreements/:id/accept', async (req, res) => {
      const id = req.params.id;
      try {
        const agreement = await agreementsCollection.findOne({ _id: new ObjectId(id) });
        if (!agreement) return res.status(404).send({ message: 'Agreement not found' });

        // 1. Update agreement status to 'checked'
        await agreementsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'checked' } }
        );

        // 2. Update user role to 'member'
        await usersCollection.updateOne(
          { email: agreement.userEmail },
          { $set: { role: 'member' } }
        );

        // ✅ 3. Mark apartment as booked
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

    // Agreement Reject 

    app.patch('/admin/agreements/:id/reject', async (req, res) => {
      const id = req.params.id;

      try {
        const agreement = await agreementsCollection.findOne({ _id: new ObjectId(id) });
        if (!agreement) return res.status(404).send({ message: 'Agreement not found' });

        // Step 1: Update agreement status to 'checked'
        await agreementsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'checked' } }
        );

        // Step 2: Update apartment's booking info to null
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
    // Coupons section 
    app.get('/admin/coupons', async (req, res) => {
      const now = new Date();
      const coupons = await couponCollection.find().toArray();

      // Update expired coupons automatically
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


    app.post('/admin/coupons', async (req, res) => {
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

    // Delete Coupon 
    app.delete('/admin/coupons/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const result = await couponCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete coupon', error });
      }
    });

    // Update Coupon 
    app.patch('/admin/coupons/:id', async (req, res) => {
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

    // Member Payment and Coupon Api 

    app.get('/coupons/:code', async (req, res) => {
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

    // payment on stripe 
    app.post('/create-payment-secret', async (req, res) => {
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

        if (!isValid) {
          return res.status(400).json({ message: 'Payment info mismatch or incorrect discount' });
        }

        // Step 4: Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: expectedRent / 140,
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



    // FlatCollection End 



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('ManageFlat backend')
})

app.listen(port, () => {
  console.log("ManageFlat server is running on port", port);

})
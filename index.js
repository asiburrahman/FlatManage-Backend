require('dotenv').config()
const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const admin = require("firebase-admin");

// Import Middlewares
const { initAuth } = require('./src/middlewares/auth');

// Import Routes
const apartmentRoutes = require('./src/routes/apartmentRoutes');
const agreementRoutes = require('./src/routes/agreementRoutes');
const userRoutes = require('./src/routes/userRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const couponRoutes = require('./src/routes/couponRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const announcementRoutes = require('./src/routes/announcementRoutes');

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Firebase Admin Init
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-pb7aknw-shard-00-01.ajsrfci.mongodb.net:27017/ManageFlat?ssl=true&authSource=admin&directConnection=true`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const db = client.db('ManageFlat');
    const flatCollection = db.collection('apartment');
    const agreementsCollection = db.collection('agreements');
    const usersCollection = db.collection('users');
    const announcementCollection = db.collection('announcement');
    const couponCollection = db.collection('coupon');
    const paymentCollection = db.collection('payment');

    // Initialize Auth Middlewares with usersCollection
    initAuth(usersCollection);

    // Register Routes
    app.use('/apartments', apartmentRoutes(flatCollection, agreementsCollection));
    app.use('/agreements', agreementRoutes(agreementsCollection));
    app.use('/user', userRoutes(usersCollection));
    app.use('/admin', adminRoutes(flatCollection, agreementsCollection, usersCollection, announcementCollection, couponCollection));
    app.use('/', couponRoutes(couponCollection)); // Mounted on root because internal paths define /admin/coupons and /coupons/:code
    app.use('/', paymentRoutes(agreementsCollection, paymentCollection)); // Mounted on root because internal paths define /create-payment-secret, etc.
    app.use('/announcement', announcementRoutes(announcementCollection));

    console.log("Database connected and routes initialized");
  } catch (err) {
    console.error("Failed to connect to Database", err);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('ManageFlat backend is running')
});

app.listen(port, () => {
  console.log("ManageFlat server is running on port", port);
});
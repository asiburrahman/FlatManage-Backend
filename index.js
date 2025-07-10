const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config()
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8');
const serviceAccount = JSON.parse(decoded);

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
      const { userEmail, apartmentNo } = req.body;

      // Check if the user already has an agreement
      const existing = await agreementsCollection.findOne({ userEmail });

      if (existing) {
        return res.status(400).json({ message: 'You already have an agreement.' });
      }

      // Save new agreement
      const result = await agreementsCollection.insertOne({
        ...req.body,
        status: 'pending',
        agreementDate: new Date()
      });

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
      console.log(email);

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
    app.get('/announcements', async (req, res) => {
      try {
        const announcements = await announcementCollection.find().toArray();
        res.send(announcements);
      } catch (err) {
        console.error('❌ Failed to fetch announcements:', err);
        res.status(500).send({ error: 'Failed to fetch announcements' });
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
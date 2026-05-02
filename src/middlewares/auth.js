const admin = require("firebase-admin");

let usersCollection;

const initAuth = (collection) => {
  usersCollection = collection;
};

const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: "Unauthorize Access" })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = await admin.auth().verifyIdToken(token)
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

const verifyAdmin = async (req, res, next) => {
  if (!usersCollection) return res.status(500).send({ message: "Auth middleware not initialized" });
  
  const email = req?.decoded?.email;
  const user = await usersCollection.findOne({ email });
  
  if (!user || user?.role !== 'admin') {
    return res.status(403).send({ message: 'Admin only Actions!', role: user?.role })
  }

  next()
}

const verifyMember = async (req, res, next) => {
  if (!usersCollection) return res.status(500).send({ message: "Auth middleware not initialized" });

  const email = req?.decoded?.email;
  const user = await usersCollection.findOne({ email });
  
  if (!user || user?.role !== 'member') {
    return res.status(403).send({ message: 'Member only Actions!', role: user?.role })
  }

  next()
}

module.exports = {
  initAuth,
  verifyAccessToken,
  verifyTokenEmail,
  verifyAdmin,
  verifyMember
};

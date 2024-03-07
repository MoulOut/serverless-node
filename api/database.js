const { MongoClient, ObjectId } = require('mongodb');

let connectionInstance = null;
async function connectToDb() {
  if (connectionInstance) return connectionInstance;
  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING);
  const connection = await client.connect();
  connectionInstance = connection.db(process.env.MONGOGB_DB_NAME);
  return connectionInstance;
}

async function getUserByCredentials(username, password) {
  const client = await connectToDb();
  const colletion = await client.collection('users');
  const user = await colletion.findOne({
    name: username,
    password: password,
  });

  if (!user) {
    return null;
  }

  return user;
}

async function saveResultsToDb(result) {
  const client = await connectToDb();
  const collection = await client.collection('results');
  const { insertedId } = await collection.insertOne(result);

  return insertedId;
}

async function getResultById(id) {
  const client = await connectToDb();
  const collection = await client.collection('results');
  const result = await collection.findOne({
    _id: new ObjectId(id),
  });

  if (result) return result;

  return null;
}

module.exports = {
  getUserByCredentials,
  connectToDb,
  saveResultsToDb,
  getResultById,
};

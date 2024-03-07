const { MongoClient, ObjectId } = require('mongodb');
const { pbkdf2Sync } = require('crypto');
const { sign, verify } = require('jsonwebtoken');

let connectionInstance = null;

async function connectToDb() {
  if (connectionInstance) return connectionInstance;
  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING);
  const connection = await client.connect();
  connectionInstance = connection.db(process.env.MONGOGB_DB_NAME);
  return connectionInstance;
}

function extractBody(event) {
  if (event?.body) {
    return JSON.parse(event.body);
  }

  return {
    statusCode: 422,
    body: JSON.stringify({ error: 'Missing body' }),
  };
}

async function authorize(event) {
  const { authorization } = event.headers;

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing authorization header' }),
    };
  }

  const [type, token] = authorization.split(' ');
  if (type !== 'Bearer' || !token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unsuported authorization type.' }),
    };
  }

  const decodedToken = verify(token, process.env.JWT_SECRET, {
    audience: 'serverless',
  });

  if (!decodedToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid Token.' }),
    };
  }

  return decodedToken;
}

module.exports.login = async (event) => {
  const { username, password } = extractBody(event);

  const hashedPass = pbkdf2Sync(
    password,
    process.env.SALT,
    100000,
    64,
    'sha512'
  ).toString('hex');

  const client = await connectToDb();
  const colletion = await client.collection('users');
  const user = await colletion.findOne({
    name: username,
    password: hashedPass,
  });

  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid Credentials.' }),
    };
  }

  const token = sign({ username, id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    audience: 'serverless',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  };
};

module.exports.sendResponse = async (event) => {
  const authResult = await authorize(event);
  if (authResult.statusCode === 401) return authResult;

  const { name, answers } = extractBody(event);
  const correctQuestions = [3, 1, 0, 2];

  const totalCorrectAnswers = answers.reduce((acc, answer, index) => {
    if (answer === correctQuestions[index]) {
      acc++;
    }
    return acc;
  }, 0);

  const result = {
    name,
    answers,
    totalCorrectAnswers,
    totalAnswers: answers.length,
  };

  const client = await connectToDb();
  const collection = await client.collection('results');
  const { insertedId } = await collection.insertOne(result);

  return {
    statusCode: 201,
    body: JSON.stringify({
      resultId: insertedId,
      __hypermedia: {
        href: `/results.html`,
        query: { id: insertedId },
      },
    }),
    headers: {
      'Contente-Type': 'application/json',
    },
  };
};

module.exports.getResult = async (event) => {
  const authResult = await authorize(event);
  if (authResult.statusCode === 401) return authResult;

  const client = await connectToDb();
  const collection = await client.collection('results');
  const result = await collection.findOne({
    _id: new ObjectId(event.pathParameters.id),
  });

  if (!result) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Result not found' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
    headers: { 'Content-Type': 'application/json' },
  };
};

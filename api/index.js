const { buildResponse } = require('./utils');
const {
  getUserByCredentials,
  saveResultsToDb,
  getResultById,
} = require('./database');
const { createToken, makeHash, authorize } = require('./auth');
const { countCorrectAnswers } = require('./responses');

function extractBody(event) {
  if (event?.body) {
    return JSON.parse(event.body);
  }

  return buildResponse(422, { error: 'Missing body.' });
}

module.exports.login = async (event) => {
  const { username, password } = extractBody(event);

  const hashedPass = makeHash(password);

  const user = await getUserByCredentials(username, hashedPass);

  if (!user) {
    return buildResponse(401, { error: 'Invalid Credentials.' });
  }

  return buildResponse(200, { token: createToken(username, user._id) });
};

module.exports.sendResponse = async (event) => {
  const authResult = await authorize(event);
  if (authResult.statusCode === 401) return authResult;

  const { name, answers } = extractBody(event);
  const result = countCorrectAnswers(name, answers);

  const insertedId = await saveResultsToDb(result);

  return buildResponse(201, {
    resultId: insertedId,
    __hypermedia: {
      href: `/results.html`,
      query: { id: insertedId },
    },
  });
};

module.exports.getResult = async (event) => {
  const authResult = await authorize(event);
  if (authResult.statusCode === 401) return authResult;

  const result = await getResultById(event.pathParameters.id);

  if (!result) {
    return buildResponse(404, { error: 'Result not found' });
  }

  return buildResponse(200, result);
};

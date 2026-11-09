const jwt = require('jsonwebtoken');

// Transport is selected by the server router, never by a request header/body.
function refreshInput(req, res) {
  return res.locals?.mobileAuth ? req.body?.refreshToken : req.cookies?.refreshToken;
}

function sendSession(res, payload) {
  if (!res.locals?.mobileAuth) return res.json(payload);
  const { token, ...user } = payload;
  const claims = jwt.decode(token);
  const result = {
    accessToken: token,
    refreshToken: res.locals.mobileRefreshToken,
    expiresIn: Math.max(0, claims.exp - Math.floor(Date.now() / 1000)),
  };
  delete res.locals.mobileRefreshToken;
  if (user._id) result.user = user;
  res.set('Cache-Control', 'no-store');
  return res.json(result);
}

module.exports = { refreshInput, sendSession };

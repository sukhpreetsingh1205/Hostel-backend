import jwt from 'jsonwebtoken';

const generateToken = (id, role, expiresIn = process.env.JWT_EXPIRE) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (id, role) => {
  return jwt.sign(
    { id, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

const verifyToken = (token, isRefresh = false) => {
  const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
  return jwt.verify(token, secret);
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

export { generateToken, generateRefreshToken, verifyToken, decodeToken };
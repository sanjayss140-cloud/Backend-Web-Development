const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const DEFAULT_BCRYPT_COST = 12;
// Valid precomputed cost-12 bcrypt hash for constant-time missing-user comparisons.
const DUMMY_PASSWORD_HASH = '$2b$12$kTSrgEjnDv6B1kX.IrkVgehdon6jeoVicJVnZSe.oKW3IJile/sT.';

function getBcryptCost() {
  const parsed = Number(process.env.BCRYPT_COST);
  if (Number.isInteger(parsed) && parsed >= 4 && parsed <= 31) {
    return parsed;
  }
  return DEFAULT_BCRYPT_COST;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function createInvalidCredentialsError() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

/**
 * Validates input, normalizes email, hashes password with bcryptjs, and creates a user.
 */
async function register(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const { name, email, password } = payload;
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Name, email, and password must be non-empty strings');
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, getBcryptCost());
  const createdUser = await userRepository.createUser({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return toSafeUser(createdUser);
}

/**
 * Validates input, looks up user by normalized email, and verifies credentials with bcryptjs.
 */
async function login(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const { email, password } = payload;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email and password must be non-empty strings');
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  const targetHash = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const isPasswordValid = await bcrypt.compare(password, targetHash);

  if (!user || !isPasswordValid) {
    throw createInvalidCredentialsError();
  }

  return toSafeUser(user);
}

module.exports = {
  register,
  login,
  toSafeUser,
};

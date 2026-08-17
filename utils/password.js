'use strict';

const bcrypt = require('bcryptjs');

const TEMPORARY_PASSWORD_PREFIX = 'temporary:';
const BCRYPT_ROUNDS = 10;

function isTemporaryPassword(storedPassword) {
  return typeof storedPassword === 'string'
    && storedPassword.startsWith(TEMPORARY_PASSWORD_PREFIX)
    && storedPassword.length > TEMPORARY_PASSWORD_PREFIX.length;
}

function getPasswordHash(storedPassword) {
  if (typeof storedPassword !== 'string' || storedPassword.length === 0) {
    return '';
  }
  return isTemporaryPassword(storedPassword)
    ? storedPassword.slice(TEMPORARY_PASSWORD_PREFIX.length)
    : storedPassword;
}

async function verifyPassword(password, storedPassword) {
  if (typeof password !== 'string') {
    return false;
  }
  const passwordHash = getPasswordHash(storedPassword);
  if (!passwordHash) {
    return false;
  }
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch (_error) {
    return false;
  }
}

async function hashPassword(password, options = {}) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return options.temporary
    ? `${TEMPORARY_PASSWORD_PREFIX}${passwordHash}`
    : passwordHash;
}

module.exports = {
  hashPassword,
  isTemporaryPassword,
  verifyPassword,
};

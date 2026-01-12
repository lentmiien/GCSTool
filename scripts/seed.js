#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcryptjs');

const requiredEnv = ['DB_NAME_GCS', 'DB_NAME_TRACK', 'DB_USER', 'DB_PASS', 'DB_HOST'];

let sequelize;
let sequelize_tracker;
let User;
let Username;
let Staff;

function assertEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function ensureAdminUser() {
  const adminUserid = process.env.SEED_ADMIN_USER || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASS || 'changeme';
  const adminTeam = process.env.SEED_ADMIN_TEAM || 'gcs';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const [user, created] = await User.findOrCreate({
    where: { userid: adminUserid },
    defaults: {
      password: hashedPassword,
      team: adminTeam,
      role: 'admin',
    },
  });

  let updated = false;

  if (!user.password) {
    user.password = hashedPassword;
    updated = true;
  }
  if (!user.team) {
    user.team = adminTeam;
    updated = true;
  }
  if (!user.role) {
    user.role = 'admin';
    updated = true;
  }

  if (updated && !created) {
    await user.save();
  }

  return { user, created, passwordSet: created || updated };
}

async function ensureDisplayName(userid) {
  const displayName = process.env.SEED_ADMIN_NAME || userid;
  const [username, created] = await Username.findOrCreate({
    where: { userid },
    defaults: { name: displayName },
  });

  let updated = false;

  if (!created && !username.name) {
    username.name = displayName;
    updated = true;
    await username.save();
  }

  return { created, updated };
}

async function ensureStaff(userid) {
  const defaultSchedule = {
    day0: 'off',
    day1: 'work',
    day2: 'work',
    day3: 'work',
    day4: 'work',
    day5: 'work',
    day6: 'off',
  };

  const [staff, created] = await Staff.findOrCreate({
    where: { name: userid },
    defaults: defaultSchedule,
  });

  let updated = false;

  Object.keys(defaultSchedule).forEach((key) => {
    if (!staff[key]) {
      staff[key] = defaultSchedule[key];
      updated = true;
    }
  });

  if (updated && !created) {
    await staff.save();
  }

  return { created, updated };
}

async function main() {
  assertEnv();

  ({ sequelize, sequelize_tracker, User, Username, Staff } = require('../sequelize'));

  await sequelize.authenticate();
  await sequelize_tracker.authenticate();

  await sequelize.sync();
  await sequelize_tracker.sync();

  const { user, created, passwordSet } = await ensureAdminUser();
  const usernameResult = await ensureDisplayName(user.userid);
  const staffResult = await ensureStaff(user.userid);

  console.log(`User "${user.userid}" ${created ? 'created' : 'already exists'} (${user.role || 'admin'}).`);
  console.log(passwordSet ? 'Password set from SEED_ADMIN_PASS.' : 'Password left unchanged.');
  console.log(`Username record ${usernameResult.created ? 'created' : usernameResult.updated ? 'updated' : 'already existed'}.`);
  console.log(`Staff record ${staffResult.created ? 'created' : staffResult.updated ? 'updated' : 'already existed'}.`);
  console.log('Seed complete.');

  await Promise.all([sequelize.close(), sequelize_tracker.close()]);
}

main().catch(async (err) => {
  console.error('Seeding failed:', err);
  if (sequelize) {
    try {
      await sequelize.close();
    } catch (closeErr) {
      console.error('Failed to close GCS connection:', closeErr);
    }
  }
  if (sequelize_tracker) {
    try {
      await sequelize_tracker.close();
    } catch (closeErr) {
      console.error('Failed to close Tracker connection:', closeErr);
    }
  }
  process.exit(1);
});

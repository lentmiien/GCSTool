const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Sequelize = require('sequelize');

const HostSampleModel = require('../models/host_sample');

const DEFAULT_RETENTION_DAYS = 30;

function getRetentionDays() {
  const parsed = parseInt(process.env.HOST_SAMPLE_RETENTION_DAYS, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

function createSequelize() {
  const required = ['DB_NAME_GCS', 'DB_USER', 'DB_PASS', 'DB_HOST'];
  const missing = required.filter((name) => typeof process.env[name] === 'undefined');

  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(', ')}`);
  }

  return new Sequelize(process.env.DB_NAME_GCS, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  });
}

async function main() {
  const sequelize = createSequelize();
  const HostSample = HostSampleModel(sequelize, Sequelize);

  try {
    await HostSample.sync();

    const retentionDays = getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deletedRows = await HostSample.destroy({
      where: {
        ts: {
          [Sequelize.Op.lt]: cutoff,
        },
      },
    });

    console.log(new Date().toISOString(), 'cleanup completed', {
      retentionDays,
      cutoff: cutoff.toISOString(),
      deletedRows,
    });
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(new Date().toISOString(), 'cleanup failed', err);
  process.exit(1);
});

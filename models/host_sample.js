module.exports = (sequelize, type) => {
  return sequelize.define('host_sample', {
    id: {
      type: type.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    ts: {
      type: type.DATE,
      allowNull: false,
      defaultValue: type.NOW,
    },
    hostname: {
      type: type.STRING,
      allowNull: false,
    },
    mem_total_mb: {
      type: type.INTEGER,
      allowNull: false,
    },
    mem_used_mb: {
      type: type.INTEGER,
      allowNull: false,
    },
    mem_available_mb: {
      type: type.INTEGER,
      allowNull: false,
    },
    swap_total_mb: {
      type: type.INTEGER,
      allowNull: false,
    },
    swap_used_mb: {
      type: type.INTEGER,
      allowNull: false,
    },
    load1: {
      type: type.DOUBLE,
      allowNull: false,
    },
    load5: {
      type: type.DOUBLE,
      allowNull: false,
    },
    load15: {
      type: type.DOUBLE,
      allowNull: false,
    },
    root_used_pct: {
      type: type.INTEGER,
      allowNull: false,
    },
    process_count: {
      type: type.INTEGER,
      allowNull: false,
    },
    node_processes: {
      type: type.JSON,
      allowNull: false,
    },
    pm2_processes: {
      type: type.JSON,
      allowNull: false,
    },
  }, {
    tableName: 'host_samples',
    timestamps: false,
    indexes: [
      {
        name: 'host_samples_ts_idx',
        fields: [{ name: 'ts', order: 'DESC' }],
      },
      {
        name: 'host_samples_hostname_ts_idx',
        fields: ['hostname', { name: 'ts', order: 'DESC' }],
      },
    ],
  });
};

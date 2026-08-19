module.exports = (sequelize, type) => {
  return sequelize.define('daily_task_type', {
    name: {
      type: type.STRING(120),
      allowNull: false,
    },
    description: {
      type: type.STRING(500),
      allowNull: false,
      defaultValue: '',
    },
    team: {
      type: type.STRING(64),
      allowNull: false,
    },
    archived: {
      type: type.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdByUserId: {
      type: type.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'daily_task_types',
    indexes: [
      {
        name: 'daily_task_types_team_name_unique',
        unique: true,
        fields: ['team', 'name'],
      },
      {
        name: 'daily_task_types_team_archived',
        fields: ['team', 'archived'],
      },
    ],
  });
};

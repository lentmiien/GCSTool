module.exports = (sequelize, type) => {
  return sequelize.define('daily_task_assignment', {
    date: {
      type: type.DATEONLY,
      allowNull: false,
    },
    taskTypeId: {
      type: type.INTEGER,
      allowNull: false,
    },
    assigneeUserId: {
      type: type.INTEGER,
      allowNull: false,
    },
    assigneeName: {
      type: type.STRING(120),
      allowNull: false,
    },
    assignedByUserId: {
      type: type.INTEGER,
      allowNull: false,
    },
    assignedByName: {
      type: type.STRING(120),
      allowNull: false,
    },
    note: {
      type: type.STRING(500),
      allowNull: false,
      defaultValue: '',
    },
  }, {
    tableName: 'daily_task_assignments',
    indexes: [
      {
        name: 'daily_task_assignments_type_date_unique',
        unique: true,
        fields: ['taskTypeId', 'date'],
      },
      {
        name: 'daily_task_assignments_assignee_date',
        fields: ['assigneeUserId', 'date'],
      },
      {
        name: 'daily_task_assignments_date',
        fields: ['date'],
      },
    ],
  });
};

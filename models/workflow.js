// Runs snapshot instructions and variables; assignments are separately queryable.
module.exports = (sequelize, type) => {
  const WorkflowDefinition = sequelize.define('workflowDefinition', {
    name: { type: type.STRING(160), allowNull: false },
    description: { type: type.TEXT, allowNull: false, defaultValue: '' },
    steps: { type: type.JSON, allowNull: false },
    requiredVariables: { type: type.JSON, allowNull: false },
    locked: { type: type.BOOLEAN, allowNull: false, defaultValue: false },
    archived: { type: type.BOOLEAN, allowNull: false, defaultValue: false },
    enabled: { type: type.BOOLEAN, allowNull: false, defaultValue: true },
    trigger: { type: type.STRING(16), allowNull: false },
    schedule: type.JSON,
    nextStart: type.DATE,
    revision: { type: type.INTEGER, allowNull: false, defaultValue: 0 },
  });
  const WorkflowRun = sequelize.define('workflowRun', {
    id: { type: type.UUID, primaryKey: true, defaultValue: type.UUIDV4 },
    name: { type: type.STRING(160), allowNull: false },
    status: { type: type.STRING(16), allowNull: false, defaultValue: 'open' },
    activePosition: { type: type.INTEGER, allowNull: false, defaultValue: 0 },
    variables: { type: type.JSON, allowNull: false },
    scheduledFor: type.DATE,
    startKey: { type: type.UUID, unique: true },
    revision: { type: type.INTEGER, allowNull: false, defaultValue: 0 },
    finishedAt: type.DATE,
    cancellationReason: type.TEXT,
  }, { indexes: [{ unique: true, fields: ['definitionId', 'scheduledFor'] }, { fields: ['status', 'createdAt'] }] });
  const WorkflowTask = sequelize.define('workflowTask', {
    stepId: { type: type.UUID, allowNull: false },
    position: { type: type.INTEGER, allowNull: false },
    title: { type: type.STRING(160), allowNull: false },
    description: { type: type.TEXT, allowNull: false },
    state: { type: type.STRING(16), allowNull: false },
    comment: { type: type.TEXT, allowNull: false, defaultValue: '' },
    commentBy: type.STRING,
    commentAt: type.DATE,
    activatedAt: type.DATE,
    completedAt: type.DATE,
    completedBy: type.STRING,
  }, { indexes: [{ unique: true, fields: ['runId', 'position'] }, { fields: ['state'] }] });
  const WorkflowAssignee = sequelize.define('workflowAssignee', {
    userId: { type: type.INTEGER, allowNull: false },
  }, { indexes: [{ unique: true, fields: ['taskId', 'userId'] }, { fields: ['userId'] }] });
  const WorkflowParticipant = sequelize.define('workflowParticipant', {
    userId: { type: type.INTEGER, allowNull: false },
  }, { indexes: [{ unique: true, fields: ['runId', 'userId'] }, { fields: ['userId'] }] });
  // Deliberately omit comment bodies: there is only one stored comment per task.
  const WorkflowEvent = sequelize.define('workflowEvent', {
    taskId: type.INTEGER,
    userId: type.INTEGER,
    userName: { type: type.STRING, allowNull: false },
    action: { type: type.STRING(24), allowNull: false },
    durationSeconds: type.INTEGER,
  }, { indexes: [{ fields: ['runId', 'createdAt'] }, { fields: ['userId', 'action'] }] });
  WorkflowDefinition.hasMany(WorkflowRun, { as: 'runs', foreignKey: { name: 'definitionId', allowNull: false } });
  WorkflowRun.belongsTo(WorkflowDefinition, { as: 'definition', foreignKey: 'definitionId' });
  for (const [model, alias] of [[WorkflowTask, 'tasks'], [WorkflowParticipant, 'participants'], [WorkflowEvent, 'events']]) {
    WorkflowRun.hasMany(model, { as: alias, foreignKey: { name: 'runId', allowNull: false } });
    model.belongsTo(WorkflowRun, { as: 'run', foreignKey: 'runId' });
  }
  WorkflowTask.hasMany(WorkflowAssignee, { as: 'assignees', foreignKey: { name: 'taskId', allowNull: false } });
  WorkflowAssignee.belongsTo(WorkflowTask, { as: 'task', foreignKey: 'taskId' });
  return { WorkflowDefinition, WorkflowRun, WorkflowTask, WorkflowAssignee, WorkflowParticipant, WorkflowEvent };
};

function defineRunCaseResult(sequelize, DataTypes) {
  const RunCaseResult = sequelize.define('RunCaseResult', {
    runCaseId: { type: DataTypes.INTEGER, allowNull: false },
    userId:    { type: DataTypes.INTEGER, allowNull: false },
    status:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  });

  RunCaseResult.associate = (models) => {
    RunCaseResult.belongsTo(models.RunCase, { foreignKey: 'runCaseId', onDelete: 'CASCADE' });
    RunCaseResult.belongsTo(models.User,    { foreignKey: 'userId',    onDelete: 'CASCADE' });
  };

  return RunCaseResult;
}

export default defineRunCaseResult;

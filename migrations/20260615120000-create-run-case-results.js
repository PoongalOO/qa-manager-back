export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('runCaseResults', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    runCaseId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'runCases', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    status: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: { type: Sequelize.DATE, allowNull: false },
    updatedAt: { type: Sequelize.DATE, allowNull: false },
  });

  await queryInterface.addIndex('runCaseResults', ['runCaseId', 'userId'], { unique: true });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('runCaseResults');
}

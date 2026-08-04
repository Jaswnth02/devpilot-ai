const sequelize = require('../config/database');

const User = require('./User');
const Project = require('./Project');
const ProjectMember = require('./ProjectMember');
const Skill = require('./Skill');
const UserSkill = require('./UserSkill');
const Task = require('./Task');
const TaskDependency = require('./TaskDependency');
const Issue = require('./Issue');
const Comment = require('./Comment');
const Notification = require('./Notification');
const GitHubAccount = require('./GitHubAccount');
const GitHubRepository = require('./GitHubRepository');
const GitHubCommit = require('./GitHubCommit');
const GitHubPullRequest = require('./GitHubPullRequest');
const GitHubIssue = require('./GitHubIssue');
const AIAnalysis = require('./AIAnalysis');

// Define Relationships

// User <-> Skill (Many-to-Many)
User.belongsToMany(Skill, { through: UserSkill, foreignKey: 'user_id', otherKey: 'skill_id', onDelete: 'CASCADE' });
Skill.belongsToMany(User, { through: UserSkill, foreignKey: 'skill_id', otherKey: 'user_id', onDelete: 'CASCADE' });

// User <-> Project (Many-to-Many through ProjectMember)
User.belongsToMany(Project, { through: ProjectMember, foreignKey: 'user_id', otherKey: 'project_id', onDelete: 'CASCADE' });
Project.belongsToMany(User, { through: ProjectMember, foreignKey: 'project_id', otherKey: 'user_id', onDelete: 'CASCADE' });

// ProjectMember associations for querying
ProjectMember.belongsTo(User, { foreignKey: 'user_id' });
ProjectMember.belongsTo(Project, { foreignKey: 'project_id' });
User.hasMany(ProjectMember, { foreignKey: 'user_id' });
Project.hasMany(ProjectMember, { foreignKey: 'project_id' });

// Project <-> Task (One-to-Many)
Project.hasMany(Task, { foreignKey: 'project_id', onDelete: 'CASCADE' });
Task.belongsTo(Project, { foreignKey: 'project_id' });

// User <-> Task (One-to-Many, Assigned User)
User.hasMany(Task, { foreignKey: 'assigned_user_id', onDelete: 'SET NULL' });
Task.belongsTo(User, { as: 'Assignee', foreignKey: 'assigned_user_id' });

// Task self-association for Dependencies (Many-to-Many)
Task.belongsToMany(Task, { 
  as: 'Dependencies', 
  through: TaskDependency, 
  foreignKey: 'task_id', 
  otherKey: 'depends_on_task_id',
  onDelete: 'CASCADE'
});
Task.belongsToMany(Task, { 
  as: 'DependentTasks', 
  through: TaskDependency, 
  foreignKey: 'depends_on_task_id', 
  otherKey: 'task_id',
  onDelete: 'CASCADE'
});

// Task <-> Issue (One-to-Many)
Task.hasMany(Issue, { foreignKey: 'task_id', onDelete: 'CASCADE' });
Issue.belongsTo(Task, { foreignKey: 'task_id' });

// User <-> Issue (One-to-Many, Reporter)
User.hasMany(Issue, { foreignKey: 'reported_by_user_id', onDelete: 'CASCADE' });
Issue.belongsTo(User, { as: 'Reporter', foreignKey: 'reported_by_user_id' });

// Task <-> Comment (One-to-Many)
Task.hasMany(Comment, { foreignKey: 'task_id', onDelete: 'CASCADE' });
Comment.belongsTo(Task, { foreignKey: 'task_id' });

// User <-> Comment (One-to-Many)
User.hasMany(Comment, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id' });

// User <-> Notification (One-to-Many)
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// User <-> GitHubAccount (One-to-One)
User.hasOne(GitHubAccount, { foreignKey: 'user_id', onDelete: 'CASCADE' });
GitHubAccount.belongsTo(User, { foreignKey: 'user_id' });

// Project <-> GitHubRepository (One-to-One)
Project.hasOne(GitHubRepository, { foreignKey: 'project_id', onDelete: 'CASCADE' });
GitHubRepository.belongsTo(Project, { foreignKey: 'project_id' });

// GitHubRepository <-> Commits (One-to-Many)
GitHubRepository.hasMany(GitHubCommit, { foreignKey: 'repo_id', onDelete: 'CASCADE' });
GitHubCommit.belongsTo(GitHubRepository, { as: 'Repository', foreignKey: 'repo_id' });

// GitHubRepository <-> PullRequests (One-to-Many)
GitHubRepository.hasMany(GitHubPullRequest, { foreignKey: 'repo_id', onDelete: 'CASCADE' });
GitHubPullRequest.belongsTo(GitHubRepository, { as: 'Repository', foreignKey: 'repo_id' });

// GitHubRepository <-> Issues (One-to-Many)
GitHubRepository.hasMany(GitHubIssue, { foreignKey: 'repo_id', onDelete: 'CASCADE' });
GitHubIssue.belongsTo(GitHubRepository, { as: 'Repository', foreignKey: 'repo_id' });

// Project <-> AIAnalysis (One-to-Many)
Project.hasMany(AIAnalysis, { foreignKey: 'project_id', onDelete: 'CASCADE' });
AIAnalysis.belongsTo(Project, { foreignKey: 'project_id' });

module.exports = {
  sequelize,
  User,
  Project,
  ProjectMember,
  Skill,
  UserSkill,
  Task,
  TaskDependency,
  Issue,
  Comment,
  Notification,
  GitHubAccount,
  GitHubRepository,
  GitHubCommit,
  GitHubPullRequest,
  GitHubIssue,
  AIAnalysis
};

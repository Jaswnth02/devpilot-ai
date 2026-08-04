const express = require('express');
const cors = require('cors');
const http = require('http');
const bcrypt = require('bcryptjs');
const sequelize = require('./config/database');
const socketService = require('./services/socketService');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const aiRoutes = require('./routes/ai');
const githubRoutes = require('./routes/github');

// Import models to sync relationships
const { User, Skill, UserSkill } = require('./models');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS config
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Bind routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/github', githubRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

const server = http.createServer(app);

// Initialize Socket.IO
socketService.init(server);

// Database sync and seeding function
const startServer = async () => {
  try {
    // Sync models
    await sequelize.sync();
    console.log('Database synced successfully.');

    // Seed default data if database is empty
    const usersCount = await User.count();
    if (usersCount === 0) {
      console.log('Database is empty. Seeding demo project owner and developer profiles...');

      const hashedPassword = await bcrypt.hash('password123', 10);

      // Create owner
      const owner = await User.create({
        name: 'Alex Owner',
        email: 'owner@devpilot.ai',
        password: hashedPassword,
        role: 'Project Owner',
        experience_level: 'Senior',
        availability: true,
        current_workload: 0
      });

      // Create developers
      const devs = [
        { name: 'Arun', email: 'arun@devpilot.ai', role: 'Developer', experience_level: 'Senior', skills: ['Node.js', 'Express.js', 'MySQL', 'REST API'] },
        { name: 'Jaswanth', email: 'jaswanth@devpilot.ai', role: 'Developer', experience_level: 'Mid', skills: ['React', 'JavaScript', 'CSS', 'HTML'] },
        { name: 'Rahul', email: 'rahul@devpilot.ai', role: 'Developer', experience_level: 'Junior', skills: ['MySQL', 'Python', 'JavaScript'] },
        { name: 'Karthik', email: 'karthik@devpilot.ai', role: 'Developer', experience_level: 'Mid', skills: ['Testing', 'JavaScript', 'REST API'] }
      ];

      for (const devInfo of devs) {
        const dev = await User.create({
          name: devInfo.name,
          email: devInfo.email,
          password: hashedPassword,
          role: devInfo.role,
          experience_level: devInfo.experience_level,
          availability: true,
          current_workload: 0
        });

        for (const skillName of devInfo.skills) {
          const [skill] = await Skill.findOrCreate({ where: { name: skillName } });
          await UserSkill.create({
            user_id: dev.id,
            skill_id: skill.id
          });
        }
      }

      console.log('Demo database seeding completed.');
    }

    server.listen(PORT, () => {
      console.log(`DevPilot server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to sync database / start server:', error);
    process.exit(1);
  }
};

startServer();

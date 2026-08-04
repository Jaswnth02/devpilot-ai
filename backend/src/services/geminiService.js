const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;

if (API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(API_KEY);
    console.log('Gemini AI Service initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini SDK. Falling back to Mock mode:', err.message);
  }
} else {
  console.log('No GEMINI_API_KEY found in env. Running in Mock AI Mode.');
}

/**
 * Helper to generate mock project decomposition
 */
const generateMockPlan = (projectName, projectDescription) => {
  console.log('[Mock AI] Decomposing project:', projectName);
  
  const desc = (projectDescription || '').toLowerCase();
  const isBookStore = desc.includes('book') || projectName.toLowerCase().includes('book');

  if (isBookStore) {
    return {
      modules: [
        { name: 'Authentication', description: 'User login, registration, and security authorization.' },
        { name: 'Book Catalog', description: 'Browsing, filtering, and management of books.' },
        { name: 'Search Engine', description: 'Faceted searching and catalog indexing.' },
        { name: 'Shopping Cart', description: 'Temporary basket storage for items prior to order creation.' },
        { name: 'Orders & Payments', description: 'Checkout workflows and checkout payment gateway integrations.' }
      ],
      tasks: [
        {
          title: 'Design database schema',
          description: 'Establish tables for books, users, orders, and payment histories.',
          module: 'Book Catalog',
          required_skills: ['MySQL', 'Database design'],
          priority: 'High',
          complexity: 'High',
          dependencies: []
        },
        {
          title: 'Implement registration API',
          description: 'Secure REST endpoint to create new accounts using bcrypt hashing.',
          module: 'Authentication',
          required_skills: ['Node.js', 'Express.js', 'MySQL'],
          priority: 'High',
          complexity: 'Medium',
          dependencies: ['Design database schema']
        },
        {
          title: 'Implement login API & JWT token generation',
          description: 'Expose authenticate endpoint returning short-lived JSON Web Tokens.',
          module: 'Authentication',
          required_skills: ['Node.js', 'Express.js', 'JWT'],
          priority: 'High',
          complexity: 'Medium',
          dependencies: ['Implement registration API']
        },
        {
          title: 'Create book retrieval REST API',
          description: 'Provide pagination and filtering options to list catalog books.',
          module: 'Book Catalog',
          required_skills: ['Node.js', 'Express.js', 'MySQL'],
          priority: 'Medium',
          complexity: 'Medium',
          dependencies: ['Design database schema']
        },
        {
          title: 'Develop react catalog list UI',
          description: 'Build a grid dashboard rendering books with categories filter.',
          module: 'Book Catalog',
          required_skills: ['React', 'JavaScript', 'Tailwind CSS'],
          priority: 'Medium',
          complexity: 'Medium',
          dependencies: ['Create book retrieval REST API']
        },
        {
          title: 'Create Search API',
          description: 'API endpoint for indexing and query matching books by title/author/keyword.',
          module: 'Search Engine',
          required_skills: ['Node.js', 'Express.js', 'MySQL'],
          priority: 'High',
          complexity: 'Medium',
          dependencies: ['Create book retrieval REST API']
        },
        {
          title: 'Develop Shopping Cart logic',
          description: 'Expose local state management or API routes to persist selected items.',
          module: 'Shopping Cart',
          required_skills: ['React', 'JavaScript'],
          priority: 'Medium',
          complexity: 'Low',
          dependencies: ['Develop react catalog list UI']
        },
        {
          title: 'Create Order submission API',
          description: 'Receive cart contents, check inventory limits, and generate open orders.',
          module: 'Orders & Payments',
          required_skills: ['Node.js', 'Express.js', 'MySQL'],
          priority: 'High',
          complexity: 'High',
          dependencies: ['Develop Shopping Cart logic']
        },
        {
          title: 'Integrate Payment API',
          description: 'Connect checkout gateway (Stripe/Paypal mock) to confirm transaction tokens.',
          module: 'Orders & Payments',
          required_skills: ['Node.js', 'Payment integration', 'REST API'],
          priority: 'High',
          complexity: 'High',
          dependencies: ['Create Order submission API']
        }
      ]
    };
  }

  // Default mock plan for other project descriptions
  return {
    modules: [
      { name: 'Core Setup', description: 'Foundation structures, database configurations, and initial settings.' },
      { name: 'API Services', description: 'Core functional endpoints and business logic layers.' },
      { name: 'User Interface', description: 'Front-end layout designs, pages, and interactive dashboard views.' }
    ],
    tasks: [
      {
        title: 'Establish Database Structure',
        description: 'Define relational models, constraints, and mock seed records.',
        module: 'Core Setup',
        required_skills: ['Database design', 'MySQL'],
        priority: 'High',
        complexity: 'Medium',
        dependencies: []
      },
      {
        title: 'Build Core Service Endpoint',
        description: 'Create controller endpoints handling application data flows.',
        module: 'API Services',
        required_skills: ['Node.js', 'Express.js', 'REST API'],
        priority: 'High',
        complexity: 'Medium',
        dependencies: ['Establish Database Structure']
      },
      {
        title: 'Design Client Interface Layout',
        description: 'Build landing shell, navigation sidebars, and responsive UI containers.',
        module: 'User Interface',
        required_skills: ['React', 'Tailwind CSS'],
        priority: 'Medium',
        complexity: 'Low',
        dependencies: []
      },
      {
        title: 'Integrate Front-End API Consumers',
        description: 'Hook Axios fetch requests to populate frontend dashboard tables.',
        module: 'User Interface',
        required_skills: ['React', 'REST API', 'JavaScript'],
        priority: 'High',
        complexity: 'Medium',
        dependencies: ['Build Core Service Endpoint', 'Design Client Interface Layout']
      }
    ]
  };
};

/**
 * Decomposes project requirements using Gemini AI
 */
const generatePlan = async (projectName, projectDescription) => {
  if (!genAI) {
    return generateMockPlan(projectName, projectDescription);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      You are an expert software architect and product manager.
      Decompose the following software project idea into a structured list of technical modules and tasks.

      Project Name: "${projectName}"
      Project Description: "${projectDescription}"

      Provide the decomposition strictly as a JSON object matching this schema:
      {
        "modules": [
          { "name": "Module Name", "description": "Module purpose description" }
        ],
        "tasks": [
          {
            "title": "Short Task Title (must be unique)",
            "description": "Short explanation of the work required for this task",
            "module": "Matching Module Name from list above",
            "required_skills": ["Skill1", "Skill2", "Skill3"],
            "priority": "High" | "Medium" | "Low",
            "complexity": "High" | "Medium" | "Low",
            "dependencies": ["Title of task this task depends on (must be in this tasks list)"]
          }
        ]
      }

      Keep the modules list under 8.
      Keep the tasks list between 8 and 18 for a good sample size.
      Ensure tasks dependencies reference only task titles listed in the generated tasks.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini generatePlan error, falling back to mock plan:', error);
    return generateMockPlan(projectName, projectDescription);
  }
};

/**
 * Generates recommendation comments for Developer assignments
 */
const recommendAssignments = async (tasks, developers) => {
  if (!genAI) {
    // Return mock assignment suggestions directly
    console.log('[Mock AI] Recommending task assignments...');
    return tasks.map(task => {
      const taskSkills = task.required_skills.map(s => s.toLowerCase());
      
      let bestDev = null;
      let highestMatch = -1;

      developers.forEach(dev => {
        const devSkills = (dev.Skills || []).map(s => s.name.toLowerCase());
        const matchCount = taskSkills.filter(s => devSkills.includes(s)).length;
        
        // Calculate basic score balancing match vs capacity (lower workload is better)
        const capacityFactor = 10 - dev.current_workload;
        const score = (matchCount * 3) + capacityFactor;

        if (score > highestMatch) {
          highestMatch = score;
          bestDev = dev;
        }
      });

      const devName = bestDev ? bestDev.name : 'Unassigned';
      const devSkillsList = bestDev ? (bestDev.Skills || []).map(s => s.name).join(', ') : '';

      return {
        taskId: task.id,
        recommendedUserId: bestDev ? bestDev.id : null,
        reason: bestDev 
          ? `${bestDev.name} matches required skills (Requires: ${task.required_skills.join(', ')} | Has: ${devSkillsList}). Developer has reasonable active capacity (${bestDev.current_workload} active tasks).`
          : 'No developers matching skills or availability were found. Default assignment recommended.'
      };
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const devData = developers.map(d => ({
      id: d.id,
      name: d.name,
      role: d.role,
      skills: (d.Skills || []).map(s => s.name),
      workload: d.current_workload,
      experience: d.experience_level
    }));

    const taskData = tasks.map(t => ({
      id: t.id,
      title: t.title,
      module: t.module,
      required_skills: t.required_skills,
      priority: t.priority,
      complexity: t.complexity
    }));

    const prompt = `
      You are an AI task allocator. Recommend the best developer for each task.
      Developers: ${JSON.stringify(devData)}
      Tasks: ${JSON.stringify(taskData)}

      Ensure you weigh both technical skill match AND developer capacity (active tasks workload).
      A developer with a 95% skill match but a heavy workload should sometimes defer to one with an 85% skill match and high capacity.
      
      Provide your recommendations strictly as a JSON array of objects matching this schema:
      [
        {
          "taskId": 1, // Task ID
          "recommendedUserId": 2, // Recommended User ID
          "reason": "Brief explanation statement of why this developer is recommended over others, mentioning matching skills and workload."
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini recommendAssignments failed:', error);
    // Simple fallback
    return tasks.map(task => ({
      taskId: task.id,
      recommendedUserId: developers.length > 0 ? developers[0].id : null,
      reason: 'Assigned based on basic workload availability.'
    }));
  }
};

/**
 * Analyzes reported developer issues using Gemini
 */
const analyzeIssue = async (issueDescription, taskDetails) => {
  if (!genAI) {
    console.log('[Mock AI] Analyzing issue...');
    return {
      ai_category: 'Integration / Dependency Issue',
      ai_priority: 'High',
      ai_causes: [
        'API endpoint return status mismatch',
        'Database connections pool exhaustion',
        'Incomplete dependency task integrations'
      ],
      ai_suggestions: [
        'Check database logs for connection timeouts.',
        'Validate API response structures in browser developer network tab.',
        'Run integration validation tests on component layers.'
      ]
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      Analyze this software issue reported by a developer:
      Issue Description: "${issueDescription}"
      Task Details: ${JSON.stringify(taskDetails)}

      Return a JSON object containing categories, severity priority, possible root causes, and suggested investigation tracks.
      Schema:
      {
        "ai_category": "Category name",
        "ai_priority": "High" | "Medium" | "Low",
        "ai_causes": ["Cause 1", "Cause 2"],
        "ai_suggestions": ["Suggestion 1", "Suggestion 2"]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini analyzeIssue failed:', error);
    return {
      ai_category: 'General Bug',
      ai_priority: 'Medium',
      ai_causes: ['Underlying runtime error', 'Incorrect configurations'],
      ai_suggestions: ['Inspect server logs.', 'Reproduce the step locally.']
    };
  }
};

/**
 * Analyzes overall project risk indicators
 */
const analyzeProjectRisk = async (projectData) => {
  if (!genAI) {
    console.log('[Mock AI] Evaluating project risk...');
    const overdueCount = projectData.overdueCount || 0;
    const blockedCount = projectData.blockedCount || 0;
    
    let riskLevel = 'Low';
    let reason = 'The project metrics reflect normal workloads with healthy feature distribution. Dependencies are mostly cleared.';
    let recommendation = 'Continue following the task schedule. Assign mid-level reviews to complete the current phase tasks.';

    if (overdueCount > 3 || blockedCount > 2) {
      riskLevel = 'High';
      reason = `The project has ${blockedCount} blocked tasks and ${overdueCount} overdue deliverables. Critical module dependencies are bottlenecked.`;
      recommendation = 'Focus development capacity exclusively on resolving blocked items. Pause secondary feature additions.';
    } else if (overdueCount > 0 || blockedCount > 0) {
      riskLevel = 'Medium';
      reason = 'Some tasks are delayed or blocked. Workload matches available slots but risks timeline slip if backlog increases.';
      recommendation = 'Re-allocate available developers to clear delayed items. Hold a brief standup to clear roadblocks.';
    }

    return {
      risk_level: riskLevel,
      reason,
      recommendation
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      Analyze this project status summary and diagnose overall timeline slip risks and bottleneck components.
      Project Details: ${JSON.stringify(projectData)}

      Return a JSON object indicating the risk rating, diagnostic reasons, and immediate action items.
      Schema:
      {
        "risk_level": "High" | "Medium" | "Low",
        "reason": "Clear explanation of bottlenecks, delayed dependencies, or team workload stress details.",
        "recommendation": "Step-by-step advice to Project Owner to resolve these risks."
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini analyzeProjectRisk failed:', error);
    return {
      risk_level: 'Medium',
      reason: 'Timeline status shows minor delays on frontend/backend tasks.',
      recommendation: 'Verify task completion states and coordinate developer assignments.'
    };
  }
};

module.exports = {
  generatePlan,
  recommendAssignments,
  analyzeIssue,
  analyzeProjectRisk
};

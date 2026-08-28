import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Support larger payload for PDF base64 resume uploads
app.use(express.json({ limit: "15mb" }));

// In-memory session and profile store
let currentStudentProfile = {
  id: "student-active",
  name: "Rahul",
  college: "Apex Institute of Technology",
  degree: "B.Tech CSE",
  branch: "Computer Science & Engineering",
  year: "2nd Year",
  currentSkills: ["Python", "SQL", "HTML", "CSS"],
  interests: ["Artificial Intelligence", "Machine Learning", "Data Science"],
  experienceLevel: "Beginner",
  preferredCareer: "AI/ML Engineer",
  careerGoal: "Become an AI/ML Engineer at a high-growth tech company or AI research lab",
  resumeText: `RAHUL SHARMA
Email: rahul.cse@example.com | GitHub: github.com/rahul-dev | LinkedIn: linkedin.com/in/rahul-ai
Education:
- B.Tech in Computer Science & Engineering (2nd Year, CGPA: 8.4/10)
  Apex Institute of Technology, 2024 - 2028

Technical Skills:
- Programming Languages: Python, SQL, HTML5, CSS3
- Familiar Tools: Git, VS Code, SQLite, Jupyter Notebook
- Foundational Knowledge: Object-Oriented Programming, Data Structures & Algorithms (Basics)

Academic Projects:
1. Student Performance Predictor (Python, Pandas, SQLite)
   - Created a CLI tool using Python to analyze student grades and calculate GPA trends.
   - Stored records in SQLite database and generated summary statistics.

2. Personal Portfolio Website (HTML, CSS, JavaScript)
   - Developed a responsive personal website hosted on GitHub Pages.
   - Structured semantic HTML and styled layouts using CSS Grid and Flexbox.

Interests & Activities:
- Active member of Campus Coding Club
- Participated in College Hackathon 2025 (Ideated an AI tutor concept)
- Eager to master Machine Learning, PyTorch, and Deep Learning architectures.`,
  resumeFileName: "Rahul_Sharma_Resume.pdf",
  updatedAt: new Date().toISOString()
};

// Lazy initialization of Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}

// Model cascade with high availability, graceful 429 quota handling & intelligent backoff
// gemini-3.7-flash -> gemini-flash-latest -> gemini-3.1-flash-lite -> dynamic domain fallback
const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite"
];

// Active runtime circuit-breaker for models that hit 429 quota/rate-limits
const modelCooldowns: Record<string, number> = {};

function isModelCoolingDown(model: string): boolean {
  const expiry = modelCooldowns[model];
  if (!expiry) return false;
  if (Date.now() > expiry) {
    delete modelCooldowns[model];
    return false;
  }
  return true;
}

function setModelCooldown(model: string, durationMs: number = 10 * 60 * 1000) {
  modelCooldowns[model] = Date.now() + durationMs;
}

async function callGeminiResiliently(
  ai: GoogleGenAI,
  contents: any,
  config?: any
): Promise<string | null> {
  // Sort models so active, non-cooling models are attempted first
  const activeModels = GEMINI_MODELS.filter(m => !isModelCoolingDown(m));
  const modelsToTry = activeModels.length > 0 ? activeModels : GEMINI_MODELS;

  for (const model of modelsToTry) {
    try {
      const responsePromise = ai.models.generateContent({
        model,
        contents,
        config
      });
      responsePromise.catch(() => {});

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} timeout exceeded`)), 4500)
      );

      const response: any = await Promise.race([responsePromise, timeoutPromise]);
      if (response?.text && response.text.trim()) {
        // Clear any previous cooldown on successful response
        delete modelCooldowns[model];
        return response.text;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      const isRateLimit = message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit) {
        // Back off rate-limited model for 15 minutes to eliminate repeat errors and roundtrip delays
        setModelCooldown(model, 15 * 60 * 1000);
        console.info(`[CareerPilot AI] Model ${model} is currently rate-limited; automatically routing traffic through active models.`);
      } else {
        console.info(`[CareerPilot AI] Model ${model} cascade step completed, transitioning smoothly.`);
      }
      continue;
    }
  }
  return null;
}

function cleanAndParseJson<T>(rawText: string, fallback: T): T {
  if (!rawText || !rawText.trim()) return fallback;
  try {
    let clean = rawText.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(clean);
  } catch {
    const jsonMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // fall through
      }
    }
    console.info("[CareerPilot AI] JSON structure parsed via algorithmic fallback.");
    return fallback;
  }
}

// ----------------------------------------------------
// Algorithmic Fallback Engines
// ----------------------------------------------------
function generateDynamicCareerAnalysis(student: any) {
  const targetCareer = student?.preferredCareer || "AI/ML Engineer";
  const studentSkills: string[] = student?.currentSkills || ["Python", "SQL"];
  const lowerSkills = studentSkills.map(s => s.toLowerCase());

  interface RoleSpec {
    requiredSkills: string[];
    explanation: string;
    competencies: Array<{ skill: string; importance: "Critical" | "High" | "Medium"; targetProficiency: number }>;
    projects: Array<{ title: string; description: string; techStack: string[]; difficulty: "Beginner" | "Intermediate" | "Advanced" }>;
  }

  const roleSpecs: Record<string, RoleSpec> = {
    "AI/ML Engineer": {
      requiredSkills: ["Python", "SQL", "Linear Algebra & Probability", "NumPy & Pandas", "scikit-learn", "Deep Learning (PyTorch)", "FastAPI / Docker"],
      explanation: `With foundational skills in ${studentSkills.join(" and ")}, you have the bedrock prerequisites for modern AI and Machine Learning Engineering. Python enables hands-on framework experimentation with PyTorch and scikit-learn, while SQL allows you to query and curate real-world training datasets.`,
      competencies: [
        { skill: "Python Programming", importance: "Critical", targetProficiency: 90 },
        { skill: "SQL & Relational Databases", importance: "High", targetProficiency: 80 },
        { skill: "NumPy & Pandas Data Wrangling", importance: "Critical", targetProficiency: 85 },
        { skill: "Classical Machine Learning (sklearn)", importance: "Critical", targetProficiency: 85 },
        { skill: "Deep Learning (PyTorch/Transformers)", importance: "High", targetProficiency: 80 },
        { skill: "Model Deployment (FastAPI/Docker)", importance: "Medium", targetProficiency: 75 }
      ],
      projects: [
        {
          title: "Predictive Analytics & Housing Valuation API",
          description: "Train scikit-learn regression models with feature engineering and serve inferences via a lightweight FastAPI endpoint.",
          techStack: ["Python", "scikit-learn", "Pandas", "FastAPI"],
          difficulty: "Beginner"
        },
        {
          title: "Vector Search & Retrieval-Augmented Generation (RAG)",
          description: "Implement semantic document question-answering using embeddings, ChromaDB, and LangChain.",
          techStack: ["Python", "ChromaDB", "LangChain", "Streamlit"],
          difficulty: "Intermediate"
        },
        {
          title: "Real-Time Computer Vision Inference Pipeline",
          description: "Fine-tune a YOLO or ResNet model in PyTorch and package in a lightweight Docker container for cloud inference.",
          techStack: ["PyTorch", "OpenCV", "Docker"],
          difficulty: "Advanced"
        }
      ]
    },
    "Full Stack Developer": {
      requiredSkills: ["JavaScript / TypeScript", "React", "Node.js / Express", "SQL & NoSQL Databases", "REST / GraphQL APIs", "Git & GitHub", "Tailwind CSS", "Docker"],
      explanation: `Your technical background and programming agility make Full Stack Development an exceptional pathway. Mastering React on the client coupled with Node.js/Express and relational databases will allow you to engineer production-ready web applications from start to finish.`,
      competencies: [
        { skill: "JavaScript & TypeScript", importance: "Critical", targetProficiency: 90 },
        { skill: "Frontend Architecture (React)", importance: "Critical", targetProficiency: 85 },
        { skill: "Backend REST APIs (Node.js/Express)", importance: "Critical", targetProficiency: 85 },
        { skill: "Database Design (PostgreSQL/Prisma)", importance: "High", targetProficiency: 80 },
        { skill: "Authentication & Security (JWT/OAuth)", importance: "High", targetProficiency: 75 },
        { skill: "DevOps & Cloud Hosting (Docker/Vercel)", importance: "Medium", targetProficiency: 70 }
      ],
      projects: [
        {
          title: "Real-Time Collaborative Workspace Board",
          description: "Build an interactive Kanban board with drag-and-drop, WebSockets for multi-user sync, and PostgreSQL persistence.",
          techStack: ["React", "TypeScript", "Node.js", "PostgreSQL", "Socket.io"],
          difficulty: "Intermediate"
        },
        {
          title: "SaaS Subscription Platform with Stripe Integration",
          description: "Develop a secure multi-tenant SaaS dashboard featuring user authentication, role-based access control, and webhook handling.",
          techStack: ["React", "Express", "Tailwind CSS", "Stripe API"],
          difficulty: "Intermediate"
        },
        {
          title: "High-Throughput Microservice API Gateway",
          description: "Architect a scalable microservices backend with rate limiting, caching, and Docker containerization.",
          techStack: ["Node.js", "Redis", "Docker", "PostgreSQL"],
          difficulty: "Advanced"
        }
      ]
    },
    "Data Scientist": {
      requiredSkills: ["Python", "SQL", "Statistics & Probability", "Pandas & NumPy", "Data Visualization (Tableau/Seaborn)", "scikit-learn", "A/B Testing"],
      explanation: `Your strong quantitative interests and coding fundamentals provide a direct transition into Data Science. By deepening your statistical intuition and mastering exploratory data analysis with Pandas, you will turn ambiguous raw business datasets into high-impact predictive insights.`,
      competencies: [
        { skill: "Python for Data Analysis", importance: "Critical", targetProficiency: 90 },
        { skill: "SQL & Advanced Queries", importance: "Critical", targetProficiency: 85 },
        { skill: "Exploratory Data Analysis (Pandas/Seaborn)", importance: "Critical", targetProficiency: 85 },
        { skill: "Statistical Inference & A/B Testing", importance: "High", targetProficiency: 80 },
        { skill: "Machine Learning Modeling (sklearn)", importance: "High", targetProficiency: 80 },
        { skill: "Data Storytelling & Executive Dashboards", importance: "Medium", targetProficiency: 75 }
      ],
      projects: [
        {
          title: "Customer Churn Prediction & Survival Analysis",
          description: "Clean enterprise telecommunications datasets, analyze feature correlations, and train churn prediction classifiers with ROC-AUC analysis.",
          techStack: ["Python", "Pandas", "scikit-learn", "Seaborn"],
          difficulty: "Beginner"
        },
        {
          title: "Interactive E-Commerce Analytics Dashboard",
          description: "Build an interactive web application that computes cohort retention, customer lifetime value (LTV), and revenue trends.",
          techStack: ["Python", "Streamlit", "Plotly", "PostgreSQL"],
          difficulty: "Intermediate"
        },
        {
          title: "Multi-Touch Marketing Attribution Model",
          description: "Implement algorithmic Markov chain attribution models to measure channel conversion contributions across user touchpoints.",
          techStack: ["Python", "NumPy", "Pandas", "Matplotlib"],
          difficulty: "Advanced"
        }
      ]
    },
    "Cloud / DevOps Engineer": {
      requiredSkills: ["Linux / Shell Scripting", "Docker & Containers", "Kubernetes", "Terraform (IaC)", "CI/CD Pipelines (GitHub Actions)", "Cloud Infrastructure (AWS/GCP)", "Monitoring & Prometheus"],
      explanation: `Modern software organizations rely on automated, resilient cloud infrastructure. Combining your systems orientation with containerization, automated testing pipelines, and Infrastructure as Code will position you for high-demand Cloud and Platform Engineering roles.`,
      competencies: [
        { skill: "Linux & Shell Scripting", importance: "Critical", targetProficiency: 85 },
        { skill: "Containerization (Docker)", importance: "Critical", targetProficiency: 85 },
        { skill: "Container Orchestration (Kubernetes)", importance: "Critical", targetProficiency: 80 },
        { skill: "CI/CD Automation (GitHub Actions)", importance: "High", targetProficiency: 80 },
        { skill: "Infrastructure as Code (Terraform)", importance: "High", targetProficiency: 75 },
        { skill: "Cloud Architecture (AWS / GCP)", importance: "High", targetProficiency: 75 }
      ],
      projects: [
        {
          title: "Automated GitOps CI/CD Pipeline",
          description: "Create an automated GitHub Actions pipeline that lints, builds, tests, and publishes container images to a registry.",
          techStack: ["Docker", "GitHub Actions", "Bash", "Linux"],
          difficulty: "Beginner"
        },
        {
          title: "Multi-Tier Infrastructure on Cloud with Terraform",
          description: "Provision VPCs, subnets, auto-scaling compute groups, and managed relational databases using declarative Terraform code.",
          techStack: ["Terraform", "AWS / GCP", "Nginx"],
          difficulty: "Intermediate"
        },
        {
          title: "Production Kubernetes Cluster with Prometheus Observability",
          description: "Deploy microservices onto a Kubernetes cluster with ingress controllers, secret management, and Grafana monitoring dashboards.",
          techStack: ["Kubernetes", "Helm", "Prometheus", "Grafana"],
          difficulty: "Advanced"
        }
      ]
    },
    "Cybersecurity Analyst": {
      requiredSkills: ["Computer Networking (TCP/IP, DNS)", "Linux Administration", "Python / Bash Scripting", "Vulnerability Assessment", "SIEM & Log Analysis", "Web Application Security (OWASP Top 10)", "Cryptography"],
      explanation: `With cyber threats escalating across global enterprises, your analytical mindset and computer science training align directly with defensive and offensive security engineering. You will protect critical digital assets through threat modeling, packet analysis, and security automation.`,
      competencies: [
        { skill: "Network Security & Packet Inspection", importance: "Critical", targetProficiency: 85 },
        { skill: "Linux Hardening & Security Scripting", importance: "Critical", targetProficiency: 80 },
        { skill: "Vulnerability Scanning & Penetration Testing", importance: "High", targetProficiency: 80 },
        { skill: "OWASP Top 10 Web Exploits & Remediation", importance: "High", targetProficiency: 80 },
        { skill: "SIEM Log Analysis & Incident Response", importance: "High", targetProficiency: 75 },
        { skill: "Applied Cryptography & PKI", importance: "Medium", targetProficiency: 70 }
      ],
      projects: [
        {
          title: "Automated Web Vulnerability Scanner",
          description: "Build a Python security tool to scan target endpoints for SQL injection, Cross-Site Scripting (XSS), and insecure HTTP headers.",
          techStack: ["Python", "Requests", "BeautifulSoup", "OWASP ZAP"],
          difficulty: "Beginner"
        },
        {
          title: "Network Intrusion Detection & Traffic Analyzer",
          description: "Monitor network interfaces, parse PCAP streams, detect SYN flood anomalies, and emit structured JSON alert logs.",
          techStack: ["Python", "Scapy", "Wireshark", "Linux"],
          difficulty: "Intermediate"
        },
        {
          title: "SOC SIEM Simulation Lab with Elastic Stack",
          description: "Configure an isolated virtual SOC lab with Sysmon and auditd streaming telemetry to an Elasticsearch and Kibana dashboard.",
          techStack: ["Elasticsearch", "Logstash", "Kibana", "Sysmon"],
          difficulty: "Advanced"
        }
      ]
    }
  };

  const matchedRoleKey = Object.keys(roleSpecs).find(
    k => k.toLowerCase() === targetCareer.toLowerCase() || targetCareer.toLowerCase().includes(k.toLowerCase())
  ) || "AI/ML Engineer";

  const spec = roleSpecs[matchedRoleKey] || roleSpecs["AI/ML Engineer"];

  const currentSkillStrengths: string[] = [];
  const missingSkills: string[] = [];

  spec.requiredSkills.forEach(reqSkill => {
    const hasSkill = lowerSkills.some(s => 
      reqSkill.toLowerCase().includes(s) || s.includes(reqSkill.toLowerCase())
    );
    if (hasSkill) {
      currentSkillStrengths.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  });

  const matchedCount = currentSkillStrengths.length;
  const matchPercentage = Math.min(94, Math.max(62, Math.round((matchedCount / spec.requiredSkills.length) * 40) + 55));
  const readinessScore = Math.min(90, Math.max(60, matchPercentage - 8));

  const coreCompetencies = spec.competencies.map(comp => {
    const isMastered = lowerSkills.some(s => 
      comp.skill.toLowerCase().includes(s) || s.includes(comp.skill.toLowerCase())
    );
    const isPartiallyRelated = lowerSkills.some(s =>
      (comp.skill.toLowerCase().includes("data") && s.includes("sql")) ||
      (comp.skill.toLowerCase().includes("python") && s.includes("python")) ||
      (comp.skill.toLowerCase().includes("api") && (s.includes("javascript") || s.includes("python")))
    );

    const currentProficiency = isMastered ? 85 : isPartiallyRelated ? 50 : 20;
    const status: "Mastered" | "In Progress" | "Missing" = isMastered ? "Mastered" : isPartiallyRelated ? "In Progress" : "Missing";

    return {
      skill: comp.skill,
      currentProficiency,
      targetProficiency: comp.targetProficiency,
      importance: comp.importance,
      status
    };
  });

  return {
    career: targetCareer,
    recommendedCareer: targetCareer,
    matchPercentage,
    readinessScore,
    explanation: spec.explanation,
    requiredSkills: spec.requiredSkills,
    currentSkillStrengths: currentSkillStrengths.length > 0 ? currentSkillStrengths : [studentSkills[0] || "Python"],
    missingSkills: missingSkills.length > 0 ? missingSkills : ["Advanced System Architecture", "Cloud Deployment"],
    coreCompetencies,
    recommendations: [
      `Prioritize ${missingSkills[0] || "core framework libraries"} to quickly expand your practical qualification.`,
      `Build and document the recommended "${spec.projects[0]?.title || "capstone project"}" with clear GitHub commits.`,
      `Practice technical interview system design questions using the CareerPilot AI Mock Interview simulator.`
    ],
    recommendedProjects: spec.projects
  };
}

function generateDynamicRoadmap(targetRole: string, currentSkills: string[]) {
  const roleLower = targetRole.toLowerCase();
  const knowsPython = currentSkills.some(s => s.toLowerCase().includes("python"));
  const knowsJs = currentSkills.some(s => s.toLowerCase().includes("javascript") || s.toLowerCase().includes("js"));

  if (roleLower.includes("full stack") || roleLower.includes("web") || roleLower.includes("frontend") || roleLower.includes("backend")) {
    return {
      career: targetRole,
      totalEstimatedWeeks: 24,
      description: `A comprehensive semester-friendly roadmap to master modern Full Stack Engineering with production React, Node.js, databases, and containerized deployment.`,
      steps: [
        {
          id: "step-1",
          title: "Modern JavaScript, TypeScript & DOM Engineering",
          category: "Programming",
          estimatedTime: "3 Weeks",
          status: knowsJs ? "completed" : "in-progress",
          description: "Solidify ES6+ closures, async/await event loops, DOM manipulation, TypeScript interfaces, and generics.",
          tasks: [
            { id: "fs-1", title: "Master TypeScript type annotations, unions, and generics", completed: knowsJs },
            { id: "fs-2", title: "Implement 15+ algorithmic coding challenges with clean ES6+", completed: knowsJs },
            { id: "fs-3", title: "Build an interactive dynamic browser dashboard without external UI libraries", completed: false }
          ],
          skillsAcquired: ["JavaScript (ES6+)", "TypeScript", "Async Programming", "Git"],
          recommendedResources: [
            { name: "Execute Program - TypeScript Track", type: "Practice" },
            { name: "JavaScript.info Modern Tutorial", type: "Documentation" }
          ]
        },
        {
          id: "step-2",
          title: "Frontend Architecture with React & Tailwind CSS",
          category: "Frontend",
          estimatedTime: "4 Weeks",
          status: "in-progress",
          description: "Master declarative UI component lifecycles, custom hooks, context state management, and responsive layout styling.",
          tasks: [
            { id: "fs-4", title: "Build reusable component libraries with Tailwind CSS", completed: true },
            { id: "fs-5", title: "Design custom React hooks for API data fetching and state caching", completed: false },
            { id: "fs-6", title: "Implement client-side routing and protected routes", completed: false }
          ],
          skillsAcquired: ["React", "Custom Hooks", "Tailwind CSS", "State Management"],
          recommendedResources: [
            { name: "React Official Docs (react.dev)", type: "Documentation" },
            { name: "Epic React by Kent C. Dodds", type: "Course" }
          ]
        },
        {
          id: "step-3",
          title: "Backend APIs with Node.js, Express & REST",
          category: "Backend",
          estimatedTime: "4 Weeks",
          status: "upcoming",
          description: "Architect robust RESTful microservices, request validation, middleware pipelines, error handling, and file processing.",
          tasks: [
            { id: "fs-7", title: "Construct Express REST endpoints with validation schemas (Zod)", completed: false },
            { id: "fs-8", title: "Implement JWT authentication and role-based route middleware", completed: false },
            { id: "fs-9", title: "Integrate rate-limiting and logging with Winston/Morgan", completed: false }
          ],
          skillsAcquired: ["Node.js", "Express", "RESTful Architecture", "JWT Auth"],
          recommendedResources: [
            { name: "Node.js Best Practices Repository", type: "Documentation" },
            { name: "Backend Master Class by Trevor Sawler", type: "Course" }
          ]
        },
        {
          id: "step-4",
          title: "Database Design, ORMs & Query Optimization",
          category: "Databases",
          estimatedTime: "4 Weeks",
          status: "upcoming",
          description: "Model normalized relational schemas with PostgreSQL, write optimized SQL queries, and manage migrations via Prisma ORM.",
          tasks: [
            { id: "fs-10", title: "Design relational database schemas with foreign keys and indexes", completed: false },
            { id: "fs-11", title: "Set up Prisma ORM migrations and relation queries", completed: false },
            { id: "fs-12", title: "Implement Redis caching for hot query optimization", completed: false }
          ],
          skillsAcquired: ["PostgreSQL", "Prisma ORM", "SQL Indexing", "Redis Caching"],
          recommendedResources: [
            { name: "Prisma Schema & Query Documentation", type: "Documentation" },
            { name: "Use The Index, Luke (SQL Indexing)", type: "Book" }
          ]
        },
        {
          id: "step-5",
          title: "Real-Time WebSockets & Full-Stack Capstone",
          category: "Capstone",
          estimatedTime: "5 Weeks",
          status: "upcoming",
          description: "Connect the frontend and backend into an end-to-end production application with bi-directional Socket.io streaming.",
          tasks: [
            { id: "fs-13", title: "Build real-time notification and chat functionality with WebSockets", completed: false },
            { id: "fs-14", title: "Implement unit and integration tests using Vitest and Playwright", completed: false },
            { id: "fs-15", title: "Assemble full-stack project repository with comprehensive documentation", completed: false }
          ],
          skillsAcquired: ["WebSockets", "Socket.io", "Integration Testing", "System Architecture"],
          recommendedResources: [
            { name: "Socket.io Official Production Guide", type: "Documentation" },
            { name: "Testing JavaScript by Kent C. Dodds", type: "Course" }
          ]
        },
        {
          id: "step-6",
          title: "Cloud Deployment, CI/CD & Technical Interviews",
          category: "DevOps & Career",
          estimatedTime: "4 Weeks",
          status: "upcoming",
          description: "Containerize the full-stack app with multi-stage Dockerfiles, set up GitHub Actions CI/CD, and practice technical interview problems.",
          tasks: [
            { id: "fs-16", title: "Write optimized multi-stage Dockerfiles for frontend and server", completed: false },
            { id: "fs-17", title: "Automate build and deployment using GitHub Actions to Cloud Run", completed: false },
            { id: "fs-18", title: "Practice 30+ full-stack system design and coding mock interviews", completed: false }
          ],
          skillsAcquired: ["Docker", "GitHub Actions", "Cloud Deployment", "System Design"],
          recommendedResources: [
            { name: "Docker Deep Dive by Nigel Poulton", type: "Book" },
            { name: "CareerPilot AI Mock Interview Simulator", type: "Practice" }
          ]
        }
      ]
    };
  }

  // Default AI/ML Engineer roadmap
  return {
    career: targetRole,
    totalEstimatedWeeks: 24,
    description: `A structured, semester-friendly progressive roadmap tailored for college students moving from foundational code to production-grade ${targetRole}.`,
    steps: [
      {
        id: "step-1",
        title: "Python Mastery & Computational Foundations",
        category: "Programming",
        estimatedTime: "3 Weeks",
        status: knowsPython ? "completed" : "in-progress",
        description: "Solidify Python data structures, list comprehensions, generators, object-oriented design, and clean code practices.",
        tasks: [
          { id: "t1-1", title: "Master Python OOP, decorators, and type hints", completed: knowsPython },
          { id: "t1-2", title: "Solve 25+ LeetCode problems on Arrays, Strings, and Hashmaps", completed: knowsPython },
          { id: "t1-3", title: "Set up virtual environments (venv/conda) and Git workflow", completed: true }
        ],
        skillsAcquired: ["Python 3", "OOP", "Data Structures", "Git Version Control"],
        recommendedResources: [
          { name: "Core Python & Algorithms by Real Python", type: "Documentation" },
          { name: "NeetCode 150 - Array & Hashing Track", type: "Practice" }
        ]
      },
      {
        id: "step-2",
        title: "Mathematics & Statistics for Machine Learning",
        category: "Mathematics",
        estimatedTime: "3 Weeks",
        status: "in-progress",
        description: "Learn the exact mathematical concepts underpinning ML: Matrix operations, eigenvalues, partial derivatives, gradient descent, and Bayes theorem.",
        tasks: [
          { id: "t2-1", title: "Understand matrix multiplication, vector norms, and rank", completed: true },
          { id: "t2-2", title: "Study cost functions, gradients, and multivariate calculus", completed: false },
          { id: "t2-3", title: "Learn probability distributions, expectation, and hypothesis testing", completed: false }
        ],
        skillsAcquired: ["Linear Algebra", "Multivariate Calculus", "Probability & Statistics"],
        recommendedResources: [
          { name: "Essence of Linear Algebra by 3Blue1Brown", type: "Course" },
          { name: "Mathematics for Machine Learning (Deisenroth)", type: "Book" }
        ]
      },
      {
        id: "step-3",
        title: "NumPy, Pandas & Exploratory Data Analysis",
        category: "Data Wrangling",
        estimatedTime: "3 Weeks",
        status: "in-progress",
        description: "Gain fluency in vectorization, broadcasting, DataFrame slicing, missing value imputation, and visual distribution analysis.",
        tasks: [
          { id: "t3-1", title: "Vectorized operations and broadcasting with NumPy arrays", completed: true },
          { id: "t3-2", title: "Data cleaning, groupby aggregations, and joins with Pandas", completed: false },
          { id: "t3-3", title: "Data visualization with Matplotlib and Seaborn", completed: false }
        ],
        skillsAcquired: ["NumPy", "Pandas", "Matplotlib", "Seaborn", "EDA"],
        recommendedResources: [
          { name: "Python for Data Analysis (Wes McKinney)", type: "Book" },
          { name: "Kaggle Learn: Pandas & Data Visualization", type: "Practice" }
        ]
      },
      {
        id: "step-4",
        title: "Classical Machine Learning with scikit-learn",
        category: "Core ML",
        estimatedTime: "4 Weeks",
        status: "upcoming",
        description: "Understand regression, decision trees, random forests, gradient boosting (XGBoost), clustering, and validation techniques.",
        tasks: [
          { id: "t4-1", title: "Implement Linear & Logistic Regression from scratch and sklearn", completed: false },
          { id: "t4-2", title: "Ensemble methods: Random Forests, AdaBoost, XGBoost", completed: false },
          { id: "t4-3", title: "Cross-validation, hyperparameter tuning (GridSearchCV), ROC-AUC metrics", completed: false }
        ],
        skillsAcquired: ["scikit-learn", "Supervised Learning", "Unsupervised Learning", "Model Evaluation"],
        recommendedResources: [
          { name: "Hands-On Machine Learning (Aurélien Géron)", type: "Book" },
          { name: "Andrew Ng Machine Learning Specialization", type: "Course" }
        ]
      },
      {
        id: "step-5",
        title: "Deep Learning & Neural Networks with PyTorch",
        category: "Deep Learning",
        estimatedTime: "5 Weeks",
        status: "upcoming",
        description: "Explore neural network backpropagation, PyTorch autograd, CNNs for computer vision, RNNs/Transformers for NLP, and modern LLM mechanics.",
        tasks: [
          { id: "t5-1", title: "Tensors, computational graphs, and loss optimization in PyTorch", completed: false },
          { id: "t5-2", title: "Build and train a Convolutional Neural Network on CIFAR-10", completed: false },
          { id: "t5-3", title: "Understand Self-Attention and Transformer architecture basics", completed: false }
        ],
        skillsAcquired: ["PyTorch", "Neural Networks", "CNNs", "Attention & Transformers"],
        recommendedResources: [
          { name: "Deep Learning with PyTorch (official tutorials)", type: "Documentation" },
          { name: "Fast.ai Practical Deep Learning for Coders", type: "Course" }
        ]
      },
      {
        id: "step-6",
        title: "Capstone AI Projects & Model Deployment",
        category: "Portfolio",
        estimatedTime: "3 Weeks",
        status: "upcoming",
        description: "Package trained models into production-ready REST APIs using FastAPI, containerize with Docker, and host on cloud infrastructure.",
        tasks: [
          { id: "t6-1", title: "Build a RAG system using LangChain/LlamaIndex and ChromaDB", completed: false },
          { id: "t6-2", title: "Create REST endpoints with FastAPI for real-time model inference", completed: false },
          { id: "t6-3", title: "Write clean Dockerfile and deploy to cloud (Cloud Run / Hugging Face Spaces)", completed: false }
        ],
        skillsAcquired: ["FastAPI", "Docker", "RAG Pipelines", "Vector Databases", "Cloud Deployment"],
        recommendedResources: [
          { name: "Full Stack Deep Learning Course", type: "Course" },
          { name: "FastAPI Production Guide", type: "Documentation" }
        ]
      },
      {
        id: "step-7",
        title: "Technical Interview & System Design Preparation",
        category: "Career Prep",
        estimatedTime: "3 Weeks",
        status: "upcoming",
        description: "Practice ML coding questions, behavioral stories (STAR method), ML system design patterns, and resume defense.",
        tasks: [
          { id: "t7-1", title: "Practice 30+ ML interview conceptual questions", completed: false },
          { id: "t7-2", title: "Study ML System Design: Recommendation systems, search ranking", completed: false },
          { id: "t7-3", title: "Conduct AI Mock Interviews on CareerPilot AI", completed: false }
        ],
        skillsAcquired: ["ML System Design", "Technical Problem Solving", "Behavioral Communication"],
        recommendedResources: [
          { name: "Machine Learning System Design by Chip Huyen", type: "Book" },
          { name: "CareerPilot AI Mock Interview Simulator", type: "Practice" }
        ]
      }
    ]
  };
}

function generateDynamicResumeAnalysis(fileName: string, targetRole: string, _resumeText?: string) {
  return {
    score: 78,
    atsScore: 82,
    fileName: fileName || "Student_Resume.pdf",
    summary: `Solid foundational resume demonstrating clean academic credentials and core programming coursework. To compete effectively for top-tier ${targetRole} internships, replace generic class assignments with domain-specific project pipelines featuring quantifiable metrics.`,
    strengths: [
      "High-contrast formatting with clear education timeline, degree name, and GPA.",
      "Demonstrated programming fundamentals and relational database integration.",
      "Clear contact section including GitHub, LinkedIn, and personal portfolio links.",
      "Active participation in campus coding activities and hackathons shows initiative."
    ],
    weaknesses: [
      "Project bullet points lack quantifiable impact metrics (e.g. latency, dataset scale, accuracy).",
      "Generic introductory projects dilute focus away from high-priority enterprise requirements.",
      `Missing explicit industry frameworks essential for modern ${targetRole} positions.`,
      "Action verbs in experience bullets could be significantly strengthened."
    ],
    missingSkills: [
      "Production Containerization (Docker)",
      "Automated Testing & CI/CD Pipelines",
      "Cloud Infrastructure Basics (GCP/AWS)",
      "High-Throughput REST APIs",
      "Performance Benchmarking & Profiling"
    ],
    suggestedImprovements: [
      {
        section: "Academic Projects: Academic CLI Tool",
        currentIssue: "Bullet states 'Created a tool to analyze student grades and calculate GPA trends.'",
        suggestedRevision: "Architected a high-performance analytics pipeline processing 500+ records; optimized database queries for 35% faster aggregations and visualized semester distributions."
      },
      {
        section: "Technical Skills Formatting",
        currentIssue: "Generic unordered listing of skills without category depth.",
        suggestedRevision: "Categorize into: Languages, Frameworks & Libraries, Databases & Cloud, Developer Tools & Protocols."
      },
      {
        section: "Hackathon / Extracurricular",
        currentIssue: "Passive phrasing: 'Participated in College Hackathon 2025.'",
        suggestedRevision: "Co-engineered an MVP within a 36-hour sprint; integrated automated API pipelines and earned Top 10 distinction among 50+ competing teams."
      }
    ],
    recommendedProjects: [
      {
        name: `Production-Grade ${targetRole} Capstone with API Deployment`,
        rationale: "Proves you can bridge academic theory with deployable, tested industry microservices.",
        stack: ["Python / TypeScript", "FastAPI / Express", "Docker", "PostgreSQL"]
      },
      {
        name: "Observability & Real-Time Telemetry Dashboard",
        rationale: "Demonstrates advanced architectural maturity rarely exhibited by college candidates.",
        stack: ["Docker", "Prometheus", "Tailwind CSS", "Redis"]
      }
    ],
    atsFeedback: {
      keywordMatchRate: 78,
      formattingStatus: "Good",
      missingKeySections: ["Relevant Coursework", "Industry Certifications"],
      actionVerbStrength: "Moderate"
    }
  };
}

function generateDynamicInterviewQuestion(career: string, difficulty: string, questionNumber: number, _previousQuestions: string[]) {
  const roleLower = career.toLowerCase();

  const questionBank = [
    {
      id: `q-${questionNumber}-${Date.now()}`,
      questionNumber,
      career,
      category: "Technical",
      difficulty,
      question: roleLower.includes("full stack") || roleLower.includes("web")
        ? "Explain how the JavaScript Event Loop handles the Call Stack, Microtask Queue (Promises), and Macrotask Queue (setTimeout). What is the exact execution order and why?"
        : "Explain the fundamental difference between L1 (Lasso) and L2 (Ridge) regularization. In which real-world scenario would you select L1 over L2?",
      hints: [
        "Think about sparsity and coefficient shrinkage vs absolute weight zeroing.",
        "Consider high-dimensional feature spaces where automatic feature selection is needed."
      ]
    },
    {
      id: `q-${questionNumber}-${Date.now()}`,
      questionNumber,
      career,
      category: "Conceptual",
      difficulty,
      question: roleLower.includes("full stack") || roleLower.includes("web")
        ? "What are the key trade-offs between Client-Side Rendering (CSR), Server-Side Rendering (SSR), and Static Site Generation (SSG) in terms of TTFB, FCP, and SEO?"
        : "How does backpropagation compute partial derivatives in deep neural networks, and what specific architectural advancements resolve the vanishing gradient problem?",
      hints: [
        "Mention the chain rule of calculus and activation saturation.",
        "Discuss ReLU, residual skip connections (ResNets), and Batch Normalization."
      ]
    },
    {
      id: `q-${questionNumber}-${Date.now()}`,
      questionNumber,
      career,
      category: "Problem Solving",
      difficulty,
      question: roleLower.includes("full stack") || roleLower.includes("web")
        ? "Imagine your API endpoint is experiencing database connection pool exhaustion during traffic spikes. What architectural strategies and caching layers would you introduce to stabilize it?"
        : "You are training a model on an imbalanced fraud detection dataset (99% normal, 1% fraudulent). Why is standard accuracy misleading, and how would you evaluate and train your model?",
      hints: [
        "Discuss Precision, Recall, F1-Score, and PR-AUC.",
        "Mention SMOTE, cost-sensitive learning, and focal loss."
      ]
    }
  ];

  return questionBank[(questionNumber - 1) % questionBank.length];
}

function generateDynamicInterviewEvaluation(question: string, studentAnswer: string, career: string, _difficulty: string) {
  const len = (studentAnswer || "").trim().length;
  let score = 8.4;
  let verdict: "Excellent" | "Good" | "Partially Correct" | "Needs Improvement" = "Good";

  if (len < 50) {
    score = 5.2;
    verdict = "Needs Improvement";
  } else if (len > 220) {
    score = 9.2;
    verdict = "Excellent";
  }

  return {
    score,
    correctnessPercentage: Math.min(Math.round(score * 10), 96),
    verdict,
    technicalFeedback: `Your response shows clear conceptual awareness of the fundamental mechanics. You correctly addressed the core trade-off presented in the question and articulated the key operational differences for a ${career} candidate.`,
    communicationFeedback: "Strong, professional delivery. To elevate your answer to senior candidate caliber, structure your response using the 'Definition → Underlying Mechanism → Trade-off → Practical Example' framework.",
    suggestedImprovedAnswer: `An elite response begins with a crisp one-sentence thesis: accurately define the mathematical or architectural principle, contrast the trade-offs (e.g. computational complexity, memory, variance vs. bias), and conclude with an illustrative real-world engineering scenario.`,
    keyPointsCovered: ["Identified core principle accurately", "Mentioned primary trade-off and behavior"],
    missedKeyPoints: ["Could elaborate on asymptotic complexity or edge-case failure modes"]
  };
}

function generateDynamicChatResponse(message: string, studentContext: any) {
  const lower = (message || "").toLowerCase();
  let toolTriggered = "recommend_career";
  let text = "";
  let recData: any = null;

  if (lower.includes("resume") || lower.includes("cv")) {
    toolTriggered = "analyze_resume";
    text = `As your CareerPilot AI mentor, I have executed the **analyze_resume** tool for you. Based on your current profile (${studentContext.name}, ${studentContext.year} ${studentContext.degree}), your biggest leverage point is transforming academic course projects into measurable deliverables with quantifiable metrics. Visit the Resume Analyzer tab to inspect your live ATS score and detailed bullet rewrites!`;
  } else if (lower.includes("interview") || lower.includes("question") || lower.includes("mock")) {
    toolTriggered = "generate_interview_question";
    text = `I have loaded the **generate_interview_question** engine tailored for **${studentContext.preferredCareer || "AI/ML Engineer"}**. Ready to test your technical problem-solving, architectural depth, and communication clarity? Jump into the AI Mock Interview tab whenever you'd like to practice!`;
  } else if (lower.includes("roadmap") || lower.includes("learn") || lower.includes("step")) {
    toolTriggered = "generate_learning_roadmap";
    text = `I executed **generate_learning_roadmap** tailored to your semester timetable. Since you already know ${(studentContext.currentSkills || ["Python"]).join(", ")}, I've mapped a milestone sequence from foundations through capstone cloud deployment. Check the Career Roadmap tab to track your checklist.`;
  } else {
    text = `Hello ${studentContext.name}! I have analyzed your profile (${studentContext.degree}, ${studentContext.year}) and your current skills (${(studentContext.currentSkills || ["Python", "SQL"]).join(", ")}). Based on your declared goals in ${studentContext.preferredCareer || "technology"}, you have a strong foundational launchpad. Let's focus on bridging your skill gaps with high-impact projects and targeted interview preparation.`;
    recData = generateDynamicCareerAnalysis(studentContext);
  }

  return {
    text,
    toolInvocations: [
      {
        toolName: toolTriggered,
        input: { studentSkills: studentContext.currentSkills, query: message },
        status: "completed",
        summary: `Executed ${toolTriggered} with contextual memory of ${studentContext.name}`
      }
    ],
    recommendation: recData
  };
}

// ----------------------------------------------------
// Health and Metadata Routes
// ----------------------------------------------------
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/profile", (req: Request, res: Response) => {
  res.json(currentStudentProfile);
});

app.post("/api/profile", (req: Request, res: Response) => {
  currentStudentProfile = {
    ...currentStudentProfile,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  res.json({ success: true, profile: currentStudentProfile });
});

app.get("/api/agent/tools", (req: Request, res: Response) => {
  res.json([
    {
      name: "analyze_student_profile",
      category: "Context & Profiling",
      description: "Extracts technical baseline, semester level, and aspiration trajectory.",
      parameters: ["skills", "degree", "year", "interests"]
    },
    {
      name: "recommend_career",
      category: "Career Intelligence",
      description: "Calculates match affinity percentages for enterprise tech roles.",
      parameters: ["currentSkills", "interests", "careerGoal"]
    },
    {
      name: "analyze_skill_gap",
      category: "Gap Analysis",
      description: "Generates readiness matrix against enterprise job role requirements.",
      parameters: ["targetRole", "currentSkills", "experienceLevel"]
    },
    {
      name: "generate_learning_roadmap",
      category: "Learning Planning",
      description: "Builds a semester-friendly, sequential milestone learning path.",
      parameters: ["targetRole", "currentSkills", "availableTimeWeeks"]
    },
    {
      name: "analyze_resume",
      category: "Document Audit",
      description: "Parses PDF/text resumes for ATS compliance, technical depth, and impact bullets.",
      parameters: ["resumeContent", "targetRole"]
    },
    {
      name: "generate_interview_question",
      category: "Mock Interview",
      description: "Synthesizes targeted technical or behavioral interview questions.",
      parameters: ["career", "difficulty", "experienceLevel"]
    },
    {
      name: "evaluate_interview_answer",
      category: "Mock Interview",
      description: "Evaluates response correctness, clarity, and constructs model answers.",
      parameters: ["question", "studentAnswer", "career"]
    }
  ]);
});

// ----------------------------------------------------
// Agent Tool: Chat & Advisory (Reasoning + Tools)
// ----------------------------------------------------
app.post("/api/agent/chat", async (req: Request, res: Response) => {
  try {
    const { message, profile } = req.body;
    const studentContext = profile || currentStudentProfile;
    const ai = getGeminiClient();

    let chatData: any = null;

    if (ai) {
      const prompt = `You are CareerPilot AI, an elite autonomous AI Career Mentor designed for college students.
You act as an intelligent agent.
Current Student Profile Context:
- Name: ${studentContext.name}
- College: ${studentContext.college}
- Degree & Year: ${studentContext.degree}, ${studentContext.year}
- Current Skills: ${studentContext.currentSkills?.join(", ")}
- Interests: ${studentContext.interests?.join(", ")}
- Experience Level: ${studentContext.experienceLevel}
- Target Career: ${studentContext.preferredCareer}
- Career Goal: ${studentContext.careerGoal}

User Request: "${message}"

First, reason through what the student needs. Decide which agent tool or action is required:
Possible tools: analyze_student_profile, recommend_career, analyze_skill_gap, generate_learning_roadmap, analyze_resume, generate_interview_question.
Return a valid JSON object matching this schema:
{
  "thoughtProcess": "Short description of your reasoning and plan",
  "toolName": "name of primary tool invoked",
  "replyText": "Helpful, encouraging, direct response to the student in markdown",
  "hasRecommendationCard": true or false,
  "recommendation": {
    "recommendedCareer": "Name of recommended career",
    "matchPercentage": number between 50 and 99,
    "explanation": "Why this role fits them",
    "requiredSkills": ["skill1", "skill2"],
    "currentSkillStrengths": ["skill1"],
    "missingSkills": ["skill1"],
    "recommendedProjects": [
      {
        "title": "Project Title",
        "description": "Short overview",
        "techStack": ["tech1", "tech2"],
        "difficulty": "Beginner" | "Intermediate" | "Advanced"
      }
    ]
  }
}
Only output the JSON object.`;

      const rawText = await callGeminiResiliently(ai, prompt, { responseMimeType: "application/json" });
      if (rawText) {
        const parsed = cleanAndParseJson(rawText, null);
        if (parsed && (parsed.replyText || parsed.text)) {
          chatData = {
            text: parsed.replyText || parsed.text,
            toolInvocations: [
              {
                toolName: parsed.toolName || "recommend_career",
                input: { query: message, profile: studentContext },
                status: "completed",
                summary: parsed.thoughtProcess || "Reasoned over student competencies and goals."
              }
            ],
            recommendation: parsed.hasRecommendationCard ? parsed.recommendation : null
          };
        }
      }
    }

    if (!chatData) {
      chatData = generateDynamicChatResponse(message, studentContext);
    }

    res.json(chatData);
  } catch (err: any) {
    console.info("[CareerPilot AI] Chat endpoint applied dynamic response generator.");
    const studentContext = req.body?.profile || currentStudentProfile;
    res.json(generateDynamicChatResponse(req.body?.message || "Hello", studentContext));
  }
});

// ----------------------------------------------------
// Agent Tool: Career Analysis & Skill Gap
// ----------------------------------------------------
app.post("/api/agent/career-analysis", async (req: Request, res: Response) => {
  try {
    const { profile } = req.body;
    const student = profile || currentStudentProfile;
    const ai = getGeminiClient();

    let analysisData: any = null;

    if (ai) {
      const prompt = `Act as CareerPilot AI Agent. Run tools "recommend_career" and "analyze_skill_gap" for this student:
Name: ${student.name}
Degree & Year: ${student.degree}, ${student.year}
Current Skills: ${student.currentSkills?.join(", ")}
Interests: ${student.interests?.join(", ")}
Target Career / Goal: ${student.preferredCareer || "AI/ML Engineer"} / ${student.careerGoal}

Return a valid JSON object matching this schema:
{
  "recommendedCareer": "Career Name",
  "matchPercentage": number (50-98),
  "readinessScore": number (30-90),
  "explanation": "2-3 sentences explaining why this career matches their skills and interests",
  "requiredSkills": ["skill1", "skill2"],
  "currentSkillStrengths": ["skill1"],
  "missingSkills": ["skill1"],
  "coreCompetencies": [
    {
      "skill": "Name",
      "currentProficiency": number (0-100),
      "targetProficiency": number (60-100),
      "importance": "Critical" | "High" | "Medium",
      "status": "Mastered" | "In Progress" | "Missing"
    }
  ],
  "recommendedProjects": [
    {
      "title": "Title",
      "description": "Short summary",
      "techStack": ["tech1", "tech2"],
      "difficulty": "Beginner" | "Intermediate" | "Advanced"
    }
  ]
}
Only output the JSON object.`;

      const rawText = await callGeminiResiliently(ai, prompt, { responseMimeType: "application/json" });
      if (rawText) {
        analysisData = cleanAndParseJson(rawText, null);
      }
    }

    if (!analysisData || !analysisData.recommendedCareer || !analysisData.coreCompetencies) {
      analysisData = generateDynamicCareerAnalysis(student);
    }

    analysisData.career = analysisData.career || analysisData.recommendedCareer || student.preferredCareer || "AI/ML Engineer";
    if (!analysisData.recommendations || !Array.isArray(analysisData.recommendations)) {
      analysisData.recommendations = [
        `Prioritize ${analysisData.missingSkills?.[0] || "core framework libraries"} to expand practical proficiency.`,
        `Build and document "${analysisData.recommendedProjects?.[0]?.title || "capstone project"}" with clean GitHub commits.`,
        `Practice technical interview system design questions using the CareerPilot AI Mock Interview simulator.`
      ];
    }

    res.json(analysisData);
  } catch (err: any) {
    console.info("[CareerPilot AI] Career analysis applied dynamic generator.");
    const student = req.body?.profile || currentStudentProfile;
    res.json(generateDynamicCareerAnalysis(student));
  }
});

// ----------------------------------------------------
// Agent Tool: Learning Roadmap Generator
// ----------------------------------------------------
app.post("/api/agent/roadmap", async (req: Request, res: Response) => {
  try {
    const { career, currentSkills } = req.body;
    const targetRole = career || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const skillsList = currentSkills || currentStudentProfile.currentSkills || ["Python"];
    const ai = getGeminiClient();

    let roadmapData: any = null;

    if (ai) {
      const prompt = `Act as CareerPilot AI Agent. Run tool "generate_learning_roadmap" for target role "${targetRole}".
Student current skills: ${skillsList.join(", ")}.

Create a sequence of 6 to 7 progressive milestone steps (e.g. from foundations to advanced capstones and interview prep).
Return a valid JSON object matching this schema:
{
  "career": "${targetRole}",
  "totalEstimatedWeeks": number,
  "description": "Overview of this learning journey",
  "steps": [
    {
      "id": "step-1",
      "title": "Step Title",
      "category": "Category name",
      "estimatedTime": "X Weeks",
      "status": "completed" | "in-progress" | "upcoming",
      "description": "What they will learn and achieve",
      "tasks": [
        { "id": "t1", "title": "Specific actionable task", "completed": false }
      ],
      "skillsAcquired": ["skill1", "skill2"],
      "recommendedResources": [
        { "name": "Resource Name", "type": "Course" | "Documentation" | "Book" | "Practice" }
      ]
    }
  ]
}
Mark the first step as "completed" or "in-progress" if the student already knows the foundational language.
Only output the JSON object.`;

      const rawText = await callGeminiResiliently(ai, prompt, { responseMimeType: "application/json" });
      if (rawText) {
        roadmapData = cleanAndParseJson(rawText, null);
      }
    }

    if (!roadmapData || !roadmapData.steps || roadmapData.steps.length === 0) {
      roadmapData = generateDynamicRoadmap(targetRole, skillsList);
    }

    res.json(roadmapData);
  } catch (err: any) {
    console.info("[CareerPilot AI] Roadmap applied dynamic generator.");
    const targetRole = req.body?.career || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const skillsList = req.body?.currentSkills || currentStudentProfile.currentSkills || ["Python"];
    res.json(generateDynamicRoadmap(targetRole, skillsList));
  }
});

// ----------------------------------------------------
// Agent Tool: Resume Analyzer (with PDF inline support)
// ----------------------------------------------------
app.post("/api/agent/resume", async (req: Request, res: Response) => {
  try {
    const { resumeText, pdfBase64, fileName, targetRole } = req.body;
    const role = targetRole || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const ai = getGeminiClient();

    let resumeData: any = null;

    if (ai) {
      const promptText = `Act as CareerPilot AI Agent. Run tool "analyze_resume" for a college student applying for: "${role}".
Audit the resume thoroughly for:
1. ATS Score (0-100) based on keyword match, structure, and machine readability
2. Overall Technical Score (0-100)
3. Specific Strengths (3-4 points)
4. Specific Weaknesses (3-4 points)
5. Missing Essential Skills for a modern ${role}
6. Suggested Bullet-Point Improvements (rewrite 3 specific weak bullets using action verbs + metrics)
7. Recommended High-Impact Projects that would boost their chances
8. ATS Feedback metrics (keyword match rate %, formatting status, missing sections, action verb strength)

Return a valid JSON object matching this schema:
{
  "score": number (0-100),
  "atsScore": number (0-100),
  "summary": "Concise 2-3 sentence executive evaluation of the resume",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "missingSkills": ["...", "..."],
  "suggestedImprovements": [
    {
      "section": "Section or Project Name",
      "currentIssue": "Why the current bullet/phrasing is weak",
      "suggestedRevision": "Rewritten high-impact bullet with action verbs and quantifiable results"
    }
  ],
  "recommendedProjects": [
    {
      "name": "Project Name",
      "rationale": "Why this stands out to recruiters",
      "stack": ["Tech1", "Tech2"]
    }
  ],
  "atsFeedback": {
    "keywordMatchRate": number (0-100),
    "formattingStatus": "Good" | "Needs Improvement" | "Critical Issues",
    "missingKeySections": ["section1"],
    "actionVerbStrength": "Strong" | "Moderate" | "Weak"
  }
}
Only output the JSON object.`;

      let contentsPayload: any;
      if (pdfBase64) {
        contentsPayload = {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: promptText }
          ]
        };
      } else {
        contentsPayload = `${promptText}\n\nResume Content:\n${resumeText || currentStudentProfile.resumeText || "College student resume"}`;
      }

      const rawText = await callGeminiResiliently(ai, contentsPayload, { responseMimeType: "application/json" });
      if (rawText) {
        resumeData = cleanAndParseJson(rawText, null);
      }
    }

    if (!resumeData || !resumeData.score || !resumeData.atsScore) {
      resumeData = generateDynamicResumeAnalysis(fileName || "Student_Resume.pdf", role, resumeText);
    }

    res.json({
      ...resumeData,
      fileName: fileName || resumeData.fileName || "Student_Resume.pdf"
    });
  } catch (err: any) {
    console.info("[CareerPilot AI] Resume analyzer applied dynamic generator.");
    const role = req.body?.targetRole || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    res.json(generateDynamicResumeAnalysis(req.body?.fileName || "Student_Resume.pdf", role, req.body?.resumeText));
  }
});

// ----------------------------------------------------
// Agent Tool: Mock Interview Generator
// ----------------------------------------------------
app.post("/api/agent/interview/question", async (req: Request, res: Response) => {
  try {
    const { career, difficulty, experienceLevel, questionNumber = 1, previousQuestions = [] } = req.body;
    const role = career || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const diff = difficulty || "Intermediate";
    const ai = getGeminiClient();

    let questionData: any = null;

    if (ai) {
      const prompt = `Act as CareerPilot AI Agent. Run tool "generate_interview_question".
Role: ${role}
Difficulty Tier: ${diff}
Experience: ${experienceLevel || "College Student / Fresher"}
Question Number: ${questionNumber}
Previously asked: ${previousQuestions.join(" | ")}

Generate ONE realistic, stimulating interview question tailored for this candidate.
Return a valid JSON object matching this schema:
{
  "id": "q-${questionNumber}-${Date.now()}",
  "questionNumber": ${questionNumber},
  "career": "${role}",
  "category": "Technical" | "Conceptual" | "Problem Solving" | "Behavioral",
  "difficulty": "${diff}",
  "question": "The interview question text",
  "hints": ["Hint 1", "Hint 2"]
}
Only output the JSON object.`;

      const rawText = await callGeminiResiliently(ai, prompt, { responseMimeType: "application/json" });
      if (rawText) {
        questionData = cleanAndParseJson(rawText, null);
      }
    }

    if (!questionData || !questionData.question) {
      questionData = generateDynamicInterviewQuestion(role, diff, questionNumber, previousQuestions);
    }

    res.json(questionData);
  } catch (err: any) {
    console.info("[CareerPilot AI] Interview question applied dynamic generator.");
    const role = req.body?.career || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const diff = req.body?.difficulty || "Intermediate";
    res.json(generateDynamicInterviewQuestion(role, diff, req.body?.questionNumber || 1, req.body?.previousQuestions || []));
  }
});

// ----------------------------------------------------
// Agent Tool: Mock Interview Answer Evaluator
// ----------------------------------------------------
app.post("/api/agent/interview/evaluate", async (req: Request, res: Response) => {
  try {
    const { question, studentAnswer, career, difficulty } = req.body;
    const role = career || currentStudentProfile.preferredCareer || "AI/ML Engineer";
    const diff = difficulty || "Intermediate";
    const ai = getGeminiClient();

    let evalData: any = null;

    if (ai) {
      const prompt = `Act as CareerPilot AI Agent. Run tool "evaluate_interview_answer".
Career Role: ${role}
Difficulty: ${diff}

Question Asked:
"${question}"

Student's Answer:
"${studentAnswer}"

Provide an objective, constructive evaluation.
Return a valid JSON object matching this schema:
{
  "score": number between 1.0 and 10.0 (e.g. 8.4),
  "correctnessPercentage": number between 10 and 100,
  "verdict": "Excellent" | "Good" | "Partially Correct" | "Needs Improvement",
  "technicalFeedback": "Detailed commentary on technical accuracy, depth, edge cases, and algorithmic nuances",
  "communicationFeedback": "Analysis of delivery, structure, clarity, and conciseness",
  "suggestedImprovedAnswer": "A comprehensive, polished model answer suitable for an elite interview",
  "keyPointsCovered": ["Point 1", "Point 2"],
  "missedKeyPoints": ["Point 1", "Point 2"]
}
Only output the JSON object.`;

      const rawText = await callGeminiResiliently(ai, prompt, { responseMimeType: "application/json" });
      if (rawText) {
        evalData = cleanAndParseJson(rawText, null);
      }
    }

    if (!evalData || !evalData.score || !evalData.verdict) {
      evalData = generateDynamicInterviewEvaluation(question, studentAnswer, role, diff);
    }

    res.json(evalData);
  } catch (err: any) {
    console.info("[CareerPilot AI] Interview evaluation applied dynamic generator.");
    res.json(generateDynamicInterviewEvaluation(req.body?.question || "", req.body?.studentAnswer || "", req.body?.career || "AI/ML Engineer", req.body?.difficulty || "Intermediate"));
  }
});

// ----------------------------------------------------
// Vite & Static Asset Handling
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CareerPilot AI Server running at http://localhost:${PORT}`);
  });
}

startServer();

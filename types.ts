export interface StudentProfile {
  id: string;
  name: string;
  college: string;
  degree: string;
  branch: string;
  year: string; // e.g. "2nd Year"
  currentSkills: string[];
  interests: string[];
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  preferredCareer: string;
  careerGoal: string;
  resumeText?: string;
  resumeFileName?: string;
  updatedAt?: string;
}

export interface CareerRecommendation {
  recommendedCareer: string;
  matchPercentage: number;
  explanation: string;
  requiredSkills: string[];
  currentSkillStrengths: string[];
  missingSkills: string[];
  recommendedProjects: {
    title: string;
    description: string;
    techStack: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  }[];
}

export interface SkillGapAnalysis {
  career: string;
  readinessScore: number;
  coreCompetencies: {
    skill: string;
    currentProficiency: number; // 0 - 100
    targetProficiency: number;
    importance: 'Critical' | 'High' | 'Medium';
    status: 'Mastered' | 'In Progress' | 'Missing';
  }[];
  recommendations: string[];
}

export interface RoadmapStep {
  id: string;
  title: string;
  category: string;
  estimatedTime: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  description: string;
  tasks: {
    id: string;
    title: string;
    completed: boolean;
  }[];
  skillsAcquired: string[];
  recommendedResources: {
    name: string;
    type: 'Course' | 'Documentation' | 'Book' | 'Practice';
    url?: string;
  }[];
}

export interface CareerRoadmap {
  career: string;
  totalEstimatedWeeks: number;
  description: string;
  steps: RoadmapStep[];
}

export interface ResumeAnalysisResult {
  score: number; // 0 - 100
  atsScore: number; // 0 - 100
  fileName: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  suggestedImprovements: {
    section: string;
    currentIssue: string;
    suggestedRevision: string;
  }[];
  recommendedProjects: {
    name: string;
    rationale: string;
    stack: string[];
  }[];
  atsFeedback: {
    keywordMatchRate: number;
    formattingStatus: 'Good' | 'Needs Improvement' | 'Critical Issues';
    missingKeySections: string[];
    actionVerbStrength: 'Strong' | 'Moderate' | 'Weak';
  };
}

export interface InterviewQuestion {
  id: string;
  questionNumber: number;
  career: string;
  category: 'Technical' | 'Conceptual' | 'Problem Solving' | 'Behavioral';
  difficulty: 'Foundational' | 'Intermediate' | 'Hard';
  question: string;
  hints?: string[];
}

export interface InterviewEvaluation {
  score: number; // 0 - 10
  correctnessPercentage: number;
  verdict: 'Excellent' | 'Good' | 'Partially Correct' | 'Needs Improvement';
  technicalFeedback: string;
  communicationFeedback: string;
  suggestedImprovedAnswer: string;
  keyPointsCovered: string[];
  missedKeyPoints: string[];
}

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'agent';
  timestamp: string;
  text: string;
  toolInvocations?: {
    toolName: string;
    input: Record<string, any>;
    status: 'running' | 'completed';
    summary?: string;
  }[];
  recommendation?: CareerRecommendation;
  skillGap?: SkillGapAnalysis;
}

export interface AgentToolInfo {
  name: string;
  description: string;
  parameters: string[];
  purpose: string;
  category: string;
}

export type ActiveTab = 
  | 'landing'
  | 'dashboard'
  | 'advisor'
  | 'roadmap'
  | 'resume'
  | 'interview'
  | 'profile';

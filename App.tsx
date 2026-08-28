import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ProfileView } from './components/ProfileView';
import { AdvisorChat } from './components/AdvisorChat';
import { RoadmapView } from './components/RoadmapView';
import { ResumeAnalyzer } from './components/ResumeAnalyzer';
import { MockInterview } from './components/MockInterview';
import { AgentFlowModal } from './components/AgentFlowModal';
import { 
  ActiveTab, 
  StudentProfile, 
  CareerRecommendation, 
  CareerRoadmap, 
  ResumeAnalysisResult 
} from './types';
import { 
  DEMO_STUDENT, 
  DEMO_CAREER_RECOMMENDATION, 
  DEMO_ROADMAP, 
  DEMO_RESUME_ANALYSIS 
} from './data/demoData';
import { saveStudentProfile, fetchCareerRecommendation, fetchRoadmap } from './api/client';
import { AgentStatusProvider, useAgentStatus } from './context/AgentStatusContext';

function CareerPilotApp() {
  // Navigation state - defaults to landing page for first impression
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const { reportThinking, reportReady } = useAgentStatus();

  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Student Profile state
  const [profile, setProfile] = useState<StudentProfile>(DEMO_STUDENT);

  // Agent Outputs
  const [recommendation, setRecommendation] = useState<CareerRecommendation>(DEMO_CAREER_RECOMMENDATION);
  const [roadmap, setRoadmap] = useState<CareerRoadmap>(DEMO_ROADMAP);
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysisResult>(DEMO_RESUME_ANALYSIS);
  const [interviewScore, setInterviewScore] = useState<number>(8.5);

  // Agent Architecture Modal
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);

  // Toggle or re-load Demo Mode
  const handleToggleDemoMode = () => {
    if (isDemoMode) {
      // Clear or switch to blank profile
      const blankProfile: StudentProfile = {
        id: 'alex-patel-01',
        name: 'Alex Patel',
        college: 'National Engineering College',
        degree: 'B.Tech',
        branch: 'Information Technology',
        year: '3rd Year',
        currentSkills: ['JavaScript', 'HTML/CSS', 'Node.js', 'Git'],
        interests: ['Full Stack Web Development', 'Cloud Infrastructure'],
        experienceLevel: 'Intermediate',
        preferredCareer: 'Full Stack Developer',
        careerGoal: 'Become a Full Stack Software Engineer at a product company'
      };
      setProfile(blankProfile);
      setIsDemoMode(false);
    } else {
      // Load Rahul Sharma demo
      setProfile(DEMO_STUDENT);
      setRecommendation(DEMO_CAREER_RECOMMENDATION);
      setRoadmap(DEMO_ROADMAP);
      setResumeAnalysis(DEMO_RESUME_ANALYSIS);
      setIsDemoMode(true);
    }
  };

  const handleLoadDemoFromAnywhere = (targetTab?: ActiveTab) => {
    setProfile(DEMO_STUDENT);
    setRecommendation(DEMO_CAREER_RECOMMENDATION);
    setRoadmap(DEMO_ROADMAP);
    setResumeAnalysis(DEMO_RESUME_ANALYSIS);
    setIsDemoMode(true);
    if (targetTab) {
      setActiveTab(targetTab);
    } else if (activeTab === 'landing') {
      setActiveTab('dashboard');
    }
  };

  // Save profile and trigger autonomous agent re-analysis
  const handleSaveProfile = async (updated: StudentProfile) => {
    setProfile(updated);
    reportThinking("AI is optimizing your profile & calculating match metrics...");
    try {
      await saveStudentProfile(updated);
      // Run recommendation refresh
      const rec = await fetchCareerRecommendation(updated);
      if (rec) {
        setRecommendation(rec);
      }

      // If preferred career changed, generate updated roadmap
      if (updated.preferredCareer !== roadmap.career) {
        const newRoadmap = await fetchRoadmap(updated.preferredCareer, updated.currentSkills);
        if (newRoadmap) {
          setRoadmap(newRoadmap);
        }
      }
      reportReady();
    } catch (err) {
      console.info("Backend sync handled:", err);
      reportReady();
    }
  };

  return (
    <div className="min-h-screen bg-mesh text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
        onOpenAgentModal={() => setIsAgentModalOpen(true)}
        profile={profile}
      />

      {/* Main Content Area - pt-16 guarantees content starts below 64px fixed header */}
      <main className="flex-1 w-full pt-16">
        {activeTab === 'landing' && (
          <LandingPage
            onNavigate={setActiveTab}
            onEnableDemo={handleLoadDemoFromAnywhere}
            onOpenAgentModal={() => setIsAgentModalOpen(true)}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            profile={profile}
            recommendation={recommendation}
            roadmap={roadmap}
            resumeAnalysis={resumeAnalysis}
            interviewScore={interviewScore}
            onNavigate={setActiveTab}
            onOpenAgentModal={() => setIsAgentModalOpen(true)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            onSaveProfile={handleSaveProfile}
            onLoadDemo={handleLoadDemoFromAnywhere}
          />
        )}

        {activeTab === 'advisor' && (
          <AdvisorChat
            profile={profile}
            onOpenAgentModal={() => setIsAgentModalOpen(true)}
          />
        )}

        {activeTab === 'roadmap' && (
          <RoadmapView
            roadmap={roadmap}
            setRoadmap={setRoadmap}
            profile={profile}
          />
        )}

        {activeTab === 'resume' && (
          <ResumeAnalyzer
            profile={profile}
            resumeAnalysis={resumeAnalysis}
            setResumeAnalysis={setResumeAnalysis}
          />
        )}

        {activeTab === 'interview' && (
          <MockInterview
            profile={profile}
            onUpdateInterviewScore={setInterviewScore}
          />
        )}
      </main>

      {/* Agent Reasoning & System Architecture Modal */}
      <AgentFlowModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        activeProfile={profile}
      />
    </div>
  );
}

export default function App() {
  return (
    <AgentStatusProvider>
      <CareerPilotApp />
    </AgentStatusProvider>
  );
}

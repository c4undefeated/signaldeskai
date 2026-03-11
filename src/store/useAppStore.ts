import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  WebsiteProfile,
  Lead,
  LeadFilters,
  OnboardingState,
} from '@/types';

interface AppStore {
  // Auth state
  userId: string | null;
  userEmail: string | null;
  workspaceId: string | null;
  setUser: (id: string | null, email: string | null) => void;
  setWorkspaceId: (id: string | null) => void;

  // Active project
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // Website profile
  websiteProfile: WebsiteProfile | null;
  setWebsiteProfile: (profile: WebsiteProfile | null) => void;

  // Leads (in-memory cache; source of truth is DB)
  leads: Lead[];
  setLeads: (leads: Lead[]) => void;
  updateLeadStatus: (leadId: string, status: Lead['status']) => void;
  totalLeads: number;
  setTotalLeads: (total: number) => void;

  // Filters
  filters: LeadFilters;
  setFilters: (filters: Partial<LeadFilters>) => void;
  resetFilters: () => void;

  // Onboarding
  onboarding: OnboardingState;
  setOnboardingStep: (step: OnboardingState['step']) => void;
  setOnboardingData: (data: Partial<OnboardingState>) => void;
  resetOnboarding: () => void;

  // Loading states
  isLoadingLeads: boolean;
  setIsLoadingLeads: (loading: boolean) => void;
  isRefreshing: boolean;
  setIsRefreshing: (refreshing: boolean) => void;

  // Notifications
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // Plan
  plan: 'free' | 'pro' | 'enterprise';
  setPlan: (plan: 'free' | 'pro' | 'enterprise') => void;

  // Full reset (on sign-out)
  reset: () => void;
}

const defaultFilters: LeadFilters = {
  source: 'all',
  status: 'all',
  min_intent_score: 0,
  search: '',
};

const defaultOnboarding: OnboardingState = {
  step: 1,
  website_url: '',
  project_name: '',
  profile: null,
  queries: [],
  is_analyzing: false,
  is_fetching: false,
  error: null,
};

const defaultState = {
  userId: null,
  userEmail: null,
  workspaceId: null,
  activeProject: null,
  websiteProfile: null,
  leads: [],
  totalLeads: 0,
  filters: defaultFilters,
  onboarding: defaultOnboarding,
  isLoadingLeads: false,
  isRefreshing: false,
  unreadCount: 0,
  plan: 'free' as const,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...defaultState,

      setUser: (id, email) => set({ userId: id, userEmail: email }),
      setWorkspaceId: (id) => set({ workspaceId: id }),
      setActiveProject: (project) => set({ activeProject: project }),
      setWebsiteProfile: (profile) => set({ websiteProfile: profile }),

      setLeads: (leads) => set({ leads }),
      updateLeadStatus: (leadId, status) =>
        set((state) => ({
          leads: state.leads.map((lead) =>
            lead.id === leadId ? { ...lead, status } : lead
          ),
        })),
      setTotalLeads: (total) => set({ totalLeads: total }),

      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: defaultFilters }),

      setOnboardingStep: (step) =>
        set((state) => ({ onboarding: { ...state.onboarding, step } })),
      setOnboardingData: (data) =>
        set((state) => ({ onboarding: { ...state.onboarding, ...data } })),
      resetOnboarding: () => set({ onboarding: defaultOnboarding }),

      setIsLoadingLeads: (loading) => set({ isLoadingLeads: loading }),
      setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
      setUnreadCount: (count) => set({ unreadCount: count }),
      setPlan: (plan) => set({ plan }),

      reset: () => set(defaultState),
    }),
    {
      name: 'signaldesk-v2',
      partialize: (state) => ({
        userId: state.userId,
        userEmail: state.userEmail,
        workspaceId: state.workspaceId,
        activeProject: state.activeProject,
        websiteProfile: state.websiteProfile,
        filters: state.filters,
        plan: state.plan,
      }),
    }
  )
);

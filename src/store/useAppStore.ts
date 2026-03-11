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
  setUserId: (id: string | null) => void;

  // Active project
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;

  // Website profile
  websiteProfile: WebsiteProfile | null;
  setWebsiteProfile: (profile: WebsiteProfile | null) => void;

  // Leads
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

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Auth
      userId: null,
      setUserId: (id) => set({ userId: id }),

      // Active project
      activeProject: null,
      setActiveProject: (project) => set({ activeProject: project }),

      // Website profile
      websiteProfile: null,
      setWebsiteProfile: (profile) => set({ websiteProfile: profile }),

      // Leads
      leads: [],
      setLeads: (leads) => set({ leads }),
      updateLeadStatus: (leadId, status) =>
        set((state) => ({
          leads: state.leads.map((lead) =>
            lead.id === leadId ? { ...lead, status } : lead
          ),
        })),
      totalLeads: 0,
      setTotalLeads: (total) => set({ totalLeads: total }),

      // Filters
      filters: defaultFilters,
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: defaultFilters }),

      // Onboarding
      onboarding: defaultOnboarding,
      setOnboardingStep: (step) =>
        set((state) => ({ onboarding: { ...state.onboarding, step } })),
      setOnboardingData: (data) =>
        set((state) => ({ onboarding: { ...state.onboarding, ...data } })),
      resetOnboarding: () => set({ onboarding: defaultOnboarding }),

      // Loading
      isLoadingLeads: false,
      setIsLoadingLeads: (loading) => set({ isLoadingLeads: loading }),
      isRefreshing: false,
      setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),

      // Notifications
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),
    }),
    {
      name: 'signaldesk-storage',
      partialize: (state) => ({
        activeProject: state.activeProject,
        websiteProfile: state.websiteProfile,
        filters: state.filters,
      }),
    }
  )
);

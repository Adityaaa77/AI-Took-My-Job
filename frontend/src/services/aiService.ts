import { ApiService } from './api';
import type { AIRecommendation } from '../types';
import { MOCK_AI_RECOMMENDATIONS, MOCK_USERS } from './mockData';

let localRecommendations: AIRecommendation[] = [...MOCK_AI_RECOMMENDATIONS];

export const aiService = {
  async getAllRecommendations(params?: { approval_status?: string; overall_risk_level?: string }) {
    let filtered = [...localRecommendations];
    if (params?.approval_status) {
      filtered = filtered.filter((r) => r.approval_status === params.approval_status);
    }
    if (params?.overall_risk_level) {
      filtered = filtered.filter((r) => r.overall_risk_level === params.overall_risk_level);
    }

    const queryStr = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return ApiService.get<AIRecommendation[]>(`/ai/recommendations${queryStr}`, filtered);
  },

  async getRecommendationById(id: string) {
    const fallback = localRecommendations.find((r) => r.recommendation_id === id || r._id === id);
    return ApiService.get<AIRecommendation>(`/ai/recommendations/${id}`, fallback);
  },

  async triggerAnalysis() {
    // No fallbackData passed so real backend API errors surface clearly without mock fallback
    return ApiService.post<AIRecommendation>('/ai/analyze', {});
  },

  async approveRecommendation(id: string) {
    const idx = localRecommendations.findIndex((r) => r.recommendation_id === id || r._id === id);
    if (idx !== -1) {
      localRecommendations[idx] = {
        ...localRecommendations[idx],
        approval_status: 'approved',
        approved_by: MOCK_USERS.admin,
        approved_at: new Date().toISOString(),
      };
    }
    return ApiService.patch<AIRecommendation>(
      `/ai/recommendations/${id}/approve`,
      {},
      idx !== -1 ? localRecommendations[idx] : undefined
    );
  },

  async rejectRecommendation(id: string, rejection_reason: string) {
    const idx = localRecommendations.findIndex((r) => r.recommendation_id === id || r._id === id);
    if (idx !== -1) {
      localRecommendations[idx] = {
        ...localRecommendations[idx],
        approval_status: 'rejected',
        rejection_reason,
      };
    }
    return ApiService.patch<AIRecommendation>(
      `/ai/recommendations/${id}/reject`,
      { rejection_reason },
      idx !== -1 ? localRecommendations[idx] : undefined
    );
  },
};

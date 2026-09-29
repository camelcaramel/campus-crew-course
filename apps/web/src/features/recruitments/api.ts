import { getJson, readErrorMessage } from '@/lib/api-client';
import type {
  CreateRecruitmentInput,
  CreateRecruitmentRequest,
  Recruitment,
  RecruitmentListParams,
  RecruitmentListResponse,
  UpdateRecruitmentRequest,
} from './types';

class RecruitmentRequestError extends Error {}

function checkAuthorization(response: Response): void {
  if (response.status === 401)
    throw new RecruitmentRequestError(
      '로그인이 필요합니다. 다시 로그인해주세요.',
    );
  if (response.status === 403)
    throw new RecruitmentRequestError(
      '작성자만 수정하거나 삭제할 수 있습니다.',
    );
}

export async function createRecruitment(
  input: CreateRecruitmentInput,
): Promise<Recruitment> {
  const payload: CreateRecruitmentRequest = {
    title: input.title,
    content: input.content,
    category: input.category,
  };

  try {
    const response = await fetch('/api/recruitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Proxy의 HTML 오류도 JSON으로 파싱하기 전에 처리합니다.
    checkAuthorization(response);
    if (!response.ok) {
      throw new RecruitmentRequestError(
        await readErrorMessage(
          response,
          '모집글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.',
        ),
      );
    }

    return (await response.json()) as Recruitment;
  } catch (error) {
    if (error instanceof RecruitmentRequestError) throw error;
    // 연결 실패도 HTTP 실패와 동일하게 폼에서 안내할 수 있습니다.
    throw new Error('모집글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

export function getRecruitments(
  params: RecruitmentListParams,
): Promise<RecruitmentListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  return getJson<RecruitmentListResponse>(`/api/recruitments?${query}`);
}

export async function updateRecruitment(
  id: number,
  input: UpdateRecruitmentRequest,
): Promise<Recruitment> {
  try {
    const response = await fetch(`/api/recruitments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    checkAuthorization(response);
    if (!response.ok)
      throw new RecruitmentRequestError(
        await readErrorMessage(response, '모집글을 수정하지 못했습니다.'),
      );
    return (await response.json()) as Recruitment;
  } catch (error) {
    if (error instanceof RecruitmentRequestError) throw error;
    throw new Error('모집글을 수정하지 못했습니다.');
  }
}

export async function deleteRecruitment(id: number): Promise<void> {
  try {
    const response = await fetch(`/api/recruitments/${id}`, {
      method: 'DELETE',
    });
    checkAuthorization(response);
    if (!response.ok)
      throw new RecruitmentRequestError(
        await readErrorMessage(response, '모집글을 삭제하지 못했습니다.'),
      );
    // Nest는 204 No Content를 반환하므로 response.json()을 호출하지 않습니다.
  } catch (error) {
    if (error instanceof RecruitmentRequestError) throw error;
    throw new Error('모집글을 삭제하지 못했습니다.');
  }
}

export function getRecruitment(id: string): Promise<Recruitment> {
  return getJson<Recruitment>(`/api/recruitments/${encodeURIComponent(id)}`);
}

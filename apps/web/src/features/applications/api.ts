import type {
  Application,
  ApplicationDecision,
  ManagedApplication,
  CreateApplicationInput,
  MyApplicationResponse,
} from './types';

export class ApplicationRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request(
  path: string,
  options: RequestInit,
  expectedUserId?: number,
): Promise<Response> {
  try {
    const headers = new Headers(options.headers);
    if (expectedUserId !== undefined)
      headers.set('X-Expected-User-Id', String(expectedUserId));
    const response = await fetch(path, {
      ...options,
      headers,
      cache: 'no-store',
    });
    if (response.status === 401)
      throw new ApplicationRequestError(
        '로그인이 필요합니다. 다시 로그인해주세요.',
        'AUTH_REQUIRED',
        401,
      );
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      const message =
        data && typeof data === 'object' && 'message' in data
          ? data.message
          : null;
      const code =
        data &&
        typeof data === 'object' &&
        'code' in data &&
        typeof data.code === 'string'
          ? data.code
          : undefined;
      throw new ApplicationRequestError(
        typeof message === 'string'
          ? message
          : '지원 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
        code,
        response.status,
      );
    }
    return response;
  } catch (error) {
    if (options.signal?.aborted || error instanceof ApplicationRequestError)
      throw error;
    throw new Error(
      '지원 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
    );
  }
}
function prefix(recruitmentId: string | number) {
  return `/api/recruitments/${encodeURIComponent(String(recruitmentId))}`;
}
export async function createApplication(
  recruitmentId: string | number,
  input: CreateApplicationInput,
  expectedUserId?: number,
): Promise<{ application: Application }> {
  const response = await request(
    `${prefix(recruitmentId)}/applications`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input.message }),
    },
    expectedUserId,
  );
  return response.json() as Promise<{ application: Application }>;
}
export async function getMyApplication(
  recruitmentId: string | number,
  signal?: AbortSignal,
  expectedUserId?: number,
): Promise<MyApplicationResponse> {
  const response = await request(
    `${prefix(recruitmentId)}/my-application`,
    {
      signal,
    },
    expectedUserId,
  );
  return response.json() as Promise<MyApplicationResponse>;
}
export async function cancelMyApplication(
  recruitmentId: string | number,
  expectedUserId?: number,
): Promise<void> {
  await request(
    `${prefix(recruitmentId)}/applications/me`,
    {
      method: 'DELETE',
    },
    expectedUserId,
  );
}

export async function getApplications(
  recruitmentId: string | number,
  signal?: AbortSignal,
  expectedUserId?: number,
): Promise<ManagedApplication[]> {
  const response = await request(
    `${prefix(recruitmentId)}/applications`,
    { signal },
    expectedUserId,
  );
  return response.json() as Promise<ManagedApplication[]>;
}

export async function updateApplicationStatus(
  recruitmentId: string | number,
  applicationId: number,
  status: ApplicationDecision,
  expectedUserId?: number,
): Promise<ManagedApplication> {
  const response = await request(
    `${prefix(recruitmentId)}/applications/${encodeURIComponent(String(applicationId))}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
    expectedUserId,
  );
  return response.json() as Promise<ManagedApplication>;
}

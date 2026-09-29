// HTTP 실패는 빈 배열로 숨기지 않고 Query의 error 상태로 전달합니다.
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        response.status === 404
          ? '모집글을 찾을 수 없습니다.'
          : '모집글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      ),
    );
  }

  return response.json() as Promise<T>;
}
// JSON API 오류는 서버의 짧은 message를 사용하고, HTML proxy 오류는 fallback으로 안내합니다.
export async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  return data !== null &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message.trim()
    ? data.message
    : fallback;
}

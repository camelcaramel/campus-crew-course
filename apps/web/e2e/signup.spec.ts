import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('회원가입 입력 검증 → 실제 가입 → 중복 오류 → 로그인과 새로고침', async ({
  page,
}) => {
  const email = `signup-${randomUUID()}@example.test`;
  const password = 'SignupE2e29!';
  let signupRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/signup')
      signupRequests++;
  });
  await page.goto('/');
  await page.getByRole('link', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL('/signup');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByLabel('이름', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(signupRequests).toBe(0);
  async function fillForm(confirm = password) {
    await page.getByLabel('이름', { exact: true }).fill('가입 테스트');
    await page.getByLabel('이메일', { exact: true }).fill(email);
    await page.getByLabel('비밀번호', { exact: true }).fill(password);
    await page.getByLabel('비밀번호 확인', { exact: true }).fill(confirm);
  }
  await fillForm('different');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(
    page.getByLabel('비밀번호 확인', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  expect(signupRequests).toBe(0);
  await fillForm();
  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/auth/signup',
  );
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  expect((await created).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText(
    '회원가입이 완료되었습니다',
  );
  await expect(page.getByRole('status')).toBeFocused();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.reload();
  await fillForm();
  const duplicate = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/auth/signup',
  );
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  expect((await duplicate).status()).toBe(409);
  await expect(page.locator('form').getByRole('alert')).toContainText(
    '이미 사용 중인 이메일',
  );
  await expect(
    page.getByRole('button', { name: '회원가입', exact: true }),
  ).toBeEnabled();
  await page.getByRole('link', { name: '로그인', exact: true }).last().click();
  await expect(page).toHaveURL('/login');
  await page.getByLabel('이메일', { exact: true }).fill(email);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/recruitments');
  await page.reload();
  await expect(page.getByText('가입 테스트님', { exact: true })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
});

test('회원가입 중 중복 제출 방지와 통신 실패 후 재시도', async ({ page }) => {
  await page.goto('/login');
  await page
    .getByRole('link', { name: '회원가입', exact: true })
    .last()
    .click();
  await expect(page).toHaveURL('/signup');
  await page.getByLabel('이름', { exact: true }).fill('재시도 학생');
  await page.getByLabel('이메일', { exact: true }).fill('retry@example.test');
  await page.getByLabel('비밀번호', { exact: true }).fill('SignupE2e29!');
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('SignupE2e29!');
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route('**/api/auth/signup', async (route) => {
    attempts++;
    if (attempts === 1) {
      await blocked;
      await route.abort('failed');
    } else
      await route.fulfill({
        status: 502,
        contentType: 'text/html',
        body: '<h1>Bad gateway</h1>',
      });
  });
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '가입 중…', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('이메일', { exact: true })).toBeDisabled();
  release();
  await expect(page.locator('form').getByRole('alert')).toContainText('연결');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText(
    '잠시 후',
  );
  expect(attempts).toBe(2);
});

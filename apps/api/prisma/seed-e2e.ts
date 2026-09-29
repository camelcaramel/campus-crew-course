import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { e2eCredentials, loadTestEnv } from '../test/test-env.cjs';

loadTestEnv();
const { email, password } = e2eCredentials();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, name: 'E2E Student', passwordHash },
    });
    const title = `E2E Smoke 모집글 (${email})`;
    const existing = await tx.recruitment.findFirst({
      where: { authorId: user.id, title },
      orderBy: { id: 'asc' },
    });
    if (!existing) {
      await tx.recruitment.create({
        data: {
          authorId: user.id,
          title,
          content:
            '브라우저에서 로그인하고 모집글 상세를 확인하는 테스트입니다.',
          category: 'STUDY',
          status: 'OPEN',
        },
      });
    }
  });
  console.log('E2E fixture ready (test database only).');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- DBeaver SQL Editor: 로그인한 작성자의 recruitmentId로 :recruitment_id를 바꿉니다.
-- 읽기 전용 검증입니다. passwordHash는 조회하지 않습니다.
SELECT a.id, a.message, a.status, a."createdAt",
       a."recruitmentId", r."authorId",
       u.id AS "applicantId", u.name, u.email
FROM applications AS a
JOIN recruitments AS r ON r.id = a."recruitmentId"
JOIN users AS u ON u.id = a."applicantId"
WHERE a."recruitmentId" = :recruitment_id
ORDER BY a."createdAt", a.id;

-- UI 승인/거절 전에는 PENDING, PATCH 성공 후에는 APPROVED/REJECTED입니다.
-- 다른 상태로 다시 PATCH하여 409를 받은 뒤 아래 결과가 유지되는지 확인합니다.
SELECT id, status, "updatedAt"
FROM applications
WHERE id = :application_id AND "recruitmentId" = :recruitment_id;

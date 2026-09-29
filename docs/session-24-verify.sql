-- DBeaver에서 읽기 전용으로 실행합니다. 예시 47/32은 실습 모집글/지원자 id로 바꿉니다.
-- 기존 데이터, seed, 다른 학생의 데이터를 UPDATE/DELETE하지 않습니다.
SELECT a.id, a.message, a.status, a."applicantId", u.name AS applicant_name,
       a."recruitmentId", r.title, r.status AS recruitment_status, a."createdAt"
FROM applications a
JOIN users u ON u.id = a."applicantId"
JOIN recruitments r ON r.id = a."recruitmentId"
WHERE a."recruitmentId" = 47 AND a."applicantId" = 32;

-- 지원 성공 1개 → 취소 성공 0개 → 재지원 성공 1개
SELECT COUNT(*) AS my_application_count
FROM applications
WHERE "recruitmentId" = 47 AND "applicantId" = 32;

-- 결과가 없어야 합니다. 복합 unique가 중복 저장을 방지합니다.
SELECT "applicantId", "recruitmentId", COUNT(*)
FROM applications
GROUP BY "applicantId", "recruitmentId"
HAVING COUNT(*) > 1;

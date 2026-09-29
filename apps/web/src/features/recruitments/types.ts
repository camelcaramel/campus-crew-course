export type RecruitmentListParams = {
  page: number;
  limit: number;
  q?: string;
  category?: Recruitment['category'];
};

export type RecruitmentListResponse = {
  items: Recruitment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type Recruitment = {
  id: number;
  category: 'STUDY' | 'PROJECT' | 'CONTEST';
  status: 'OPEN' | 'CLOSED';
  title: string;
  content: string;
  authorId: number;
  author: {
    id: number;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

// 작성자는 서버가 Cookie JWT로 결정합니다. 입력/요청에는 작성자 id가 없습니다.
export type CreateRecruitmentInput = Pick<
  Recruitment,
  'title' | 'category' | 'content'
>;

export type CreateRecruitmentRequest = CreateRecruitmentInput;

// PATCH는 전달한 필드만 변경합니다. 작성자 변경은 이 폼의 범위가 아닙니다.
export type UpdateRecruitmentRequest = Partial<CreateRecruitmentInput>;

export const recruitmentCategoryLabels: Record<
  Recruitment['category'],
  string
> = {
  STUDY: '스터디',
  PROJECT: '프로젝트',
  CONTEST: '공모전',
};

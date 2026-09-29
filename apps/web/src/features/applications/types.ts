export type ApplicationState = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface Application {
  id: number;
  message: string;
  status: ApplicationState;
  createdAt: string;
}
export interface MyApplicationResponse {
  application: Application | null;
}
export interface CreateApplicationInput {
  message: string;
}

export type ApplicationDecision = Exclude<ApplicationState, 'PENDING'>;
export interface ManagedApplication extends Application {
  applicant: { id: number; name: string; email: string };
}

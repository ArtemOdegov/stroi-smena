export type RegisterFlow = 'createCompany' | 'invite';

export type RootStackParamList = {
  Login: undefined;
  Register: { flow?: RegisterFlow } | undefined;
  CreateCompany: undefined;
  Home: undefined;
  Calendar: { companyId: string; companyName: string };
  /** Карточка активности из графика (макет stitch_remix_of 8) */
  ActivityDetail: {
    companyId: string;
    companyName: string;
    date: string;
    entryId: string;
  };
  DayEntry: { companyId: string; companyName: string; date: string };
  ChatList: { companyId: string; companyName: string };
  ChatThread: {
    companyId: string;
    companyName: string;
    conversationId: string;
    title: string;
  };
  Colleagues: { companyId: string; companyName: string };
  /** Права доступа / состав (макет stitch_remix_of 4), только директор */
  TeamAccess: { companyId: string; companyName: string };
  /** Настройки в контексте компании (вкладка таббара) */
  CompanySettings: { companyId: string; companyName: string };
};

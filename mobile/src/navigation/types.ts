export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Calendar: { companyId: string; companyName: string };
  DayEntry: { companyId: string; companyName: string; date: string };
  ChatList: { companyId: string; companyName: string };
  ChatThread: {
    companyId: string;
    conversationId: string;
    title: string;
  };
  Colleagues: { companyId: string; companyName: string };
};

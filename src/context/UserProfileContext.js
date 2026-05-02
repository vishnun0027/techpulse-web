import { createContext, useContext } from 'react';

export const UserProfileContext = createContext(null);

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  return ctx;
}

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface IUserAddedContext {
  /** счётчик «сколько раз добавили» */
  trigger: number;
  /** вызов при успешном добавлении */
  onUserAdded: () => void;
}

const UserAddedContext = createContext<IUserAddedContext>({
  trigger: 0,
  onUserAdded: () => {},
});

export const UserAddedProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trigger, setTrigger] = useState(0);
  const onUserAdded = () => setTrigger((t) => t + 1);

  return (
    <UserAddedContext.Provider value={{ trigger, onUserAdded }}>
      {children}
    </UserAddedContext.Provider>
  );
};

export const useUserAdded = () => useContext(UserAddedContext);

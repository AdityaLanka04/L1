import { useState, useCallback } from 'react';

export const useGlobalNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  const openNav = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeNav = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleNav = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    openNav,
    closeNav,
    toggleNav
  };
};

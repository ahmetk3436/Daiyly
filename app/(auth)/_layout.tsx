import React from 'react';
import { Slot, Redirect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { isAuthenticated, isGuest } = useAuth();

  // When login/register succeeds, isAuthenticated flips to true → redirect out
  if (isAuthenticated || isGuest) {
    return <Redirect href="/(protected)/home" />;
  }

  return <Slot />;
}

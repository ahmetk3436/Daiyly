import * as LocalAuthentication from 'expo-local-authentication';

// Biometric authentication (Apple Guideline 4.2 - Native Utility).
// Uses Face ID / Touch ID for secure session resumption.

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function getBiometricType(): Promise<string> {
  const types =
    await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (
    types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    )
  ) {
    return 'Face ID';
  }
  if (
    types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    return 'Touch ID';
  }
  return 'Biometric';
}

export async function authenticateWithBiometrics(
  promptMessage = 'Authenticate to continue'
): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use Passcode',
  });

  return result.success;
}

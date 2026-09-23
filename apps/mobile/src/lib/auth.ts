import * as LocalAuthentication from 'expo-local-authentication'

/**
 * Asks the owner to confirm with Face ID (or the phone's biometrics), always with a way out.
 *
 * With no biometrics enrolled, iOS falls back to its passcode sheet; on a development
 * simulator that sheet has no cancel, so it is skipped there. On a real phone the passcode is
 * the right fallback and keeps a Cancel button.
 */
export async function confirmWithFace(prompt: string): Promise<boolean> {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ])
  if (!(hardware && enrolled) && __DEV__) return true
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use passcode',
  })
  return result.success
}

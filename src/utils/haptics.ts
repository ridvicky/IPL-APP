import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const h = (fn: () => Promise<void>) => { void fn() }

export const tap     = () => h(() => Haptics.impact({ style: ImpactStyle.Light }))
export const action  = () => h(() => Haptics.impact({ style: ImpactStyle.Medium }))
export const confirm = () => h(() => Haptics.impact({ style: ImpactStyle.Heavy }))
export const success = () => h(() => Haptics.notification({ type: NotificationType.Success }))
export const warning = () => h(() => Haptics.notification({ type: NotificationType.Warning }))

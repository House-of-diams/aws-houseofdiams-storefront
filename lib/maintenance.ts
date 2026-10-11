import { getCachedRoutingState } from '@/lib/routing-state'
import { fallbackMaintenanceMessage } from '@/lib/routing-state-logic'

export { fallbackMaintenanceMessage }

export type MaintenanceModeState = {
  enabled: boolean
  message: string
}

export async function getMaintenanceMode(): Promise<MaintenanceModeState> {
  const routingState = await getCachedRoutingState()
  return routingState.maintenance
}

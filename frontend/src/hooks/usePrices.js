import { useApi } from './useApi'
import { priceService } from '@services/priceService'

export function usePrices({ crop, state, startDate, endDate, limit = 100 }) {
  return useApi(
    () => priceService.getPrices({ crop, state, startDate, endDate, limit }),
    [crop, state, startDate, endDate]
  )
}

export function usePriceSummary({ crop, state }) {
  return useApi(
    () => priceService.getPriceSummary({ crop, state }),
    [crop, state]
  )
}

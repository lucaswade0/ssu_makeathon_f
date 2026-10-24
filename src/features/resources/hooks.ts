import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '../community/hooks'
import { useCommunitySession } from '../community/session'
import { resourcesApi } from './api'
import type { ReportReason, ResourceInput } from './schemas'

export function useResources(city: string) {
  const { configured } = useCommunitySession()
  const selectedCity = city.trim()
  useRealtimeInvalidate('resources', `resources:${selectedCity}`, ['resources', selectedCity], configured && Boolean(selectedCity),
    row => row.city === selectedCity)
  return useQuery({
    queryKey: ['resources', selectedCity],
    queryFn: () => resourcesApi.list(selectedCity),
    enabled: configured && Boolean(selectedCity),
    refetchInterval: 30_000,
  })
}

export function useCreateResource() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ResourceInput) => resourcesApi.create(input),
    // The map reads the same query, so it updates too.
    onSuccess: () => client.invalidateQueries({ queryKey: ['resources'] }),
  })
}

export function useRemoveResource() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => resourcesApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['resources'] }),
  })
}

export function useReportResource() {
  return useMutation({
    mutationFn: ({ id, reason, details }: { id: string; reason: ReportReason; details?: string }) => resourcesApi.report(id, reason, details),
  })
}

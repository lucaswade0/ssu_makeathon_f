import { useEffect } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { communityApi } from './api'
import { supabase } from '../../lib/supabase'
import { useCommunitySession } from './session'
import type { FeedCursor, PostEdit, PostInput, PostType } from './schemas'

// Refetch when another resident changes a table. Polling stays on as a fallback if the socket drops.
function useRealtimeInvalidate(table: 'posts' | 'post_replies', channelName: string, queryKey: readonly unknown[], enabled: boolean, matches?: (row: Record<string, unknown>) => boolean) {
  const client = useQueryClient()
  const keyString = JSON.stringify(queryKey)
  useEffect(() => {
    if (!supabase || !enabled) return
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        // Deletes only carry the primary key, so refetch for those.
        if (matches && payload.eventType !== 'DELETE' && !matches(payload.new)) return
        void client.invalidateQueries({ queryKey: JSON.parse(keyString) })
      })
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, table, channelName, keyString, enabled])
}

export function useCommunityFeed(city: string, postType?: PostType) {
  const { configured } = useCommunitySession()
  const selectedCity = city.trim()
  useRealtimeInvalidate('posts', `feed-posts:${selectedCity}`, ['community', 'posts', selectedCity], configured && Boolean(selectedCity),
    row => row.city === selectedCity)
  return useInfiniteQuery({
    queryKey: ['community', 'posts', selectedCity, postType ?? 'all'],
    initialPageParam: undefined as FeedCursor | undefined,
    queryFn: ({ pageParam }) => communityApi.listPosts(selectedCity, pageParam, undefined, postType),
    getNextPageParam: (page) => page.nextCursor,
    enabled: configured && Boolean(selectedCity),
    refetchInterval: 30_000,
  })
}

export function useOfficialAlert(city: string) {
  const { configured } = useCommunitySession()
  const selectedCity = city.trim()
  return useQuery({
    queryKey: ['community', 'alert', selectedCity],
    queryFn: () => communityApi.latestAlert(selectedCity),
    enabled: configured && Boolean(selectedCity),
    refetchInterval: 30_000,
  })
}

export function usePostReplies(postId: string) {
  const { configured } = useCommunitySession()
  useRealtimeInvalidate('post_replies', `feed-replies:${postId}`, ['community', 'replies', postId], configured && Boolean(postId),
    row => row.post_id === postId)
  return useInfiniteQuery({
    queryKey: ['community', 'replies', postId],
    initialPageParam: undefined as FeedCursor | undefined,
    queryFn: ({ pageParam }) => communityApi.listReplies(postId, pageParam),
    getNextPageParam: (page) => page.nextCursor,
    enabled: configured && Boolean(postId),
    refetchInterval: 30_000,
  })
}

type PostCommand =
  | { action: 'create'; input: PostInput }
  | { action: 'edit'; id: string; input: PostEdit }
  | { action: 'delete'; id: string }

export function usePostMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (command: PostCommand) => {
      switch (command.action) {
        case 'create': return communityApi.createPost(command.input)
        case 'edit': return communityApi.editPost(command.id, command.input)
        case 'delete': return communityApi.deletePost(command.id)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['community'] }),
  })
}

type ReplyCommand =
  | { action: 'create'; postId: string; body: string }
  | { action: 'edit'; id: string; body: string }
  | { action: 'delete'; id: string }

export function useReplyMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (command: ReplyCommand) => {
      switch (command.action) {
        case 'create': return communityApi.createReply(command.postId, command.body)
        case 'edit': return communityApi.editReply(command.id, command.body)
        case 'delete': return communityApi.deleteReply(command.id)
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['community', 'replies'] }),
  })
}

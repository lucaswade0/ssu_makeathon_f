import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { communityApi } from './api'
import { useCommunitySession } from './session'
import type { FeedCursor, PostEdit, PostInput } from './schemas'

export function useCommunityFeed(city: string) {
  const { configured } = useCommunitySession()
  const selectedCity = city.trim()
  return useInfiniteQuery({
    queryKey: ['community', 'posts', selectedCity],
    initialPageParam: undefined as FeedCursor | undefined,
    queryFn: ({ pageParam }) => communityApi.listPosts(selectedCity, pageParam),
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

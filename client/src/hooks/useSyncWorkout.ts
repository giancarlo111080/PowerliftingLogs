import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyInstagramLinkOptimistically,
  applySetUpdateOptimistically,
  flushSyncLedger,
  loadCommands,
  loadWorkout,
  persistInstagramLink,
  persistSetUpdate
} from "../data/localStore";
import type { InstagramLinkInput, SetUpdateInput, WorkoutSnapshot } from "../types/training";

const workoutKey = ["workout", "day-1"] as const;
const commandKey = ["sync-ledger"] as const;

export function useSyncWorkout() {
  const queryClient = useQueryClient();
  const workoutQuery = useQuery({ queryKey: workoutKey, queryFn: loadWorkout, staleTime: Infinity });
  const commandQuery = useQuery({ queryKey: commandKey, queryFn: loadCommands, staleTime: 5_000 });

  const setMutation = useMutation({
    mutationFn: persistSetUpdate,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: workoutKey });
      const previous = queryClient.getQueryData<WorkoutSnapshot>(workoutKey);
      if (previous) {
        queryClient.setQueryData(workoutKey, applySetUpdateOptimistically(previous, input));
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workoutKey, context.previous);
      }
    },
    onSuccess: ({ snapshot, commands }) => {
      queryClient.setQueryData(workoutKey, snapshot);
      queryClient.setQueryData(commandKey, commands);
    }
  });

  const instagramMutation = useMutation({
    mutationFn: persistInstagramLink,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: workoutKey });
      const previous = queryClient.getQueryData<WorkoutSnapshot>(workoutKey);
      if (previous) {
        queryClient.setQueryData(workoutKey, applyInstagramLinkOptimistically(previous, input));
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workoutKey, context.previous);
      }
    },
    onSuccess: ({ snapshot, commands }) => {
      queryClient.setQueryData(workoutKey, snapshot);
      queryClient.setQueryData(commandKey, commands);
    }
  });

  const syncMutation = useMutation({
    mutationFn: flushSyncLedger,
    onSuccess: ({ commands }) => queryClient.setQueryData(commandKey, commands)
  });

  const queueCount = commandQuery.data?.length ?? 0;
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((networkState) => {
      const canSynchronize = networkState.isConnected === true && networkState.isInternetReachable !== false;
      if (canSynchronize && queueCount > 0 && !syncMutation.isPending) {
        syncMutation.mutate();
      }
    });
    return unsubscribe;
  }, [queueCount, syncMutation]);

  return {
    workout: workoutQuery.data,
    isLoading: workoutQuery.isLoading,
    error: workoutQuery.error,
    queueCount,
    rejectedCount: commandQuery.data?.filter((command) => command.retryCount > 0).length ?? 0,
    isSyncing: syncMutation.isPending,
    logSet: (input: SetUpdateInput) => setMutation.mutateAsync(input),
    attachInstagramLink: (input: InstagramLinkInput) => instagramMutation.mutateAsync(input),
    flush: () => syncMutation.mutateAsync(),
    reload: () => workoutQuery.refetch(),
    isUpdating: setMutation.isPending || instagramMutation.isPending
  };
}

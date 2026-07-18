import { useLocalSearchParams } from "expo-router";

import { HackRoomDetailScreen } from "@/components/hack-room";

export default function HackRoomDetailRoute() {
  const { roomId, tab } = useLocalSearchParams<{ roomId?: string; tab?: string }>();

  return (
    <HackRoomDetailScreen
      initialParticipantTab={tab === "wallet" ? "wallet" : null}
      roomId={roomId ?? ""}
    />
  );
}

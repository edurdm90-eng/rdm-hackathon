import { useLocalSearchParams } from "expo-router";

import { HackRoomDetailScreen } from "@/components/hack-room";

export default function HackRoomDetailRoute() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();

  return <HackRoomDetailScreen roomId={roomId ?? ""} />;
}

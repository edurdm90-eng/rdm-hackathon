import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  CounterLabel,
  EmptyState,
  Field,
  HackButton,
  HackTextInput,
  Panel,
  RoomCard,
  StatusPill,
} from "@/components/hack-room/components";
import {
  emptyRoomForm,
  type DashboardData,
  type HackRoom,
  type Role,
  type Tone,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import { HACK_THEME as theme } from "@/lib/constants";

export function RoomCommandCenter({
  canCreateRoom,
  createRoomPending,
  createRoomModalOpen,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  onSetCreateRoomModalOpen,
  roomForm,
}: {
  canCreateRoom: boolean;
  createRoomPending: boolean;
  createRoomModalOpen: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSetCreateRoomModalOpen: (open: boolean) => void;
  roomForm: typeof emptyRoomForm;
}) {
  return (
    <>
      <Panel
        action={
          canCreateRoom ? (
            <Pressable
              accessibilityLabel="Create hack room"
              accessibilityRole="button"
              onPress={() => onSetCreateRoomModalOpen(true)}
              style={({ pressed }) => [
                styles.createRoomTrigger,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="add-outline" size={18} color="#060214" />
              <Text style={styles.createRoomTriggerText}>Create</Text>
            </Pressable>
          ) : null
        }
        eyebrow="Lobby"
        icon="key-outline"
        title="Join Hack Room"
        tone="cyan"
      >
        <View style={styles.inviteJoinRow}>
          <View style={styles.inviteInputColumn}>
            <Text style={[styles.fieldLabel, styles.inviteFieldLabel]}>
              Enter invite code
            </Text>
            <HackTextInput
              autoCapitalize="characters"
              onChangeText={onInviteCodeChange}
              placeholder="HR-ABC123"
              value={inviteCode}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!inviteCode.trim() || joinRoomPending}
            onPress={onJoinRoom}
            style={({ pressed }) => [
              styles.joinTightButton,
              (!inviteCode.trim() || joinRoomPending) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {joinRoomPending ? (
              <ActivityIndicator color="#03120c" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={18} color="#03120c" />
                <Text style={styles.joinTightText}>Join</Text>
              </>
            )}
          </Pressable>
        </View>
      </Panel>

      {canCreateRoom ? (
        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!createRoomPending) {
              onSetCreateRoomModalOpen(false);
            }
          }}
          transparent
          visible={createRoomModalOpen}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalKeyboardView}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleBlock}>
                    <Text style={styles.sectionEyebrow}>Host</Text>
                    <Text style={styles.modalTitle}>Create Hack Room</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close create room"
                    accessibilityRole="button"
                    disabled={createRoomPending}
                    onPress={() => onSetCreateRoomModalOpen(false)}
                    style={({ pressed }) => [
                      styles.modalCloseButton,
                      createRoomPending && styles.disabled,
                      pressed && !createRoomPending && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="close-outline"
                      size={22}
                      color={theme.text}
                    />
                  </Pressable>
                </View>

                <StatusPill label="Host owns room" tone="violet" />

                {createRoomPending ? (
                  <View style={styles.compactBusyRow}>
                    <ActivityIndicator color={theme.award} />
                    <Text style={styles.mutedText}>
                      Room is being created, please wait.
                    </Text>
                  </View>
                ) : null}

                <Field label="Room name">
                  <HackTextInput
                    onChangeText={(value) =>
                      onRoomFormChange((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                    placeholder="AI Agents Sprint"
                    value={roomForm.name}
                  />
                </Field>
                <Field label="Room brief">
                  <HackTextInput
                    caretHidden={createRoomPending}
                    editable={!createRoomPending}
                    multiline
                    onChangeText={(value) =>
                      onRoomFormChange((current) => ({
                        ...current,
                        description: value,
                      }))
                    }
                    placeholder="Members build and submit working demos by deadline."
                    style={styles.textArea}
                    value={roomForm.description}
                  />
                </Field>
                <View style={styles.modalActions}>
                  <HackButton
                    disabled={createRoomPending}
                    label="Cancel"
                    onPress={() => onSetCreateRoomModalOpen(false)}
                    tone="red"
                  />
                  <HackButton
                    disabled={!roomForm.name.trim() || createRoomPending}
                    icon="add-outline"
                    label={createRoomPending ? "Creating Room" : "Create Room"}
                    loading={createRoomPending}
                    onPress={onCreateRoom}
                    tone="violet"
                  />
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function RoomShelf({
  allRooms,
  onCopyInvite,
  onSelectRoom,
  onShareRoom,
}: {
  allRooms: Array<{ role: Role; room: HackRoom }>;
  onCopyInvite: (room: HackRoom) => void;
  onSelectRoom: (roomId: string) => void;
  onShareRoom: (room: HackRoom) => void;
}) {
  return (
    <View style={styles.roomShelfSection}>
      <View style={styles.roomShelfHeaderOutside}>
        <View>
          <Text style={styles.sectionEyebrow}>Your Hack Rooms</Text>
          <Text style={styles.roomShelfTitle}>
            Select a room to open details
          </Text>
        </View>
        <CounterLabel label={`${allRooms.length} active`} />
      </View>
      {allRooms.length ? (
        <View style={styles.roomShelf}>
          {allRooms.map(({ role, room }) => (
            <SelectableRoomCard
              key={room._id}
              onCopyInvite={() => onCopyInvite(room)}
              onPress={() => onSelectRoom(room._id)}
              onShare={() => onShareRoom(room)}
              role={role}
              room={room}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="flash-outline"
          text="Created and joined rooms will appear here."
        />
      )}
    </View>
  );
}

function SelectableRoomCard({
  onCopyInvite,
  onPress,
  onShare,
  role,
  room,
}: {
  onCopyInvite: () => void;
  onPress: () => void;
  onShare: () => void;
  role: Role;
  room: HackRoom;
}) {
  const tone = role === "host" ? "violet" : "cyan";
  return (
    <View style={styles.selectableRoomCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.selectableRoomContent,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardTopRow}>
          <StatusPill label={role} tone={tone} />
          <View style={styles.roomShareIconSpacer} />
        </View>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {room.name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {room.description || `Hosted by ${room.hostName}`}
        </Text>
        <View style={styles.inviteMiniRow}>
          <Ionicons name="key-outline" size={14} color={theme.host} />
          <Text numberOfLines={1} style={styles.inviteMiniText}>
            {room.inviteCode}
          </Text>
        </View>
        <Text style={styles.cardMeta}>{room.participants.length} members</Text>
      </Pressable>
      <View style={styles.roomShareFloatingWrap}>
        {role === "host" ? (
          <Pressable
            accessibilityLabel={`Copy invite code ${room.inviteCode}`}
            accessibilityRole="button"
            onPress={onCopyInvite}
            style={({ pressed }) => [
              styles.roomShareIcon,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="copy-outline" size={15} color={theme.muted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={`Share invite code ${room.inviteCode}`}
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [
            styles.roomShareIcon,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="share-outline" size={15} color={theme.muted} />
        </Pressable>
      </View>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useNavigation, useRouter } from "expo-router";
import type React from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HACK_THEME as theme } from "@/lib/constants";
import { styles } from "@/components/hack-room/styles";
import {
  emptySubmitForm,
  formatDate,
  formatDateTimeValue,
  getInitials,
  getSubmissionProofItems,
  getTaskProofTypes,
  getToneColors,
  kindLabel,
  mergeDateParts,
  mergeTimeParts,
  parseDateTimeValue,
  proofTypeIcon,
  proofTypeLabel,
  proofTypePlaceholder,
  statusTone,
  submissionStatusLabel,
  type DashboardData,
  type HackRoom,
  type HackTask,
  type Role,
  type SubmissionProofItem,
  type SubmissionStatus,
  type Tone,
} from "@/components/hack-room/domain";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

export function FullScreenLoader({ message }: { message: string }) {
  return (
    <View style={styles.loadingScreen}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={rdmLogo}
        style={styles.loadingLogo}
      />
      <ActivityIndicator color={theme.participant} size="large" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function WalletChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.walletChip}>
      <Text style={styles.walletChipValue}>{value}</Text>
      <Text style={styles.walletChipLabel}>{label}</Text>
    </View>
  );
}

export function LedgerRow({
  label,
  meta,
  value,
}: {
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerDot} />
      <View style={styles.profileText}>
        <Text numberOfLines={1} style={styles.ledgerRowTitle}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.ledgerRowMeta}>
          {meta}
        </Text>
      </View>
      <Text style={styles.ledgerRowValue}>{value}</Text>
    </View>
  );
}

export function QuickActionTile({
  active,
  icon,
  label,
  onPress,
  tone = "violet",
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone?: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionTile,
        {
          borderColor: active ? toneColors.border : theme.border,
          borderTopColor: active ? toneColors.fg : toneColors.border,
        },
        active && { backgroundColor: toneColors.bg },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.quickActionIconBg,
          {
            backgroundColor: active ? toneColors.bg : theme.surface,
            borderColor: active ? toneColors.border : theme.border,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={active ? toneColors.fg : theme.muted}
        />
      </View>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={[styles.quickActionText, active && { color: toneColors.fg }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TrackLabel({ label, tone }: { label: string; tone: Tone }) {
  const toneColors = getToneColors(tone);
  return (
    <View style={styles.trackLabelRow}>
      <View
        style={[styles.trackLabelLine, { backgroundColor: toneColors.fg }]}
      />
      <Text style={[styles.trackLabelText, { color: toneColors.fg }]}>
        {label}
      </Text>
    </View>
  );
}

export function KindButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.kindButton, active && styles.kindButtonActive]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? theme.host : theme.muted}
      />
      <Text
        style={[styles.kindButtonText, active && styles.kindButtonTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
}) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={16} color={theme.participant} />
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.miniStatLabel}>
        {label}
      </Text>
    </View>
  );
}

export function ParticipantListItem({
  participant,
}: {
  participant: HackRoom["participants"][number];
}) {
  return (
    <View style={styles.participantRow}>
      <Avatar name={participant.name} tone="cyan" />
      <View style={styles.profileText}>
        <Text style={styles.profileName}>{participant.name}</Text>
        <Text style={styles.profileEmail}>{participant.email}</Text>
      </View>
      <Text style={styles.cardMeta}>{formatDate(participant.joinedAt)}</Text>
    </View>
  );
}

export function AppHeader({
  notificationCount = 0,
  onNotificationPress,
}: {
  notificationCount?: number;
  onNotificationPress: () => void;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const handleOpenMenu = () => {
    (navigation as { dispatch: (action: { type: string }) => void }).dispatch({
      type: "OPEN_DRAWER",
    });
  };
  const handleOpenProfile = () => {
    router.push("/profile");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.homeHeaderSafe}>
      <View style={styles.homeHeader}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={rdmLogo}
          style={styles.homeHeaderLogo}
        />
        <View style={styles.homeHeaderActions}>
          <HeaderIconButton
            accessibilityLabel="Notifications"
            badgeCount={notificationCount}
            icon="notifications-outline"
            onPress={onNotificationPress}
          />
          <HeaderIconButton
            accessibilityLabel="Open menu"
            icon="menu-outline"
            onPress={handleOpenMenu}
          />
          <HeaderIconButton
            accessibilityLabel="Profile"
            icon="person-circle-outline"
            onPress={handleOpenProfile}
            tone="profile"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function InviteActionButton({
  accessibilityLabel,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={theme.host} />
      <Text style={styles.shareText}>{label}</Text>
    </Pressable>
  );
}

export function HeaderIconButton({
  accessibilityLabel,
  badgeCount = 0,
  icon,
  onPress,
  tone = "default",
}: {
  accessibilityLabel: string;
  badgeCount?: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  tone?: "default" | "profile";
}) {
  const color = tone === "profile" ? theme.participant : theme.text;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        tone === "profile" && styles.headerProfileButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
      {badgeCount > 0 ? (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text selectable style={styles.profileRowValue}>
        {value}
      </Text>
    </View>
  );
}

export function Panel({
  action,
  children,
  eyebrow,
  icon,
  title,
  tone,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  eyebrow: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <View
      style={[
        styles.panel,
        { borderColor: toneColors.border, backgroundColor: toneColors.bg },
      ]}
    >
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <View style={[styles.panelIcon, { borderColor: toneColors.border }]}>
            <Ionicons name={icon} size={20} color={toneColors.fg} />
          </View>
          <View style={styles.panelTitleBlock}>
            <Text style={[styles.panelEyebrow, { color: toneColors.fg }]}>
              {eyebrow}
            </Text>
            <Text style={styles.panelTitle}>{title}</Text>
          </View>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function HackTextInput({
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  style?: React.ComponentProps<typeof TextInput>["style"];
}) {
  return (
    <TextInput
      placeholderTextColor={theme.dim}
      selectionColor={theme.participant}
      style={[styles.input, props.multiline && styles.inputMultiline, style]}
      {...props}
    />
  );
}

export function DateTimeField({
  label,
  minimumDate,
  onChange,
  value,
}: {
  label: string;
  minimumDate?: Date;
  onChange: (value: string) => void;
  value: string;
}) {
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const pickerDate = parseDateTimeValue(value);

  const handlePickerValueChange = (_event: unknown, selectedDate: Date) => {
    if (Platform.OS !== "ios") {
      setPickerMode(null);
    }

    if (!pickerMode) {
      return;
    }

    const baseDate = parseDateTimeValue(value);
    const nextDate =
      pickerMode === "date"
        ? mergeDateParts(baseDate, selectedDate)
        : mergeTimeParts(baseDate, selectedDate);

    onChange(nextDate.toISOString());
  };

  const handlePickerDismiss = () => {
    if (Platform.OS !== "ios") {
      setPickerMode(null);
    }
  };

  const openAndroidPicker = (mode: "date" | "time") => {
    DateTimePickerAndroid.open({
      minimumDate,
      mode,
      onDismiss: handlePickerDismiss,
      onNeutralButtonPress: handlePickerDismiss,
      onValueChange: (event, selectedDate) => {
        const baseDate = parseDateTimeValue(value);
        const nextDate =
          mode === "date"
            ? mergeDateParts(baseDate, selectedDate)
            : mergeTimeParts(baseDate, selectedDate);

        onChange(nextDate.toISOString());
        setPickerMode(null);
      },
      value: pickerDate,
    });
  };

  const handleOpenPicker = (mode: "date" | "time") => {
    if (Platform.OS === "android") {
      openAndroidPicker(mode);
      return;
    }

    setPickerMode(mode);
  };

  if (Platform.OS === "web") {
    return (
      <Field label={label}>
        <HackTextInput
          onChangeText={onChange}
          placeholder="2026-06-20T17:00:00.000Z"
          value={value}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <View style={styles.datePickerCard}>
        <Text style={styles.datePickerValue}>
          {value ? formatDateTimeValue(value) : "Select date and time"}
        </Text>
        <View style={styles.datePickerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker("date")}
            style={({ pressed }) => [
              styles.datePickerButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.host} />
            <Text style={styles.datePickerButtonText}>Date</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker("time")}
            style={({ pressed }) => [
              styles.datePickerButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="time-outline" size={16} color={theme.host} />
            <Text style={styles.datePickerButtonText}>Time</Text>
          </Pressable>
        </View>
      </View>

      {Platform.OS === "ios" && pickerMode ? (
        <View style={styles.nativePickerWrap}>
          <DateTimePicker
            display={Platform.OS === "ios" ? "spinner" : "default"}
            mode={pickerMode}
            minimumDate={minimumDate}
            onDismiss={handlePickerDismiss}
            onNeutralButtonPress={handlePickerDismiss}
            onValueChange={handlePickerValueChange}
            value={pickerDate}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerMode(null)}
              style={({ pressed }) => [
                styles.dateDoneButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateDoneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Field>
  );
}

export function ProofRequirementFields({
  selectedTask,
  setSubmitForm,
  submitForm,
}: {
  selectedTask?: HackTask;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
}) {
  if (!selectedTask) {
    return (
      <EmptyState
        icon="clipboard-outline"
        text="Select an assignment to see required proof."
      />
    );
  }

  const requiredProofTypes = getTaskProofTypes(selectedTask);

  return (
    <View style={styles.proofRequirementStack}>
      {requiredProofTypes.map((proofType) => (
        <Field key={proofType} label={`${proofTypeLabel(proofType)} proof`}>
          <HackTextInput
            autoCapitalize="none"
            keyboardType={proofType === "game_score" ? "default" : "url"}
            onChangeText={(value) =>
              setSubmitForm((current) => ({
                ...current,
                proofItems: {
                  ...current.proofItems,
                  [proofType]: value,
                },
                proofUrl:
                  proofType === requiredProofTypes[0]
                    ? value
                    : current.proofUrl,
              }))
            }
            placeholder={proofTypePlaceholder(proofType)}
            value={submitForm.proofItems[proofType] ?? ""}
          />
        </Field>
      ))}
    </View>
  );
}

export function ProofItemsList({
  proofItems,
}: {
  proofItems: Array<SubmissionProofItem>;
}) {
  if (!proofItems.length) {
    return (
      <EmptyState icon="link-outline" text="No proof links were attached." />
    );
  }

  return (
    <View style={styles.proofItemList}>
      <Text style={styles.proofItemSectionLabel}>Submitted proof</Text>
      {proofItems.map((proofItem, index) => (
        <ProofItemRow
          index={index}
          key={`${proofItem.type}-${index}`}
          proofItem={proofItem}
        />
      ))}
    </View>
  );
}

export function ProofItemRow({
  index,
  proofItem,
}: {
  index: number;
  proofItem: SubmissionProofItem;
}) {
  const isLinkProof = proofItem.type !== "game_score";

  return (
    <Pressable
      accessibilityRole={isLinkProof ? "link" : "text"}
      disabled={!isLinkProof}
      onPress={isLinkProof ? () => Linking.openURL(proofItem.value) : undefined}
      style={({ pressed }) => [styles.proofItemRow, pressed && styles.pressed]}
    >
      <View style={styles.proofItemIcon}>
        <Ionicons
          name={proofTypeIcon(proofItem.type)}
          size={15}
          color={theme.participant}
        />
      </View>
      <View style={styles.proofItemTextBlock}>
        <Text style={styles.proofItemType}>
          {proofTypeLabel(proofItem.type)} {index + 1}
        </Text>
        <Text numberOfLines={1} style={styles.proofItemValue}>
          {proofItem.value}
        </Text>
      </View>
      <Text style={styles.proofItemOpen}>
        {isLinkProof ? "Open" : "Result"}
      </Text>
    </Pressable>
  );
}

export function HackButton({
  disabled,
  icon,
  label,
  loading,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  loading?: boolean;
  onPress: () => void;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: toneColors.fg },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={toneColors.buttonText} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={17} color={toneColors.buttonText} />
          ) : null}
          <Text style={[styles.buttonText, { color: toneColors.buttonText }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function RoleButton({
  active,
  description,
  icon,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone: "cyan" | "violet";
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.roleButton,
        active && {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.fg,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? toneColors.fg : theme.muted}
      />
      <Text style={[styles.roleTitle, active && { color: toneColors.fg }]}>
        {label}
      </Text>
      <Text style={styles.roleDescription}>{description}</Text>
    </Pressable>
  );
}

export function MetricCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone: Tone;
  value: number;
}) {
  const toneColors = getToneColors(tone);
  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={toneColors.fg} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function HomeHubTile({
  icon,
  label,
  meta,
  onPress,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  meta: string;
  onPress: () => void;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.homeHubTile,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={toneColors.fg} />
      <Text style={[styles.homeHubTileLabel, { color: toneColors.fg }]}>
        {label}
      </Text>
      <Text numberOfLines={2} style={styles.homeHubTileMeta}>
        {meta}
      </Text>
    </Pressable>
  );
}

export function RoomCard({
  role,
  room,
}: {
  role: Role;
  room: HackRoom | DashboardData["joinedRooms"][number];
}) {
  const tone = role === "host" ? "violet" : "cyan";
  return (
    <View style={styles.roomCard}>
      <Avatar name={room.name} tone={tone} />
      <View style={styles.roomBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {room.name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {room.description || `Hosted by ${room.hostName}`}
        </Text>
        <Text style={styles.cardMeta}>
          {room.participants.length} members · {room.inviteCode}
        </Text>
      </View>
    </View>
  );
}

export function TaskCard({
  onPress,
  selected,
  status,
  task,
}: {
  onPress: () => void;
  selected: boolean;
  status?: SubmissionStatus;
  task: HackTask;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.taskCard, selected && styles.taskCardSelected]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{task.title}</Text>
          <Text style={styles.cardMeta}>
            {task.roomName} · Due {task.dueAt}
          </Text>
        </View>
        <StatusPill
          label={
            status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`
          }
          tone={statusTone(status)}
        />
      </View>
      <Text numberOfLines={3} style={styles.cardDescription}>
        {task.description}
      </Text>
      {task.kind === "special" && task.assignedToEmail ? (
        <View style={styles.specialAssigneeRow}>
          <Ionicons name="person-outline" size={13} color={theme.warning} />
          <Text numberOfLines={1} style={styles.specialAssigneeText}>
            For {task.assignedToName || task.assignedToEmail}
          </Text>
        </View>
      ) : null}
      <View style={styles.proofTypeRow}>
        <Text style={styles.proofTypeLabel}>
          {kindLabel(task.kind ?? "task")}
        </Text>
        {getTaskProofTypes(task).map((proofType) => (
          <Text key={proofType} style={styles.proofTypeLabel}>
            {proofTypeLabel(proofType)}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

export function SubmissionCard({
  submission,
}: {
  submission:
    | DashboardData["hostSubmissions"][number]
    | DashboardData["mySubmissions"][number]
    | DashboardData["visibleWinners"][number];
}) {
  return (
    <View style={styles.submissionCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{submission.taskTitle}</Text>
          <Text style={styles.cardMeta}>{submission.roomName}</Text>
        </View>
        <StatusPill
          label={submissionStatusLabel(submission.status)}
          tone={statusTone(submission.status)}
        />
      </View>
      <SubmissionMetaBlock submission={submission} />
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      <View style={styles.awardRow}>
        <Text style={styles.cardMeta}>
          {formatDate(submission.submittedAt)}
        </Text>
        <Text style={styles.awardText}>
          +{submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM
        </Text>
      </View>
      {submission.hostFeedback ? (
        <Text style={styles.feedbackText}>{submission.hostFeedback}</Text>
      ) : null}
    </View>
  );
}

export function SubmissionMetaBlock({
  submission,
}: {
  submission: {
    participantName: string;
    submissionDescription?: string;
    submitterName?: string;
    teamMateEmails?: Array<string>;
    teamName?: string;
  };
}) {
  const submittedBy =
    submission.submitterName?.trim() || submission.participantName;
  const teamName = submission.teamName?.trim();
  const description = submission.submissionDescription?.trim();
  const teamMateEmails = submission.teamMateEmails ?? [];

  if (
    !teamName &&
    !description &&
    !teamMateEmails.length &&
    !submission.submitterName?.trim()
  ) {
    return null;
  }

  return (
    <View style={styles.submissionMetaBox}>
      <View style={styles.submissionMetaRow}>
        <Text style={styles.submissionMetaLabel}>Student</Text>
        <Text numberOfLines={1} style={styles.submissionMetaText}>
          {submittedBy}
        </Text>
      </View>
      {teamName ? (
        <View style={styles.submissionMetaRow}>
          <Text style={styles.submissionMetaLabel}>Team</Text>
          <Text numberOfLines={1} style={styles.submissionMetaText}>
            {teamName}
          </Text>
        </View>
      ) : null}
      {teamMateEmails.length ? (
        <View style={styles.submissionMateBlock}>
          <Text style={styles.submissionMetaLabel}>Mates</Text>
          <View style={styles.submissionMateChips}>
            {teamMateEmails.map((email) => (
              <Text
                key={email}
                numberOfLines={1}
                style={styles.submissionMateChip}
              >
                {email}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {description ? (
        <Text style={styles.submissionDescriptionText}>{description}</Text>
      ) : null}
    </View>
  );
}

export function LinkRow({ url }: { url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <Ionicons name="link-outline" size={16} color={theme.participant} />
      <Text numberOfLines={1} style={styles.linkText}>
        {url}
      </Text>
    </Pressable>
  );
}

export function Avatar({
  name,
  tone,
}: {
  name: string;
  tone: "cyan" | "violet";
}) {
  const toneColors = getToneColors(tone);
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
      ]}
    >
      <Text style={[styles.avatarText, { color: toneColors.fg }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={18} color={theme.dim} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const toneColors = getToneColors(tone);
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
      ]}
    >
      <Text style={[styles.statusPillText, { color: toneColors.fg }]}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <StatusBanner message={message} tone="red" />;
}

export function StatusBanner({
  message,
  tone,
}: {
  message: string;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <View
      style={[
        styles.statusBanner,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
      ]}
    >
      <Ionicons
        name={tone === "red" ? "warning-outline" : "checkmark-circle-outline"}
        size={17}
        color={toneColors.fg}
      />
      <Text style={[styles.statusBannerText, { color: toneColors.fg }]}>
        {message}
      </Text>
    </View>
  );
}

export function CounterLabel({ label }: { label: string }) {
  return <Text style={styles.counterLabel}>{label}</Text>;
}

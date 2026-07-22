import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { StatusPill } from "@/components/hack-room/components";
import {
  formatDate,
  formatShortDateTime,
  rewardKindIcon,
  rewardKindLabel,
  rewardKindTone,
  type HackReward,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import { HACK_THEME as theme } from "@/lib/constants";

export function RewardCard({
  reward,
  showTimestamp = false,
}: {
  reward: HackReward;
  showTimestamp?: boolean;
}) {
  return (
    <View style={styles.rewardCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.rewardIcon}>
          <Ionicons
            name={rewardKindIcon(reward.kind)}
            size={18}
            color={theme.award}
          />
        </View>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{reward.title}</Text>
          <Text style={styles.cardMeta}>
            {reward.roomName} -{" "}
            {showTimestamp
              ? formatShortDateTime(reward.issuedAt)
              : formatDate(reward.issuedAt)}
          </Text>
        </View>
        <StatusPill
          label={rewardKindLabel(reward.kind)}
          tone={rewardKindTone(reward.kind)}
        />
      </View>
      {reward.description ? (
        <Text numberOfLines={3} style={styles.cardDescription}>
          {reward.description}
        </Text>
      ) : null}
      <View style={styles.rewardMetaRow}>
        <Text style={styles.rewardMetaText}>
          {reward.recipientCount} recipients
        </Text>
        {reward.awardXrdm ? (
          <Text style={styles.awardText}>+{reward.awardXrdm} XRDM</Text>
        ) : null}
      </View>
      {reward.ledgerNote ? (
        <Text style={styles.feedbackText}>{reward.ledgerNote}</Text>
      ) : null}
    </View>
  );
}

export function NftBadgeCard({
  reward,
  showTimestamp = false,
}: {
  reward: HackReward;
  showTimestamp?: boolean;
}) {
  return (
    <View style={styles.nftBadgeCard}>
      <Ionicons name="diamond-outline" size={23} color={theme.award} />
      <Text numberOfLines={2} style={styles.nftBadgeName}>
        {reward.title}
      </Text>
      <Text numberOfLines={2} style={styles.nftBadgeDate}>
        {showTimestamp
          ? formatShortDateTime(reward.issuedAt)
          : formatDate(reward.issuedAt)}
      </Text>
    </View>
  );
}

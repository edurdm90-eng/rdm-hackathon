import { Text, View } from "react-native";

import {
  Avatar,
  Field,
  HackButton,
  HackTextInput,
  ProofItemsList,
  StatusPill,
  SubmissionMetaBlock,
} from "@/components/hack-room/components";
import {
  getSubmissionProofItems,
  statusTone,
  submissionStatusLabel,
  type HackSubmission,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";

export function SubmissionReviewCard({
  approveSubmissionDisabled,
  approveSubmissionLoading,
  approveSubmissionPending,
  award,
  feedback,
  mode,
  onApprove,
  onAwardChange,
  onFeedbackChange,
  onReturn,
  onSelectWinner,
  returnSubmissionPending,
  selectWinnerDisabled,
  selectWinnerLoading,
  selectWinnerPending,
  submission,
}: {
  approveSubmissionDisabled?: boolean;
  approveSubmissionLoading?: boolean;
  approveSubmissionPending?: boolean;
  award?: string;
  feedback?: string;
  mode: "history" | "review" | "winner";
  onApprove?: () => void;
  onAwardChange?: (value: string) => void;
  onFeedbackChange?: (value: string) => void;
  onReturn?: () => void;
  onSelectWinner?: () => void;
  returnSubmissionPending?: boolean;
  selectWinnerDisabled?: boolean;
  selectWinnerLoading?: boolean;
  selectWinnerPending?: boolean;
  submission: HackSubmission;
}) {
  const displayParticipantName =
    submission.submitterName?.trim() || submission.participantName;
  const approveButtonDisabled =
    Boolean(approveSubmissionDisabled ?? approveSubmissionPending) ||
    Boolean(returnSubmissionPending);
  const approveButtonLoading =
    approveSubmissionLoading ?? approveSubmissionPending;
  const returnButtonDisabled =
    Boolean(returnSubmissionPending) ||
    Boolean(approveSubmissionDisabled ?? approveSubmissionPending);
  const winnerButtonDisabled = selectWinnerDisabled ?? selectWinnerPending;
  const winnerButtonLoading = selectWinnerLoading ?? selectWinnerPending;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar name={displayParticipantName} tone="cyan" />
        <View style={styles.reviewTitleBlock}>
          <Text style={styles.cardTitle}>{displayParticipantName}</Text>
          <Text style={styles.cardMeta}>
            {submission.roomName} - {submission.taskTitle}
          </Text>
        </View>
        <StatusPill
          label={submissionStatusLabel(submission.status)}
          tone={statusTone(submission.status)}
        />
      </View>

      <SubmissionMetaBlock submission={submission} />
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      {submission.notes ? (
        <Text style={styles.notesText}>{submission.notes}</Text>
      ) : null}

      {mode !== "history" ? (
        <Field
          label={
            mode === "review" ? "Organizer note (required)" : "Host feedback"
          }
        >
          <HackTextInput
            multiline
            onChangeText={onFeedbackChange}
            placeholder="Add a citation, decision note, or return reason."
            style={styles.textArea}
            value={feedback}
          />
        </Field>
      ) : submission.hostFeedback ? (
        <Text style={styles.feedbackText}>{submission.hostFeedback}</Text>
      ) : null}

      {mode === "winner" ? (
        <Field label="XRDM award">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={onAwardChange}
            value={award}
          />
        </Field>
      ) : null}

      {mode === "review" ? (
        <View style={styles.reviewActions}>
          <HackButton
            disabled={returnButtonDisabled}
            label="Return"
            loading={returnSubmissionPending}
            onPress={onReturn ?? (() => {})}
            tone="red"
          />
          <HackButton
            disabled={approveButtonDisabled}
            icon="checkmark-circle-outline"
            label="Verify Proof"
            loading={approveButtonLoading}
            onPress={onApprove ?? (() => {})}
            tone="cyan"
          />
        </View>
      ) : null}

      {mode === "winner" ? (
        <HackButton
          disabled={winnerButtonDisabled}
          icon="trophy-outline"
          label="Announce Winner"
          loading={winnerButtonLoading}
          onPress={onSelectWinner ?? (() => {})}
          tone="gold"
        />
      ) : null}
    </View>
  );
}

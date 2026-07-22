import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  Field,
  HackButton,
  HackTextInput,
  StatusPill,
  WalletChip,
} from "@/components/hack-room/components";
import {
  gameTypeOptions,
  getGameTypeInfo,
  getToneColors,
  makeMathQuestion,
  makeMemoryCards,
  makeMiniGameResult,
  type GameType,
  type MiniGameResult,
  type MiniGameSession,
  type Tone,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import { HACK_THEME as theme } from "@/lib/constants";

export function MiniGamePlaySurface({
  onMiniGameSwitch,
  tone,
}: {
  onMiniGameSwitch: () => void;
  tone: Tone;
}) {
  const [activeGameSession, setActiveGameSession] =
    useState<MiniGameSession | null>(null);
  const [latestResult, setLatestResult] = useState<MiniGameResult | null>(null);
  const toneColors = getToneColors(tone);
  const startGame = (type: GameType) => {
    if (activeGameSession) {
      onMiniGameSwitch();
    }
    setActiveGameSession({ mode: "practice", type });
  };

  return (
    <View style={styles.miniGamePlayStack}>
      {activeGameSession ? (
        <MiniGamePlayer
          onBack={() => setActiveGameSession(null)}
          onComplete={setLatestResult}
          session={activeGameSession}
        />
      ) : null}

      <View
        style={[
          styles.gamesBanner,
          { backgroundColor: toneColors.bg, borderColor: toneColors.border },
        ]}
      >
        <Ionicons
          name="game-controller-outline"
          size={24}
          color={toneColors.fg}
        />
        <View style={styles.profileText}>
          <Text style={[styles.gamesBannerTitle, { color: toneColors.fg }]}>
            Play mini-games
          </Text>
          <Text style={styles.gamesBannerText}>
            Quick in-app games for a reset. They do not create assignments or
            submit proof.
          </Text>
        </View>
      </View>

      {latestResult ? (
        <View style={styles.latestGameResultCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.taskTitleBlock}>
              <Text style={styles.latestGameResultTitle}>
                {latestResult.title}
              </Text>
              <Text style={styles.latestGameResultText}>
                {latestResult.notes}
              </Text>
            </View>
            <StatusPill label={`${latestResult.score} pts`} tone="gold" />
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionEyebrow}>Play Now</Text>
      <ScrollView
        contentContainerStyle={styles.practiceGameShelf}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {gameTypeOptions.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => startGame(option.value)}
            style={({ pressed }) => [
              styles.practiceGameCard,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={option.icon} size={22} color={theme.participant} />
            <Text style={styles.practiceGameTitle}>{option.label}</Text>
            <Text style={styles.practiceGameMeta}>Play</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function MiniGamePlayer({
  onBack,
  onComplete,
  session,
}: {
  onBack: () => void;
  onComplete: (result: MiniGameResult) => void;
  session: MiniGameSession;
}) {
  const gameInfo = getGameTypeInfo(session.type);

  return (
    <View style={styles.miniGameSurface}>
      <View style={styles.cardTopRow}>
        <View style={styles.gameAssignmentIcon}>
          <Ionicons name={gameInfo.icon} size={20} color={theme.award} />
        </View>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{gameInfo.label}</Text>
          <Text style={styles.cardMeta}>Play mode</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.miniGameCloseButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="close-outline" size={17} color={theme.award} />
        </Pressable>
      </View>
      {session.type === "memory_match" ? (
        <MemoryMatchGame onComplete={onComplete} />
      ) : session.type === "breath_timer" ? (
        <BreathTimerGame onComplete={onComplete} />
      ) : (
        <QuickMathsGame onComplete={onComplete} />
      )}
    </View>
  );
}

function MemoryMatchGame({
  onComplete,
}: {
  onComplete: (result: MiniGameResult) => void;
}) {
  const [cards] = useState(() => makeMemoryCards());
  const [flipped, setFlipped] = useState<Array<number>>([]);
  const [matched, setMatched] = useState<Array<string>>([]);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (flipped.length !== 2) {
      return;
    }

    const timeout = setTimeout(() => {
      const [firstIndex, secondIndex] = flipped;
      const firstCard = cards[firstIndex];
      const secondCard = cards[secondIndex];
      setMoves((current) => current + 1);

      if (firstCard?.value && firstCard.value === secondCard?.value) {
        setMatched((current) => [...current, firstCard.value]);
      }

      setFlipped([]);
    }, 650);

    return () => clearTimeout(timeout);
  }, [cards, flipped]);

  useEffect(() => {
    if (matched.length === 4 && !completed) {
      const score = Math.max(40, 120 - moves * 8);
      setCompleted(true);
      onComplete(
        makeMiniGameResult(
          "memory_match",
          score,
          `${moves} moves, 4 pairs matched`,
        ),
      );
    }
  }, [completed, matched.length, moves, onComplete]);

  const handleCardPress = (index: number) => {
    const card = cards[index];
    if (
      !card ||
      completed ||
      flipped.includes(index) ||
      matched.includes(card.value)
    ) {
      return;
    }
    if (flipped.length >= 2) {
      return;
    }
    setFlipped((current) => [...current, index]);
  };

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.miniGameStatRow}>
        <WalletChip label="Moves" value={moves} />
        <WalletChip label="Matched" value={matched.length} />
      </View>
      <View style={styles.memoryGrid}>
        {cards.map((card, index) => {
          const visible =
            flipped.includes(index) || matched.includes(card.value);
          return (
            <Pressable
              accessibilityRole="button"
              key={card.id}
              onPress={() => handleCardPress(index)}
              style={({ pressed }) => [
                styles.memoryCard,
                visible && styles.memoryCardOpen,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.memoryCardText}>
                {visible ? card.label : "?"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

function BreathTimerGame({
  onComplete,
}: {
  onComplete: (result: MiniGameResult) => void;
}) {
  const duration = 30;
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const elapsed = duration - secondsLeft;
  const phase =
    ["Inhale", "Hold", "Exhale"][Math.floor(elapsed / 4) % 3] ?? "Inhale";

  const completeSession = () => {
    if (completed) {
      return;
    }
    const score = Math.max(40, Math.round((elapsed / duration) * 100));
    setCompleted(true);
    setRunning(false);
    onComplete(
      makeMiniGameResult("breath_timer", score, `${elapsed}s mindful session`),
    );
  };

  useEffect(() => {
    if (!running || completed) {
      return;
    }
    if (secondsLeft <= 0) {
      completeSession();
      return;
    }

    const interval = setInterval(
      () => setSecondsLeft((current) => current - 1),
      1000,
    );
    return () => clearInterval(interval);
  }, [completed, running, secondsLeft]);

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.breathRing}>
        <Text style={styles.breathPhase}>{phase}</Text>
        <Text style={styles.breathTime}>{secondsLeft}s</Text>
      </View>
      <Text style={styles.gamesBannerText}>
        Follow the phase. Finish after a short reset to save a local result.
      </Text>
      <View style={styles.gameControlRow}>
        <HackButton
          icon={running ? "pause-outline" : "play-outline"}
          label={running ? "Pause" : "Start"}
          onPress={() => setRunning((current) => !current)}
          tone="cyan"
        />
        <HackButton
          disabled={completed || elapsed < 5}
          icon="checkmark-circle-outline"
          label="Finish"
          onPress={completeSession}
          tone="gold"
        />
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

function QuickMathsGame({
  onComplete,
}: {
  onComplete: (result: MiniGameResult) => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState(() => makeMathQuestion(0));
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [completed, setCompleted] = useState(false);

  const submitAnswer = () => {
    if (completed) {
      return;
    }

    const nextCorrect =
      Number(answer) === question.answer ? correct + 1 : correct;
    const nextIndex = questionIndex + 1;
    setCorrect(nextCorrect);
    setAnswer("");

    if (nextIndex >= 5) {
      setCompleted(true);
      onComplete(
        makeMiniGameResult(
          "quick_maths",
          nextCorrect * 20,
          `${nextCorrect}/5 answers correct`,
        ),
      );
      return;
    }

    setQuestionIndex(nextIndex);
    setQuestion(makeMathQuestion(nextIndex));
  };

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.mathQuestionCard}>
        <Text style={styles.mathRound}>Round {questionIndex + 1} / 5</Text>
        <Text style={styles.mathQuestion}>{question.prompt}</Text>
      </View>
      <Field label="Answer">
        <HackTextInput
          keyboardType="number-pad"
          onChangeText={setAnswer}
          onSubmitEditing={submitAnswer}
          placeholder="Type result"
          value={answer}
        />
      </Field>
      <View style={styles.gameControlRow}>
        <WalletChip label="Correct" value={correct} />
        <HackButton
          disabled={!answer.trim() || completed}
          icon="arrow-forward-outline"
          label={questionIndex >= 4 ? "Finish" : "Next"}
          onPress={submitAnswer}
          tone="cyan"
        />
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

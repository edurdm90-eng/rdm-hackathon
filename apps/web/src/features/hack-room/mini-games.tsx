import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import { useEffect, useState } from "react";
import type * as React from "react";

import { NativeIcon } from "@/lib/native-icons";

import { ParticipantSubmitPanel } from "./forms";
import {
  gameTypeOptions,
  getGameTypeInfo,
  type GameType,
  makeEmptySubmitForm,
  makeMathQuestion,
  makeMemoryCards,
  makeMiniGameResult,
  type DashboardData,
  type HackTask,
  type MiniGameResult,
} from "./model";
import { Badge, EmptyState, SectionCard, StatBox, SubmissionHoldCard, TaskCard, TextArea } from "./shared-ui";

function ParticipantGamesPanel({
  mySubmissions,
  onSelectTask,
  onSubmitFormChange,
  onSubmitProof,
  selectedSubmission,
  selectedTask,
  selectedTaskId,
  submitForm,
  submitProofPending,
  tasks,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  onSubmitProof: () => void;
  selectedSubmission?: DashboardData["mySubmissions"][number];
  selectedTask?: HackTask;
  selectedTaskId: string;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
  submitProofPending: boolean;
  tasks: HackTask[];
}) {
  const gameTasks = tasks.filter((task) => task.kind === "game");
  const challengeTasks = tasks.filter((task) => task.kind === "challenge");

  return (
    <div className="grid gap-3">
      <SectionCard badge={`${gameTasks.length} live`} eyebrow="Participant" title="Games">
        <MiniGameArena
          onUseResult={(result) => {
            onSubmitFormChange((current) => ({
              ...current,
              notes: result.notes,
              proofItems: { ...current.proofItems, game_score: result.proofValue },
            }));
          }}
        />
      </SectionCard>

      <SectionCard badge={`${gameTasks.length + challengeTasks.length} assignments`} eyebrow="Play Proof" title="Game and Spot Tasks">
        <div className="grid gap-2">
          {[...gameTasks, ...challengeTasks].length ? (
            [...gameTasks, ...challengeTasks].map((task) => {
              const submission = mySubmissions.find((item) => item.taskId === task._id);
              return (
                <TaskCard
                  key={task._id}
                  onSelect={() => onSelectTask(task._id)}
                  selected={selectedTaskId === task._id}
                  status={submission?.status}
                  task={task}
                />
              );
            })
          ) : (
            <EmptyState icon={<NativeIcon name="game-controller-outline" />} text="Game assignments and spot challenges will appear here." />
          )}
        </div>
        {selectedTask?.kind === "game" || selectedTask?.kind === "challenge" ? (
          <div className="mt-3">
            <ParticipantSubmitPanel
              mySubmissions={mySubmissions}
              onSelectTask={onSelectTask}
              onSubmitFormChange={onSubmitFormChange}
              onSubmitProof={onSubmitProof}
              selectedSubmission={selectedSubmission}
              selectedTask={selectedTask}
              selectedTaskId={selectedTaskId}
              submitForm={submitForm}
              submitProofPending={submitProofPending}
              tasks={[selectedTask]}
              user={{ email: "", id: "", name: submitForm.submitterName }}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function MiniGameArena({ onUseResult }: { onUseResult: (result: MiniGameResult) => void }) {
  const [gameType, setGameType] = useState<GameType>("memory_match");
  const [latestResult, setLatestResult] = useState<MiniGameResult | null>(null);
  const gameInfo = getGameTypeInfo(gameType);
  const Icon = gameInfo.icon;

  function handleComplete(result: MiniGameResult) {
    setLatestResult(result);
    onUseResult(result);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {gameTypeOptions.map((option) => {
          const OptionIcon = option.icon;
          const active = gameType === option.value;
          return (
            <button
              className={`rounded-[9px] border p-2 text-left text-xs transition ${
                active ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]" : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690]"
              }`}
              key={option.value}
              onClick={() => setGameType(option.value)}
              type="button"
            >
              <OptionIcon className="mb-1 size-4" />
              <span className="block font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[12px] border border-[#F0C040] bg-[#241A00] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[8px] border border-[#8A6A00] bg-[#0D0F12]">
              <Icon className="size-4 text-[#F0C040]" />
            </span>
            <div>
              <div className="text-sm font-medium text-[#EEE8DE]">{gameInfo.label}</div>
              <div className="text-[10px] text-[#626058]">Practice or generate score proof</div>
            </div>
          </div>
          <Badge tone="gold">Active</Badge>
        </div>
        {gameType === "memory_match" ? (
          <MemoryMatchGame onComplete={handleComplete} />
        ) : gameType === "breath_timer" ? (
          <BreathTimerGame onComplete={handleComplete} />
        ) : (
          <QuickMathsGame onComplete={handleComplete} />
        )}
      </div>

      {latestResult ? (
        <div className="rounded-[10px] border border-[#1EEAB0] bg-[#061F18] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#1EEAB0]">{latestResult.title} proof ready</div>
              <p className="mt-1 text-xs leading-5 text-[#1EEAB0]">{latestResult.notes}</p>
            </div>
            <Badge tone="gold">{latestResult.score} pts</Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemoryMatchGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [cards, setCards] = useState(makeMemoryCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const timeout = window.setTimeout(() => {
      const [firstIndex, secondIndex] = flipped;
      const firstCard = cards[firstIndex];
      const secondCard = cards[secondIndex];
      setMoves((current) => current + 1);
      if (firstCard?.value && firstCard.value === secondCard?.value) {
        setMatched((current) => [...current, firstCard.value]);
      }
      setFlipped([]);
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [cards, flipped]);

  useEffect(() => {
    if (matched.length === 4 && !completed) {
      const score = Math.max(40, 120 - moves * 8);
      setCompleted(true);
      onComplete(makeMiniGameResult("memory_match", score, `${moves} moves, 4 pairs matched`));
    }
  }, [completed, matched.length, moves, onComplete]);

  function reset() {
    setCards(makeMemoryCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setCompleted(false);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Moves" value={moves} tone="gold" />
        <StatBox label="Matched" value={matched.length} tone="gold" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((card, index) => {
          const visible = flipped.includes(index) || matched.includes(card.value);
          return (
            <button
              className={`grid h-[52px] place-items-center rounded-[8px] border text-lg font-medium transition ${
                visible
                  ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]"
                  : "border-[#8A6A00] bg-[#0D0F12] text-[#626058]"
              }`}
              disabled={completed}
              key={card.id}
              onClick={() => {
                if (visible || flipped.length >= 2) return;
                setFlipped((current) => [...current, index]);
              }}
              type="button"
            >
              {visible ? card.label : "?"}
            </button>
          );
        })}
      </div>
      <Button className="h-9 rounded-[9px] border-[#F0C040] bg-[#0D0F12] text-[#F0C040]" onClick={reset} type="button" variant="outline">
        <NativeIcon className="size-4" name="refresh-outline" />
        Reset Game
      </Button>
    </div>
  );
}

function BreathTimerGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [seconds, setSeconds] = useState(30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) {
      setRunning(false);
      onComplete(makeMiniGameResult("breath_timer", 60, "30 second focus loop completed"));
      return;
    }
    const timeout = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [onComplete, running, seconds]);

  return (
    <div className="grid gap-3 text-center">
      <div className="rounded-[12px] border border-[#8A6A00] bg-[#0D0F12] p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#626058]">Breathe</div>
        <div className="mt-2 text-4xl font-medium text-[#F0C040]">{seconds}</div>
        <div className="mt-2 text-xs text-[#9C9690]">{seconds % 8 < 4 ? "Inhale" : "Exhale"}</div>
      </div>
      <Button
        className="h-9 rounded-[9px] bg-[#F0C040] text-[#120d00] hover:bg-[#F0C040]/85"
        onClick={() => {
          if (seconds <= 0) setSeconds(30);
          setRunning((current) => !current);
        }}
        type="button"
      >
        {running ? "Pause" : "Start"}
      </Button>
    </div>
  );
}

function QuickMathsGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState(() => makeMathQuestion(0));
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  function submitAnswer() {
    const correct = Number(answer) === question.answer;
    const nextScore = correct ? score + 20 : score;
    const nextRound = round + 1;
    setScore(nextScore);
    setAnswer("");
    if (nextRound >= 5) {
      onComplete(makeMiniGameResult("quick_maths", nextScore, `${nextScore / 20} of 5 answers correct`));
      setRound(0);
      setScore(0);
      setQuestion(makeMathQuestion(0));
      return;
    }
    setRound(nextRound);
    setQuestion(makeMathQuestion(nextRound));
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitAnswer();
      }}
    >
      <div className="rounded-[12px] border border-[#8A6A00] bg-[#0D0F12] p-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#626058]">Round {round + 1} of 5</div>
        <div className="mt-2 text-4xl font-medium text-[#F0C040]">{question.prompt}</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          className="h-10 rounded-[9px] border-[#F0C040] bg-[#0D0F12] text-center font-mono text-sm text-[#F0C040]"
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Answer"
          type="number"
          value={answer}
        />
        <Button className="h-10 rounded-[9px] bg-[#F0C040] text-[#120d00]" disabled={!answer.trim()} type="submit">
          Check
        </Button>
      </div>
      <StatBox label="Score" value={score} tone="gold" />
    </form>
  );
}

export { MiniGameArena, ParticipantGamesPanel };

import type * as React from "react";

const glyphMap = {
  "add-circle-outline": 61701,
  "add-outline": 61703,
  "albums-outline": 61712,
  "alert-circle-outline": 61716,
  "arrow-back-outline": 61739,
  "arrow-forward-outline": 61751,
  "calculator-outline": 61901,
  "calendar-outline": 61910,
  "checkmark-circle-outline": 61983,
  "checkmark-outline": 61991,
  "chevron-back-outline": 61997,
  "chevron-forward-outline": 62015,
  "clipboard-outline": 62024,
  "close-outline": 62030,
  "cloud-download-outline": 62040,
  "cloud-outline": 62045,
  "copy-outline": 62096,
  "diamond-outline": 62114,
  "document-attach-outline": 62124,
  "document-text-outline": 62132,
  "download-outline": 62138,
  "easel-outline": 62150,
  "enter-outline": 62171,
  "file-tray-full-outline": 62199,
  "flash-outline": 62234,
  "game-controller-outline": 62261,
  "grid-outline": 62294,
  "home-outline": 62339,
  "hourglass-outline": 62342,
  "key-outline": 62372,
  "layers-outline": 62384,
  "leaf-outline": 62387,
  "link-outline": 62393,
  "log-out-outline": 62417,
  "logo-github": 62451,
  "menu-outline": 62546,
  "notifications-outline": 62591,
  "people-outline": 62627,
  "person-circle-outline": 62634,
  "person-outline": 62636,
  "podium-outline": 62693,
  "refresh-outline": 62744,
  "ribbon-outline": 62789,
  "search-outline": 62819,
  "send-outline": 62822,
  "share-outline": 62834,
  "shield-checkmark-outline": 62841,
  "shield-outline": 62846,
  "star-outline": 62873,
  "time-outline": 62942,
  "trophy-outline": 62978,
  "videocam-outline": 62993,
  "wallet-outline": 63014,
  "warning-outline": 63017,
} as const;

export type NativeIconName = keyof typeof glyphMap;

export type NativeIconProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: NativeIconName;
  title?: string;
};

export type NativeIconComponent = React.ComponentType<Omit<NativeIconProps, "name">>;

const sizeClassToFontSize: Array<[string, string]> = [
  ["size-[19px]", "19px"],
  ["size-[18px]", "18px"],
  ["size-5", "1.25rem"],
  ["size-4", "1rem"],
  ["size-3.5", "0.875rem"],
  ["size-3", "0.75rem"],
];

function inferFontSize(className?: string) {
  if (!className) return undefined;
  return sizeClassToFontSize.find(([sizeClass]) => className.split(/\s+/).includes(sizeClass))?.[1];
}

export function NativeIcon({ className, name, style, title, ...props }: NativeIconProps) {
  const fontSize = inferFontSize(className);

  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={["native-ionicon", className].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      style={fontSize ? { fontSize, ...style } : style}
      {...props}
    >
      {String.fromCodePoint(glyphMap[name])}
    </span>
  );
}

export function createNativeIcon(name: NativeIconName): NativeIconComponent {
  function Icon(props: Omit<NativeIconProps, "name">) {
    return <NativeIcon name={name} {...props} />;
  }

  Icon.displayName = `NativeIcon(${name})`;
  return Icon;
}

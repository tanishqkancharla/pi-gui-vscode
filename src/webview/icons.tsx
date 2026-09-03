import type { JSX } from "solid-js";

type IconProps = {
  size?: number;
  class?: string;
};

function Svg(props: IconProps & { children: JSX.Element }) {
  const size = () => props.size ?? 16;
  return (
    <svg
      class={props.class}
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
  "stroke-width": 1.5,
};

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M5.75 12.8665L8.33995 16.4138C9.15171 17.5256 10.8179 17.504 11.6006 16.3715L18.25 6.75"
      />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M15.25 10.75L12 14.25L8.75 10.75" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M10.75 8.75L14.25 12L10.75 15.25" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M13.25 8.75L9.75 12L13.25 15.25" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 5.75V18.25" />
      <path {...stroke} d="M18.25 12L5.75 12" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M19.25 19.25L15.5 15.5M4.75 11C4.75 7.54822 7.54822 4.75 11 4.75C14.4518 4.75 17.25 7.54822 17.25 11C17.25 14.4518 14.4518 17.25 11 17.25C7.54822 17.25 4.75 14.4518 4.75 11Z"
      />
    </Svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V9L14 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z"
      />
      <path {...stroke} d="M18 9.25H13.75V5" />
    </Svg>
  );
}

export function IconFileDiff(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V9L14 4.75H7.75C6.64543 4.75 5.75 5.64543 5.75 6.75V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z"
      />
      <path {...stroke} d="M18 9.25H13.75V5" />
      <path {...stroke} d="M9.75 15.25H14.25" />
      <path {...stroke} d="M9.75 12.25H14.25" />
    </Svg>
  );
}

export function IconTerminal(props: IconProps) {
  return (
    <Svg {...props}>
      <rect width="14.5" height="14.5" x="4.75" y="4.75" rx="2" {...stroke} />
      <path {...stroke} d="M8.75 10.75L11.25 13L8.75 15.25" />
    </Svg>
  );
}

export function IconTool(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M10.75 13.25V10.25H8.25V11.25C8.25 11.8023 7.80228 12.25 7.25 12.25H5.75C5.19772 12.25 4.75 11.8023 4.75 11.25V5.75C4.75 5.19772 5.19772 4.75 5.75 4.75H7.25C7.80228 4.75 8.25 5.19772 8.25 5.75V6.75H15C15 6.75 19.25 6.75 19.25 11.25C19.25 11.25 17 10.25 14.25 10.25V13.25M10.75 13.25H14.25M10.75 13.25V19.25M14.25 13.25V19.25"
      />
    </Svg>
  );
}

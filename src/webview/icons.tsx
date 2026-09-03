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

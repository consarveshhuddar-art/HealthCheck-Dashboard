type LoaderSpinnerProps = {
  size?: "xs" | "sm" | "md";
  className?: string;
};

const sizeClass = {
  xs: "h-3 w-3 border",
  sm: "h-3.5 w-3.5 border-[1.5px]",
  md: "h-4 w-4 border-2",
} as const;

/** Inline spinner — matches RouteLoader violet ring style. */
export function LoaderSpinner({
  size = "sm",
  className = "",
}: LoaderSpinnerProps) {
  return (
    <span
      className={`motion-reduce:animate-none inline-block shrink-0 animate-spin rounded-full border-transparent border-t-violet-500 border-r-violet-400/40 ${sizeClass[size]} ${className}`}
      style={{ animationDuration: "0.75s" }}
      aria-hidden
    />
  );
}
